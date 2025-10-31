// File: mobile/lib/main.dart
// (เวอร์ชันแก้ไข: เรียก Liveness Check Camera)

import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart'; // ยังเก็บไว้เผื่อใช้
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/RegisterFacePage.dart'; // Ensure this file exists
import 'dart:async'; // Import for Timer/TimeoutException

// ⭐️⭐️ Import ไฟล์ใหม่ที่เราจะสร้าง ⭐️⭐️
import 'package:camera/camera.dart'; 
import 'package:mobile/CheckInCameraPage.dart'; 

// ⭐️ URL ของ API Service (แก้ไขให้ถูกต้องสำหรับ Emulator/Device ของคุณ)
// const String apiUrl = 'http://10.0.2.2:8000'; // For Android Emulator
const String apiUrl = 'http://192.168.1.37:8000'; // 👈 ** แก้ไข IP ตรงนี้!! ให้เป็น IP คอมพิวเตอร์ของคุณ **

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Face Attendance',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: const AuthWrapper(),
    );
  }
}

// AuthWrapper (Handles login state and face registration status)
class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});
  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}
class _AuthWrapperState extends State<AuthWrapper> {
  String? _token; String? _username; String? _fullName; bool _isFaceRegistered = false;
  @override void initState() { super.initState(); _checkLoginStatus(); }
  Future<void> _checkLoginStatus() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() { _token = prefs.getString('user_token'); _username = prefs.getString('username'); _fullName = prefs.getString('full_name'); _isFaceRegistered = prefs.getBool('isFaceRegistered') ?? false; });
  }
  void _onLoginSuccess(String token, String username, String fullName, bool isFaceRegistered) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_token', token); await prefs.setString('username', username); await prefs.setString('full_name', fullName); await prefs.setBool('isFaceRegistered', isFaceRegistered);
    if (!mounted) return; setState(() { _token = token; _username = username; _fullName = fullName; _isFaceRegistered = isFaceRegistered; });
  }
  void _onFaceRegistrationSuccess() async {
    final prefs = await SharedPreferences.getInstance(); await prefs.setBool('isFaceRegistered', true);
    if (!mounted) return; setState(() { _isFaceRegistered = true; });
  }
  void _onLogout() async {
    final prefs = await SharedPreferences.getInstance(); await prefs.clear();
    if (!mounted) return; setState(() { _token = null; _username = null; _fullName = null; _isFaceRegistered = false; });
  }
  @override Widget build(BuildContext context) {
    if (_token == null) { return LoginPage(onLoginSuccess: _onLoginSuccess); }
    else if (!_isFaceRegistered) { return RegisterFacePage( token: _token!, fullName: _fullName ?? "User", onRegistrationSuccess: _onFaceRegistrationSuccess, ); }
    else { return CheckInPage( token: _token!, username: _username ?? "user", fullName: _fullName ?? "User", onLogout: _onLogout, ); }
  }
}

