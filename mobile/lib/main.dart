// File: mobile/lib/main.dart
// (เวอร์ชันอัปเดต: เพิ่มหน้าเลือกรายวิชา (Subject Selection) ก่อน Check-in)
// (ไฟล์นี้ไม่ต้องแก้ไขแล้ว เพราะ Server จะกรองวิชามาให้เอง)

import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
// import 'package:image_picker/image_picker.dart'; // ไม่ได้ใช้แล้ว
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/RegisterFacePage.dart';
import 'dart:async'; 

import 'package:camera/camera.dart'; 
import 'package:mobile/CheckInCameraPage.dart'; 

// ⭐️ URL ของ API Service (เหมือนเดิม)
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

// AuthWrapper (เหมือนเดิม)
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
    else { 
      // ⭐️ เปลี่ยน CheckInPage เป็น SubjectSelectionPage (ซึ่งเราจะแก้ไข CheckInPage ให้ทำหน้าที่นี้)
      return SubjectSelectionPage( token: _token!, username: _username ?? "user", fullName: _fullName ?? "User", onLogout: _onLogout, ); 
    }
  }
}

// LoginPage (เหมือนเดิม)
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


// ⭐️⭐️ [CLASS ใหม่] สร้าง Model สำหรับเก็บข้อมูล Subject ⭐️⭐️
class Subject {
  final int id;
  final String code;
  final String name;
  final String? description;

  Subject({
    required this.id,
    required this.code,
    required this.name,
    this.description,
  });

  factory Subject.fromJson(Map<String, dynamic> json) {
    return Subject(
      id: json['subject_id'],
      code: json['code'],
      name: json['name'],
      description: json['description'],
    );
  }
}


// ⭐️⭐️ [แก้ไข] เปลี่ยนชื่อ CheckInPage เป็น SubjectSelectionPage ⭐️⭐️
// และปรับปรุง State ทั้งหมด
class SubjectSelectionPage extends StatefulWidget {
  final String token; 
  final String username; 
  final String fullName; 
  final VoidCallback onLogout;
  
  const SubjectSelectionPage({ 
    super.key, 
    required this.token, 
    required this.username, 
    required this.fullName, 
    required this.onLogout, 
  });

  @override 
  State<SubjectSelectionPage> createState() => _SubjectSelectionPageState();
}

class _SubjectSelectionPageState extends State<SubjectSelectionPage> {
  
  // --- ⭐️ State สำหรับการเลือกวิชา ⭐️ ---
  List<Subject> _subjects = [];
  Subject? _selectedSubject; // วิชาที่เลือก
  bool _isLoadingSubjects = true;
  String? _subjectErrorMessage;

  // --- ⭐️ State สำหรับการเช็คอิน (ย้ายมาจาก CheckInPage เดิม) ⭐️ ---
  bool _isCheckingIn = false; 
  File? _imageFile; 
  String _statusMessage = 'Please verify your location first'; // ข้อความแสดงสถานะ
  bool _isVerifyingLocation = false; // กำลังตรวจสอบตำแหน่ง?
  bool? _isInGeofence; // ผลการตรวจสอบตำแหน่ง (null=ยังไม่ได้เช็ค, true=อยู่, false=ไม่อยู่)
  Position? _currentPosition; // เก็บตำแหน่งล่าสุดที่ตรวจสอบผ่าน

  @override
  void initState() {
    super.initState();
    _fetchSubjects(); // ⭐️ เริ่มต้นด้วยการโหลดรายวิชา
  }

