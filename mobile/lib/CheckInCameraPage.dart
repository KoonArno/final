// File: mobile/lib/CheckInCameraPage.dart
// (ไฟล์นี้เหมือนเดิมจากครั้งที่แล้ว ไม่ต้องแก้ไข)
import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

enum LivenessStep { searching, blinkDetected, completed }

class CheckInCameraPage extends StatefulWidget {
  const CheckInCameraPage({super.key});
  @override
  State<CheckInCameraPage> createState() => _CheckInCameraPageState();
}

class _CheckInCameraPageState extends State<CheckInCameraPage> {
  LivenessStep _currentStep = LivenessStep.searching;
  String _statusText = 'Please position your face and BLINK';
  bool _isProcessing = false;
  bool _isCapturing = false;
  CameraController? _cameraController;
  FaceDetector? _faceDetector;
  bool _isCameraInitialized = false;
  Timer? _statusResetTimer;
  bool _isBlinking = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializeCameraAndAI();
    });
  }

  @override
  void dispose() {
    _statusResetTimer?.cancel();
    final controller = _cameraController;
    if (controller != null) {
      if (controller.value.isStreamingImages) {
        controller.stopImageStream().catchError((e) {
          print("Error stopping image stream: $e");
        });
      }
      controller.dispose().catchError((e) {
        print("Error disposing camera: $e");
      });
    }
    _faceDetector?.close();
    _cameraController = null;
    super.dispose();
  }

  Future<void> _initializeCameraAndAI() async {
    if (!mounted) return;
    try {
      _faceDetector = FaceDetector(
        options: FaceDetectorOptions(
          performanceMode: FaceDetectorMode.fast,
          enableTracking: true,
          minFaceSize: 0.3,
          enableClassification: true, // ⭐️ ต้องเป็น true
          enableLandmarks: false,
          enableContours: false,
        ),
      );

      final cameras = await availableCameras();
      if (!mounted) return;
      if (cameras.isEmpty) {
        setState(() => _statusText = 'Error: No cameras available.');
        return;
      }
      final frontCamera = cameras.firstWhere(
        (cam) => cam.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      _cameraController = CameraController(
        frontCamera,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: Platform.isAndroid
            ? ImageFormatGroup.nv21
            : ImageFormatGroup.bgra8888,
      );
      _cameraController!.addListener(() {
        if (mounted && _cameraController!.value.hasError) {
          print('Camera Error: ${_cameraController!.value.errorDescription}');
          if (!_isCapturing) {
            setState(() => _statusText = 'Camera error: ${_cameraController!.value.errorDescription}');
          }
        }
      });
      await _cameraController!.initialize();
      if (!mounted) {
        await _cameraController?.dispose();
        _cameraController = null;
        return;
      }
      setState(() { _isCameraInitialized = true; });
      await _cameraController!.startImageStream(_processImageStream);
    } catch (e) {
      if (mounted) {
        setState(() { _statusText = 'Error initializing camera/AI: ${e.toString()}'; _isCameraInitialized = false; });
      }
      print("Initialization Error: $e");
      await _cameraController?.dispose();
      _faceDetector?.close();
      _cameraController = null;
      _faceDetector = null;
    }
  }

  void _processImageStream(CameraImage image) {
    if (_isProcessing || _isCapturing || _faceDetector == null || !_isCameraInitialized || !mounted || _cameraController == null || !_cameraController!.value.isInitialized || !_cameraController!.value.isStreamingImages) {
      return;
    }
    _isProcessing = true;
    final camera = _cameraController!.description;
    final sensorOrientation = camera.sensorOrientation;
    InputImageRotation imageRotation;
    final orientations = {
      DeviceOrientation.portraitUp: 0,
      DeviceOrientation.landscapeLeft: 90,
      DeviceOrientation.portraitDown: 180,
      DeviceOrientation.landscapeRight: 270,
    };
    var rotationCompensation = orientations[DeviceOrientation.portraitUp] ?? 0;
    if (camera.lensDirection == CameraLensDirection.front) {
      rotationCompensation = (sensorOrientation + rotationCompensation) % 360;
    } else {
      rotationCompensation = (sensorOrientation - rotationCompensation + 360) % 360;
    }
    imageRotation = InputImageRotationValue.fromRawValue(rotationCompensation) ?? InputImageRotation.rotation0deg;
    if (image.planes.isEmpty || image.planes[0].bytes.isEmpty) {
      _isProcessing = false;
      return;
    }
    final InputImage inputImage = InputImage.fromBytes(
      bytes: _concatenatePlanes(image.planes),
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: imageRotation,
        format: InputImageFormatValue.fromRawValue(image.format.raw) ?? (Platform.isAndroid ? InputImageFormat.nv21 : InputImageFormat.bgra8888),
        bytesPerRow: image.planes[0].bytesPerRow,
      ),
    );
    _faceDetector!.processImage(inputImage).then((faces) {
      if (mounted) _handleLivenessDetection(faces);
    }).catchError((error) {
      print("Face Detection Error: $error");
    }).whenComplete(() {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _isProcessing = false;
      });
    });
  }

  Uint8List _concatenatePlanes(List<Plane> planes) {
    if (planes.length == 1) return planes[0].bytes;
    final WriteBuffer allBytes = WriteBuffer();
    for (Plane plane in planes) { allBytes.putUint8List(plane.bytes); }
    return allBytes.done().buffer.asUint8List();
  }

  void _handleLivenessDetection(List<Face> faces) {
    if (!mounted || _isCapturing || _currentStep == LivenessStep.completed) return;
    _statusResetTimer?.cancel();
    if (faces.isEmpty) {
      setState(() => _statusText = 'No face detected. Look at camera.');
      _resetStatusAfterDelay();
      return;
    }
    if (faces.length > 1) {
      setState(() => _statusText = 'Multiple faces detected. Only you.');
      _resetStatusAfterDelay();
      return;
    }
    final Face face = faces.first;
    final double? leftEyeOpenProb = face.leftEyeOpenProbability;
    final double? rightEyeOpenProb = face.rightEyeOpenProbability;
    if (leftEyeOpenProb != null && rightEyeOpenProb != null) {
      if (leftEyeOpenProb < 0.2 && rightEyeOpenProb < 0.2) {
        _isBlinking = true;
        if (mounted) setState(() => _statusText = 'Blink detected!');
      }
      if (_isBlinking && leftEyeOpenProb > 0.8 && rightEyeOpenProb > 0.8) {
        if (mounted) {
          setState(() {
            _statusText = '✅ Liveness confirmed! Capturing...';
            _currentStep = LivenessStep.completed;
          });
        }
        _captureAndReturnFace();
      }
    } else {
        if (mounted && !_isBlinking) setState(() => _statusText = 'Please blink at the camera');
    }
  }

  void _resetStatusAfterDelay() {
    _statusResetTimer?.cancel();
    _statusResetTimer = Timer(const Duration(seconds: 3), () {
      if (mounted && _currentStep != LivenessStep.completed && !_isCapturing && !_isProcessing) {
        setState(() {
          _statusText = 'Please position your face and BLINK';
          _isBlinking = false;
        });
      }
    });
  }

  Future<void> _captureAndReturnFace() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized || !mounted || _isCapturing) {
      return;
    }
    setState(() => _isCapturing = true);
    try {
      if (_cameraController!.value.isStreamingImages) {
        await _cameraController!.stopImageStream();
      }
    } catch (e) {
      print("Error stopping stream: $e");
      if (mounted) {
        setState(() { _statusText = 'Error preparing camera. Please retry.'; _isCapturing = false; _currentStep = LivenessStep.searching; });
      }
      return;
    }
    if (!mounted) return;
    try {
      final XFile photo = await _cameraController!.takePicture();
      if (!mounted) return;
      Navigator.pop(context, photo);
    } catch (e) {
      if (mounted) {
        setState(() {
          _statusText = '❌ Error capturing: ${e.toString()}. Please try again.';
          _isCapturing = false;
          _currentStep = LivenessStep.searching;
        });
        if (_cameraController != null && _cameraController!.value.isInitialized && !(_cameraController!.value.isStreamingImages)) {
          _cameraController!.startImageStream(_processImageStream);
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // ... (โค้ด Build Method เหมือนเดิม) ...
    Color borderColor = Colors.grey;
    if (_isCapturing) {
      borderColor = Colors.blue;
    } else if (_isBlinking) {
      borderColor = Colors.yellow;
    } else if (_currentStep == LivenessStep.searching) {
      borderColor = Colors.green;
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Liveness Check (Blink)')),
      body: Builder(builder: (context) {
        if (!_isCameraInitialized || _cameraController == null || !_cameraController!.value.isInitialized) {
          return Center( child: Padding( padding: const EdgeInsets.all(16.0), child: Text( _statusText.startsWith('Error') ? _statusText : 'Initializing Camera...', style: TextStyle(color: _statusText.startsWith('Error') ? Colors.red : Colors.black, fontSize: 16), textAlign: TextAlign.center, ) ) );
        }
        
        return LayoutBuilder(
          builder: (context, constraints) {
            final previewSize = _cameraController!.value.previewSize;
            var previewRatio = 1.0;
            if (previewSize != null && previewSize.width != 0 && previewSize.height != 0) {
              previewRatio = previewSize.height / previewSize.width;
            }
            final bool isFrontCamera = _cameraController!.description.lensDirection == CameraLensDirection.front;

            return Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: constraints.maxWidth,
                  height: constraints.maxHeight,
                  child: FittedBox(
                    fit: BoxFit.cover,
                    child: SizedBox(
                      width: previewSize?.height ?? constraints.maxWidth,
                      height: previewSize?.width ?? constraints.maxHeight,
                      child: Transform(
                        alignment: Alignment.center,
                        transform: Matrix4.identity()..scale(isFrontCamera ? -1.0 : 1.0, 1.0),
                        child: CameraPreview(_cameraController!)
                      ),
                    ),
                  ),
                ),
                Positioned(
                  bottom: 50, left: 20, right: 20,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 20),
                    decoration: BoxDecoration( color: Colors.black.withOpacity(0.7), borderRadius: BorderRadius.circular(20), ),
                    child: Text( _statusText, style: const TextStyle(color: Colors.white, fontSize: 16), textAlign: TextAlign.center, ),
                  ),
                ),
                Center(
                  child: Container(
                    decoration: BoxDecoration(
                      border: Border.all( color: borderColor, width: 4.0, ),
                      borderRadius: BorderRadius.all(Radius.elliptical(constraints.maxWidth * 0.35, constraints.maxHeight * 0.3)),
                    ),
                    width: constraints.maxWidth * 0.7,
                    height: constraints.maxHeight * 0.6,
                  ),
                ),
                if (_isCapturing)
                  Positioned.fill(
                    child: Container(
                      color: Colors.black.withOpacity(0.6),
                      child: const Center(child: CircularProgressIndicator())
                    )
                  ),
              ],
            );
          }
        );
      }),
    );
  }
}