// LoginPage (Gets isFaceRegistered from API)
class LoginPage extends StatefulWidget {
  final Function(String token, String username, String fullName, bool isFaceRegistered) onLoginSuccess;
  const LoginPage({super.key, required this.onLoginSuccess});
  @override State<LoginPage> createState() => _LoginPageState();
}
class _LoginPageState extends State<LoginPage> {
  final TextEditingController _usernameController = TextEditingController(); final TextEditingController _passwordController = TextEditingController(); String _message = ''; bool _isLoading = false;
  Future<void> _login() async { if (!mounted) return; setState(() { _isLoading = true; _message = ''; }); try {
      final response = await http.post( Uri.parse('$apiUrl/login'), headers: {'Content-Type': 'application/json'}, body: jsonEncode({ 'username': _usernameController.text, 'password': _passwordController.text, }), ).timeout(const Duration(seconds: 15));
      if (!mounted) return; if (response.statusCode == 200) { final data = jsonDecode(response.body); final bool isFaceRegistered = data['user']?['isFaceRegistered'] ?? false; final String fullName = data['user']?['fullName'] ?? _usernameController.text; widget.onLoginSuccess( data['token'], _usernameController.text, fullName, isFaceRegistered, ); }
      else { final errorBody = jsonDecode(response.body); setState(() { _message = 'Login failed: ${errorBody['error'] ?? 'Status code ${response.statusCode}'}'; }); }
    } on TimeoutException { if (mounted) { setState(() { _message = 'Login failed: Connection timed out.'; _isLoading = false; }); } }
    catch (e) { if (mounted) { setState(() { _message = 'Login failed: ${e.toString()}'; _isLoading = false; }); } }
    finally { if (mounted && _isLoading) { setState(() { _isLoading = false; }); } }
  }
  @override Widget build(BuildContext context) { return Scaffold( appBar: AppBar(title: const Text('User Login')), body: Padding( padding: const EdgeInsets.all(16.0), child: Column( mainAxisAlignment: MainAxisAlignment.center, children: [ TextField( controller: _usernameController, decoration: const InputDecoration(labelText: 'Username'), keyboardType: TextInputType.text, autocorrect: false, ), TextField( controller: _passwordController, decoration: const InputDecoration(labelText: 'Password'), obscureText: true, keyboardType: TextInputType.visiblePassword, autocorrect: false, ), const SizedBox(height: 20), _isLoading ? const CircularProgressIndicator() : ElevatedButton( onPressed: _login, child: const Text('Login'), ), const SizedBox(height: 10), if (_message.isNotEmpty) Text(_message, style: const TextStyle(color: Colors.red)), ], ), ), ); }
}

// CheckInPage (มีการตรวจสอบ Geofence ก่อน)
class CheckInPage extends StatefulWidget {
  final String token; final String username; final String fullName; final VoidCallback onLogout;
  const CheckInPage({ super.key, required this.token, required this.username, required this.fullName, required this.onLogout, });
  @override State<CheckInPage> createState() => _CheckInPageState();
}

class _CheckInPageState extends State<CheckInPage> {
  bool _isCheckingIn = false; File? _imageFile; 
  // final ImagePicker _picker = ImagePicker(); // ไม่ได้ใช้ picker โดยตรงแล้ว

  // -- ⭐️ State ใหม่ ⭐️ --
  String _statusMessage = 'Please verify your location first'; // ข้อความแสดงสถานะ
  bool _isVerifyingLocation = false; // กำลังตรวจสอบตำแหน่ง?
  bool? _isInGeofence; // ผลการตรวจสอบตำแหน่ง (null=ยังไม่ได้เช็ค, true=อยู่, false=ไม่อยู่)
  Position? _currentPosition; // เก็บตำแหน่งล่าสุดที่ตรวจสอบผ่าน