  // --- ⭐️ [ฟังก์ชันใหม่] ดึงรายวิชาจาก API /courses ⭐️ ---
  // (ฟังก์ชันนี้ไม่ต้องแก้ Server จะกรองวิชาที่ user ลงทะเบียนไว้มาให้เอง)
  Future<void> _fetchSubjects() async {
    if (!mounted) return;
    setState(() {
      _isLoadingSubjects = true;
      _subjectErrorMessage = null;
    });

    try {
      final response = await http.get(
        Uri.parse('$apiUrl/courses'), // ⭐️ เรียก API /courses
        headers: { 'Authorization': 'Bearer ${widget.token}', },
      ).timeout(const Duration(seconds: 15));

      if (!mounted) return;

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        setState(() {
          _subjects = data.map((json) => Subject.fromJson(json)).toList();
          _isLoadingSubjects = false;
        });
      } else {
        final errorMsg = jsonDecode(response.body)['error'] ?? 'Server error ${response.statusCode}';
        setState(() {
          _subjectErrorMessage = '❌ Failed to load subjects: $errorMsg';
          _isLoadingSubjects = false;
        });
      }
    } on TimeoutException {
      if (mounted) {
        setState(() {
          _subjectErrorMessage = '❌ Failed to load subjects: Request timed out.';
          _isLoadingSubjects = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _subjectErrorMessage = '❌ Error loading subjects: ${e.toString()}';
          _isLoadingSubjects = false;
        });
      }
    }
  }

  // --- ⭐️ [ฟังก์ชันใหม่] เมื่อผู้ใช้เลือกวิชา ⭐️ ---
  void _onSubjectSelected(Subject subject) {
    setState(() {
      _selectedSubject = subject;
      // รีเซ็ตสถานะการเช็คอินเมื่อเลือกวิชาใหม่
      _statusMessage = 'Please verify location for "${subject.name}"';
      _isInGeofence = null;
      _currentPosition = null;
      _imageFile = null;
      _isCheckingIn = false;
      _isVerifyingLocation = false;
    });
  }

  // --- ⭐️ [ฟังก์ชันใหม่] เพื่อกลับไปหน้าเลือกวิชา ⭐️ ---
  void _resetToSubjectSelection() {
    setState(() {
      _selectedSubject = null;
      _isInGeofence = null;
      _currentPosition = null;
      _imageFile = null;
      _statusMessage = 'Please verify your location first';
      _isCheckingIn = false;
      _isVerifyingLocation = false;
      
      // อาจจะโหลดวิชาใหม่เผื่อมีการอัปเดต
      // _fetchSubjects(); 
    });
  }


  // --- ฟังก์ชันดึงตำแหน่ง (เหมือนเดิม) ---
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

  // --- ฟังก์ชันตรวจสอบ Geofence (เหมือนเดิม) ---
  Future<void> _verifyLocation() async {
    if (!mounted) return;
    setState(() { _isVerifyingLocation = true; _statusMessage = 'Getting your location...'; _isInGeofence = null; _currentPosition = null; });
    Position? position;
    try {
      position = await _getCurrentLocation();
      if (position == null || !mounted) { setState(() => _isVerifyingLocation = false); return; }
      if (!mounted) return; 
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

  // --- ฟังก์ชันถ่ายรูป (เหมือนเดิม) ---
  Future<void> _takePicture() async {
     if (!mounted) return; 
     setState(() { _statusMessage = 'Opening secure camera...'; _imageFile = null; });
     
     try {
        final dynamic photo = await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => const CheckInCameraPage(),
          ),
        );
        
        if (!mounted) return;
        
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


  // --- ⭐️ [แก้ไข] ฟังก์ชัน Check-in จริง (เพิ่ม subject_id) ⭐️ ---
  Future<void> _checkInWithPicture(File imageFile) async {
    // ⭐️ ตรวจสอบว่ามีวิชาเลือกหรือยัง
    if (_selectedSubject == null) {
      _updateStatus('❌ No subject selected. Please go back and select a subject.');
      return;
    }
    if (_currentPosition == null) { _updateStatus('❌ Location not verified. Please verify location first.'); return; }
    if (!mounted) return; 
    
    setState(() { _isCheckingIn = true; _statusMessage = 'Sending check-in data...'; _imageFile = imageFile; });
    
    try {
      final position = _currentPosition!;
      var request = http.MultipartRequest('POST', Uri.parse('$apiUrl/check-in'));
      request.headers['Authorization'] = 'Bearer ${widget.token}';
      
      // ⭐️ ส่งข้อมูล 4 อย่าง: รูป, lat, long, และ subject_id
      request.files.add(await http.MultipartFile.fromPath('image', imageFile.path));
      request.fields['latitude'] = position.latitude.toString(); 
      request.fields['longitude'] = position.longitude.toString();
      request.fields['subject_id'] = _selectedSubject!.id.toString(); // ⭐️⭐️ ส่ง ID วิชาไปด้วย
      
      var streamedResponse = await request.send().timeout(const Duration(seconds: 30));
       if (!mounted) return; 
       var response = await http.Response.fromStream(streamedResponse); 
       if (!mounted) return;

      if (response.statusCode == 200) { 
        setState(() { 
          _statusMessage = '✅ Check-in successful for ${_selectedSubject!.code}!'; 
          // รีเซ็ตสถานะ location แต่ไม่รีเซ็ตวิชา
          _isInGeofence = null; _currentPosition = null; _imageFile = null; 
        }); 
      }
      else { 
        final errorMsg = jsonDecode(response.body)['error'] ?? 'Unknown error ${response.statusCode}'; 
        setState(() { 
          _statusMessage = '❌ Check-in failed: $errorMsg'; 
          _isInGeofence = null; _currentPosition = null; _imageFile = null; 
        }); 
      }
    } on TimeoutException { if (mounted) { setState(() { _statusMessage = '❌ Check-in failed: Request timed out.'; _isInGeofence = null; _currentPosition = null; _imageFile = null; }); } }
    catch (e) { if (mounted) { setState(() => { _statusMessage = '❌ Check-in failed: ${e.toString()}', _isInGeofence = null, _currentPosition = null, _imageFile = null }); } }
    finally { if (mounted) { setState(() { _isCheckingIn = false; }); } }
  }

  // --- ⭐️ [แก้ไข] ฟังก์ชัน Update Status (ไม่รีเซ็ต _selectedSubject) ⭐️ ---
  void _updateStatus(String status) {
      if (mounted) { 
        setState(() { 
          _statusMessage = status; 
          _isCheckingIn = false; 
          _isVerifyingLocation = false; 
          _isInGeofence = null; 
          _currentPosition = null; 
          _imageFile = null; 
          // _selectedSubject ไม่ถูกรีเซ็ต
        }); 
      }
  }


  // --- ⭐️ [Build Method] แก้ไขใหม่ทั้งหมด ⭐️ ---
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar( 
        // ⭐️ แสดง Title ตามสถานะ และเพิ่มปุ่ม Back
        title: Text(_selectedSubject == null ? 'Select Subject' : 'Check-in: ${_selectedSubject!.code}'), 
        leading: _selectedSubject != null 
          ? IconButton(
              icon: const Icon(Icons.arrow_back), 
              onPressed: _resetToSubjectSelection, // ⭐️ กดแล้วกลับไปหน้าเลือกวิชา
              tooltip: 'Change Subject',
            ) 
          : null,
        actions: [ 
          IconButton(icon: const Icon(Icons.logout), onPressed: widget.onLogout, tooltip: 'Logout'), 
        ], 
      ),
      // ⭐️ Body จะแสดงผลต่างกันตามสถานะ
      body: _buildBody(),
    );
  }

  // ⭐️ [Widget ใหม่] ใช้ควบคุมการแสดงผลของ Body
  Widget _buildBody() {
    if (_isLoadingSubjects) {
      // 1. กำลังโหลดวิชา
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Loading your subjects...'),
          ],
        ),
      );
    }
    
    if (_subjectErrorMessage != null) {
      // 2. โหลดวิชาไม่สำเร็จ
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(_subjectErrorMessage!, style: const TextStyle(color: Colors.red, fontSize: 16), textAlign: TextAlign.center,),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: _fetchSubjects, 
                icon: const Icon(Icons.refresh), 
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_selectedSubject == null) {
      // 3. ⭐️ หน้าเลือกรายวิชา (แสดง Card)
      return _buildSubjectSelection();
    } else {
      // 4. ⭐️ หน้ากระบวนการเช็คอิน (Verify Location + Camera)
      return _buildCheckInProcess();
    }
  }

  // ⭐️ [Widget ใหม่] สำหรับแสดง Card เลือกรายวิชา
  Widget _buildSubjectSelection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: Text(
            'Welcome, ${widget.fullName}!',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
        ),
        const Padding(
          padding: EdgeInsets.fromLTRB(16.0, 0, 16.0, 10.0),
          child: Text(
            'Please select your subject to check-in:',
            style: TextStyle(fontSize: 16),
            textAlign: TextAlign.center,
          ),
        ),
        Expanded(
          child: _subjects.isEmpty
            // ⭐️⭐️ อัปเดตข้อความ ถ้า Server กรองแล้วไม่เหลือวิชา
            ? const Center(child: Padding(
                padding: EdgeInsets.all(20.0),
                child: Text(
                  'You are not enrolled in any active subjects.\nPlease contact your administrator.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 16),
                ),
              ))
            : ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 10.0),
                itemCount: _subjects.length,
                itemBuilder: (context, index) {
                  final subject = _subjects[index];
                  return Card(
                    elevation: 3,
                    margin: const EdgeInsets.symmetric(vertical: 6.0),
                    child: ListTile(
                      leading: const Icon(Icons.class_, color: Colors.blueAccent),
                      title: Text(subject.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text(subject.code),
                      trailing: const Icon(Icons.arrow_forward_ios_rounded),
                      onTap: () => _onSubjectSelected(subject),
                    ),
                  );
                },
              ),
        ),
      ],
    );
  }

  // ⭐️ [Widget ใหม่] ย้ายโค้ดส่วนเช็คอินเดิมมาไว้ที่นี่
  Widget _buildCheckInProcess() {
    return Center( 
      child: Padding( 
        padding: const EdgeInsets.all(16.0), 
        child: Column( 
          mainAxisAlignment: MainAxisAlignment.center, 
          children: <Widget>[
            // ⭐️ แสดงว่ากำลังเช็คอินวิชาอะไร
            Text( 
              'Checking in for: ${_selectedSubject!.name}', 
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold), 
              textAlign: TextAlign.center, 
            ),
            const SizedBox(height: 30),
            
            // แสดงรูป Preview ถ้าถ่ายแล้วและกำลัง check-in
            if (_imageFile != null && _isCheckingIn) ...[ 
              Image.file(_imageFile!, height: 150, width: 150, fit: BoxFit.cover), 
              const SizedBox(height: 15), 
            ],
            
            // แสดงข้อความสถานะ
            Text( 
              _statusMessage, 
              style: TextStyle( 
                fontSize: 16, 
                color: _statusMessage.startsWith('❌') ? Colors.red : (_statusMessage.startsWith('✅') ? Colors.green : Colors.black), 
              ), 
              textAlign: TextAlign.center, 
            ),
            const SizedBox(height: 30),
            
            // แสดงปุ่มตามสถานะ (เหมือนเดิม)
            if (_isVerifyingLocation || _isCheckingIn)
              const CircularProgressIndicator() // แสดง Loading
            else if (_isInGeofence == true)
              // อยู่ในโซน -> แสดงปุ่ม Check-in (เปิดกล้อง)
              ElevatedButton.icon( 
                onPressed: _takePicture, 
                icon: const Icon(Icons.camera_alt), 
                label: const Text('Check-in Now'), 
                style: ElevatedButton.styleFrom( padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 15), textStyle: const TextStyle(fontSize: 18), ), 
              )
            else
              // ยังไม่เช็ค หรือ อยู่นอกโซน -> แสดงปุ่ม Verify Location
              ElevatedButton.icon( 
                onPressed: _verifyLocation, 
                icon: const Icon(Icons.location_searching), 
                label: const Text('Verify Location'), 
                style: ElevatedButton.styleFrom( padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 15), textStyle: const TextStyle(fontSize: 18), ), 
              ),
          ], 
        ), 
      ), 
    );
  }

} // End of _SubjectSelectionPageState