  // --- ฟังก์ชันดึงตำแหน่ง (เหมือนเดิม แต่คืนค่า null ถ้า error) ---
  Future<Position?> _getCurrentLocation() async {
    bool serviceEnabled; LocationPermission permission;
    try {
        serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (!serviceEnabled) { _updateStatus('Location services are disabled. Please enable GPS.'); return null; }
        permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied) {
          permission = await Geolocator.requestPermission();
          if (permission == LocationPermission.denied) { _updateStatus('Location permissions denied.'); return null; }
        }
        if (permission == LocationPermission.deniedForever) { _updateStatus('Location permissions permanently denied. Please enable in settings.'); return null; }
        return await Geolocator.getCurrentPosition( desiredAccuracy: LocationAccuracy.high, timeLimit: const Duration(seconds: 15) );
    } on TimeoutException { _updateStatus('Failed to get location: Timed out.'); return null; }
    catch (e) { _updateStatus('Failed to get location: ${e.toString()}'); return null; }
  }

  // --- ⭐️ ฟังก์ชันใหม่: ตรวจสอบ Geofence ⭐️ --- (โค้ดเดิม)
  Future<void> _verifyLocation() async {
    if (!mounted) return;
    setState(() { _isVerifyingLocation = true; _statusMessage = 'Getting your location...'; _isInGeofence = null; _currentPosition = null; });
    Position? position;
    try {
      position = await _getCurrentLocation();
      if (position == null || !mounted) { setState(() => _isVerifyingLocation = false); return; }
      if (!mounted) return; // Check again
      setState(() { _statusMessage = 'Location found. Checking authorized zone...'; _currentPosition = position; });
      final response = await http.get(
        Uri.parse('$apiUrl/check-geofence?latitude=${position.latitude}&longitude=${position.longitude}'),
        headers: { 'Authorization': 'Bearer ${widget.token}', },
      ).timeout(const Duration(seconds: 15));
      if (!mounted) return;
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body); final bool isInZone = data['isInGeofence'] ?? false;
        setState(() { _isInGeofence = isInZone; _statusMessage = isInZone ? '✅ You are within an authorized zone. Ready to check-in.' : '❌ You are outside authorized check-in zones.'; });
      } else {
        final errorMsg = jsonDecode(response.body)['error'] ?? 'Server error ${response.statusCode}';
        setState(() { _isInGeofence = false; _statusMessage = '❌ Failed to verify zone: $errorMsg'; });
      }
    } on TimeoutException { if (mounted) { setState(() { _isInGeofence = false; _statusMessage = '❌ Failed to verify zone: Request timed out.'; }); } }
    catch (e) { if (mounted && !_statusMessage.startsWith('❌')) { setState(() { _isInGeofence = false; _statusMessage = '❌ Error verifying location: ${e.toString()}'; }); } }
    finally { if (mounted) { setState(() => _isVerifyingLocation = false); } }
  }

  // --- ⭐️⭐️ ฟังก์ชันถ่ายรูป (แก้ไข) ⭐️⭐️ ---
  // (เปลี่ยนจากการใช้ ImagePicker เป็นการเรียกหน้า Liveness Check)
  Future<void> _takePicture() async {
     if (!mounted) return; 
     setState(() { _statusMessage = 'Opening secure camera...'; _imageFile = null; });
     
     try {
        // ⭐️⭐️ 1. นำทางไปยังหน้า CheckInCameraPage ที่เราสร้างขึ้น
        // เราใช้ "dynamic" หรือ "XFile?" ก็ได้
        final dynamic photo = await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => const CheckInCameraPage(),
          ),
        );
        
        if (!mounted) return;
        
        // 2. ตรวจสอบว่าได้รูปกลับมาหรือไม่ (ถ้าผู้ใช้กดยกเลิก photo จะเป็น null)
        // ตรวจสอบ Type ด้วยว่าเป็น XFile
        if (photo != null && photo is XFile) { 
          // ⭐️ 3. ถ้ารูปไม่เป็น null (ผ่าน Liveness) ก็เรียก check-in ตามปกติ
          _checkInWithPicture(File(photo.path)); 
        } else { 
          // ผู้ใช้กดยกเลิก
          setState(() { 
            _statusMessage = 'Liveness check cancelled. Please verify location again.'; 
            _isInGeofence = null; // ⭐️ รีเซ็ตสถานะ
          }); 
        }
    } catch (e) { 
      print("Error opening secure camera: $e"); 
      if (mounted) { 
        setState(() { 
          _statusMessage = 'Error opening secure camera: ${e.toString()}'; 
          _isInGeofence = null; 
        }); 
      } 
    }
  }


  // --- ฟังก์ชัน Check-in จริง (ใช้ _currentPosition) --- (โค้ดเดิม)
  Future<void> _checkInWithPicture(File imageFile) async {
    if (_currentPosition == null) { _updateStatus('❌ Location not verified. Please verify location first.'); return; }
    if (!mounted) return; setState(() { _isCheckingIn = true; _statusMessage = 'Sending check-in data...'; _imageFile = imageFile; });
    try {
      final position = _currentPosition!;
      var request = http.MultipartRequest('POST', Uri.parse('$apiUrl/check-in'));
      request.headers['Authorization'] = 'Bearer ${widget.token}';
      request.files.add(await http.MultipartFile.fromPath('image', imageFile.path));
      request.fields['latitude'] = position.latitude.toString(); request.fields['longitude'] = position.longitude.toString();
      var streamedResponse = await request.send().timeout(const Duration(seconds: 30));
       if (!mounted) return; var response = await http.Response.fromStream(streamedResponse); if (!mounted) return;
      if (response.statusCode == 200) { setState(() { _statusMessage = '✅ Check-in successful!'; _isInGeofence = null; _currentPosition = null; _imageFile = null; }); }
      else { final errorMsg = jsonDecode(response.body)['error'] ?? 'Unknown error ${response.statusCode}'; setState(() { _statusMessage = '❌ Check-in failed: $errorMsg'; _isInGeofence = null; _currentPosition = null; _imageFile = null; }); }
    } on TimeoutException { if (mounted) { setState(() { _statusMessage = '❌ Check-in failed: Request timed out.'; _isInGeofence = null; _currentPosition = null; _imageFile = null; }); } }
    catch (e) { if (mounted) { setState(() => { _statusMessage = '❌ Check-in failed: ${e.toString()}', _isInGeofence = null, _currentPosition = null, _imageFile = null }); } }
    finally { if (mounted) { setState(() { _isCheckingIn = false; /* _imageFile cleared above */ }); } }
  }

  // --- ฟังก์ชัน Update Status --- (โค้ดเดิม)
  void _updateStatus(String status) {
      if (mounted) { setState(() { _statusMessage = status; _isCheckingIn = false; _isVerifyingLocation = false; _isInGeofence = null; _currentPosition = null; _imageFile = null; }); }
  }

  @override
  Widget build(BuildContext context) { // (โค้ดเดิม)
    return Scaffold(
      appBar: AppBar( title: const Text('Face Attendance Check-in'), actions: [ IconButton(icon: const Icon(Icons.logout), onPressed: widget.onLogout, tooltip: 'Logout'), ], ),
      body: Center( child: Padding( padding: const EdgeInsets.all(16.0), child: Column( mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
            Text( 'Welcome, ${widget.fullName} (${widget.username})!', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold), textAlign: TextAlign.center, ),
            const SizedBox(height: 30),
            // แสดงรูป Preview ถ้าถ่ายแล้วและกำลัง check-in
            if (_imageFile != null && _isCheckingIn) ...[ Image.file(_imageFile!, height: 150, width: 150, fit: BoxFit.cover), const SizedBox(height: 15), ],
            // แสดงข้อความสถานะ
            Text( _statusMessage, style: TextStyle( fontSize: 16, color: _statusMessage.startsWith('❌') ? Colors.red : (_statusMessage.startsWith('✅') ? Colors.green : Colors.black), ), textAlign: TextAlign.center, ),
            const SizedBox(height: 30),
            // แสดงปุ่มตามสถานะ
            if (_isVerifyingLocation || _isCheckingIn)
              const CircularProgressIndicator() // แสดง Loading
            else if (_isInGeofence == true)
              // อยู่ในโซน -> แสดงปุ่ม Check-in (เปิดกล้อง)
              ElevatedButton.icon( onPressed: _takePicture, icon: const Icon(Icons.camera_alt), label: const Text('Check-in Now'), style: ElevatedButton.styleFrom( padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 15), textStyle: const TextStyle(fontSize: 18), ), )
            else
              // ยังไม่เช็ค หรือ อยู่นอกโซน -> แสดงปุ่ม Verify Location
              ElevatedButton.icon( onPressed: _verifyLocation, icon: const Icon(Icons.location_searching), label: const Text('Verify Location'), style: ElevatedButton.styleFrom( padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 15), textStyle: const TextStyle(fontSize: 18), ), ),
          ], ), ), ),
    );
  }
} // End of _CheckInPageState