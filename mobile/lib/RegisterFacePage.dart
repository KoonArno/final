// File: mobile/lib/RegisterFacePage.dart
// (เวอร์ชันล่าสุด: ใช้ camera + mlkit, แก้ไข enum/import/rotation)

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data'; // Import for Uint8List
import 'package:flutter/foundation.dart'; // Import for WriteBuffer
import 'package:flutter/material.dart';
import 'package:flutter/services.dart'; // Import for DeviceOrientation
import 'package:http/http.dart' as http;
import 'package:mobile/main.dart'; // Import main.dart to use apiUrl
import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

// Moved Enum outside the class
enum LivenessStep { lookStraight, turnLeft, turnRight, completed }

class RegisterFacePage extends StatefulWidget {
  final String token;
  final String fullName;
  final VoidCallback onRegistrationSuccess;

  const RegisterFacePage({
    super.key,
    required this.token,
    required this.fullName,
    required this.onRegistrationSuccess,
  });

  @override
  State<RegisterFacePage> createState() => _RegisterFacePageState();
}

class _RegisterFacePageState extends State<RegisterFacePage> {
  // Use the top-level Enum
  LivenessStep _currentStep = LivenessStep.lookStraight;
  String _statusText = 'Please look straight and hold still';
  bool _isProcessing = false;
  bool _isUploading = false;

  CameraController? _cameraController;
  FaceDetector? _faceDetector;
  bool _isCameraInitialized = false;
  Timer? _statusResetTimer;

  @override
  void initState() {
    super.initState();
    // Wrap initialization in a try-catch block for better error handling
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializeCameraAndAI();
    });
  }

  @override
  void dispose() {
    _statusResetTimer?.cancel();
    // Ensure controller is disposed only if initialized and not already disposed
    // Use a temporary variable to avoid race conditions if _cameraController is set to null
    final controller = _cameraController;
    if (controller != null) {
      // Stop stream before disposing if it's running
      if (controller.value.isStreamingImages) {
        controller.stopImageStream().catchError((e) {
          print("Error stopping image stream during dispose: $e");
        });
      }
      // Dispose the controller
      controller.dispose().catchError((e) {
        print("Error disposing camera controller: $e");
      });
    }
    _faceDetector?.close();
    _cameraController = null; // Set to null after dispose attempts
    super.dispose();
  }

  Future<void> _initializeCameraAndAI() async {
    if (!mounted) return;

    try {
      _faceDetector = FaceDetector(
        options: FaceDetectorOptions(
          performanceMode: FaceDetectorMode.fast,
          enableTracking: true, // Tracking helps maintain face ID across frames
          minFaceSize: 0.3,
          // Disable unnecessary options for this simple liveness check
          enableClassification: false,
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
            ? ImageFormatGroup
                  .nv21 // Preferred format for ML Kit on Android
            : ImageFormatGroup.bgra8888, // Preferred format for ML Kit on iOS
      );

      // Listen for errors on the controller
      _cameraController!.addListener(() {
        if (mounted && _cameraController!.value.hasError) {
          print(
            'Camera Controller Error: ${_cameraController!.value.errorDescription}',
          );
          // Update UI only if not uploading (to avoid overwriting upload status)
          if (!_isUploading) {
            setState(
              () => _statusText =
                  'Camera error: ${_cameraController!.value.errorDescription}',
            );
          }
        }
      });

      await _cameraController!.initialize();
      if (!mounted) {
        // Check if widget was disposed during initialization
        await _cameraController?.dispose(); // Clean up if unmounted
        _cameraController = null;
        return;
      }

      setState(() {
        _isCameraInitialized = true;
      });

      // Start stream only if initialized successfully
      await _cameraController!.startImageStream(_processImageStream);
    } catch (e) {
      if (mounted) {
        setState(() {
          _statusText = 'Error initializing camera/AI: ${e.toString()}';
          _isCameraInitialized = false; // Mark as not initialized on error
        });
      }
      print("Initialization Error: $e");
      await _cameraController?.dispose();
      _faceDetector?.close();
      _cameraController = null;
      _faceDetector = null;
    }
  }

  void _processImageStream(CameraImage image) {
    // Add more checks before processing
    if (_isProcessing ||
        _isUploading ||
        _faceDetector == null ||
        !_isCameraInitialized ||
        !mounted ||
        _cameraController == null ||
        !_cameraController!.value.isInitialized ||
        !_cameraController!.value.isStreamingImages) {
      return;
    }

    _isProcessing = true;

    final camera = _cameraController!.description;
    final sensorOrientation = camera.sensorOrientation;
    InputImageRotation imageRotation;

    // Improved rotation calculation logic
    // From google_mlkit_commons example: https://github.com/flutter-ml/google_ml_kit_flutter/blob/master/packages/google_mlkit_commons/example/lib/camera_view.dart
    // Note: Getting actual device orientation usually requires `flutter/services.dart` and listening to orientation changes.
    // This simplified version assumes portrait most of the time.
    final orientations = {
      DeviceOrientation.portraitUp: 0,
      DeviceOrientation.landscapeLeft: 90,
      DeviceOrientation.portraitDown: 180,
      DeviceOrientation.landscapeRight: 270,
    };
    // For simplicity, assuming portraitUp. For robust solution, get actual device orientation.
    var rotationCompensation = orientations[DeviceOrientation.portraitUp] ?? 0;
    if (camera.lensDirection == CameraLensDirection.front) {
      rotationCompensation = (sensorOrientation + rotationCompensation) % 360;
    } else {
      // back camera
      rotationCompensation =
          (sensorOrientation - rotationCompensation + 360) % 360;
    }
    imageRotation =
        InputImageRotationValue.fromRawValue(rotationCompensation) ??
        InputImageRotation.rotation0deg;

    // Ensure we have planes and bytes before proceeding
    if (image.planes.isEmpty || image.planes[0].bytes.isEmpty) {
      print("Warning: Image stream provided empty plane or bytes.");
      _isProcessing = false; // Reset flag if image is invalid
      return;
    }

    final InputImage inputImage = InputImage.fromBytes(
      bytes: _concatenatePlanes(image.planes),
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: imageRotation,
        // Use the actual format from the CameraImage
        format:
            InputImageFormatValue.fromRawValue(image.format.raw) ??
            (Platform.isAndroid
                ? InputImageFormat.nv21
                : InputImageFormat.bgra8888),
        bytesPerRow: image.planes[0].bytesPerRow,
      ),
    );

    // Asynchronously process the image
    _faceDetector!
        .processImage(inputImage)
        .then((faces) {
          if (mounted) _handleLivenessDetection(faces);
        })
        .catchError((error) {
          print("Face Detection Error: $error");
          // Optionally show error to user if detection fails consistently
          // if (mounted) setState(() => _statusText = 'Error detecting face');
        })
        .whenComplete(() {
          // Schedule the reset of _isProcessing flag for the next frame
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _isProcessing = false;
          });
        });
  }

  Uint8List _concatenatePlanes(List<Plane> planes) {
    // Check if concatenation is necessary (only for formats like YUV420)
    if (planes.length == 1) {
      return planes[0].bytes;
    }
    // If multiple planes, concatenate
    final WriteBuffer allBytes = WriteBuffer();
    for (Plane plane in planes) {
      allBytes.putUint8List(plane.bytes);
    }
    return allBytes.done().buffer.asUint8List();
  }

  void _handleLivenessDetection(List<Face> faces) {
    if (!mounted) return;
    _statusResetTimer?.cancel();

    if (_isUploading) return; // Don't process if already uploading

    // Give feedback based on face detection results
    if (faces.isEmpty) {
      if (mounted)
        setState(
          () => _statusText =
              'No face detected. Please position your face in the oval.',
        );
      _resetStatusAfterDelay();
      return;
    }
    if (faces.length > 1) {
      if (mounted)
        setState(
          () => _statusText =
              'Multiple faces detected. Please ensure only your face is visible.',
        );
      _resetStatusAfterDelay();
      return;
    }

    final Face face = faces.first;
    final double? headAngleY = face.headEulerAngleY; // Can be null

    // Provide clearer instructions based on current step and angle
    switch (_currentStep) {
      case LivenessStep.lookStraight:
        // Increase tolerance slightly for looking straight
        if (headAngleY != null && headAngleY.abs() < 15) {
          if (mounted) {
            setState(() {
              _statusText = 'Great! Now, slowly turn left';
              _currentStep = LivenessStep.turnLeft;
            });
          }
        } else {
          if (mounted)
            setState(() => _statusText = 'Look straight at the camera');
        }
        break;

      case LivenessStep.turnLeft:
        // Angle threshold for left turn (e.g., > 30 degrees)
        if (headAngleY != null && headAngleY > 30) {
          if (mounted) {
            setState(() {
              _statusText = 'Excellent! Now, slowly turn right';
              _currentStep = LivenessStep.turnRight;
            });
          }
        } else {
          if (mounted)
            setState(() => _statusText = 'Turn your head slowly left');
        }
        break;

      case LivenessStep.turnRight:
        // Angle threshold for right turn (e.g., < -30 degrees)
        if (headAngleY != null && headAngleY < -30) {
          if (mounted) {
            setState(() {
              _statusText = '✅ Scan complete! Capturing image...';
              _currentStep = LivenessStep.completed;
            });
          }
          _captureAndUploadFace(); // Trigger capture and upload
        } else {
          if (mounted)
            setState(() => _statusText = 'Turn your head slowly right');
        }
        break;

      case LivenessStep.completed:
        break; // Already done
    }
  }

  void _resetStatusAfterDelay() {
    _statusResetTimer?.cancel();
    _statusResetTimer = Timer(const Duration(seconds: 3), () {
      // Longer delay
      // Check flags again before resetting state
      if (mounted &&
          _currentStep != LivenessStep.completed &&
          !_isUploading &&
          !_isProcessing) {
        setState(() {
          // Reset status based on the step the user is stuck on
          switch (_currentStep) {
            case LivenessStep.lookStraight:
              _statusText = 'Please look straight and hold still';
              break;
            case LivenessStep.turnLeft:
              _statusText = 'Slowly turn left';
              break;
            case LivenessStep.turnRight:
              _statusText = 'Slowly turn right';
              break;
            case LivenessStep.completed:
              break;
          }
        });
      }
    });
  }

  Future<void> _captureAndUploadFace() async {
    // Ensure controller is valid and widget is mounted before proceeding
    if (_cameraController == null ||
        !_cameraController!.value.isInitialized ||
        !mounted) {
      print("Capture failed: Camera not ready or widget unmounted.");
      if (mounted)
        setState(() => _statusText = 'Camera not ready. Cannot capture.');
      // Optionally try to re-initialize or guide user
      return;
    }

    setState(() => _isUploading = true);

    // Stop stream safely before taking picture
    try {
      if (_cameraController!.value.isStreamingImages) {
        await _cameraController!.stopImageStream();
      }
    } catch (e) {
      print("Error stopping image stream before capture: $e");
      if (mounted) {
        setState(() {
          _statusText = 'Error preparing camera. Please retry.';
          _isUploading = false; // Allow retry
          _currentStep = LivenessStep.lookStraight; // Reset challenge
        });
        // Attempt to restart stream? Risky if controller state is bad.
        // _initializeCameraAndAI(); // Consider re-initializing fully
      }
      return; // Stop execution
    }

    try {
      // Short delay might help ensure stream is fully stopped, test if needed
      // await Future.delayed(Duration(milliseconds: 100));

      // Check mounted state again right before capture
      if (!mounted) return;

      final XFile photo = await _cameraController!.takePicture();
      if (!mounted) return;

      setState(() => _statusText = 'Image captured! Uploading...');

      var request = http.MultipartRequest(
        'POST',
        Uri.parse('$apiUrl/register-my-face'),
      );
      request.headers['Authorization'] = 'Bearer ${widget.token}';
      request.files.add(await http.MultipartFile.fromPath('image', photo.path));

      var streamedResponse = await request.send().timeout(
        const Duration(seconds: 30),
      ); // Add timeout
      if (!mounted) return;

      var response = await http.Response.fromStream(streamedResponse);
      if (!mounted) return;

      if (response.statusCode == 200) {
        setState(() => _statusText = '✅ Face registered successfully!');
        await Future.delayed(const Duration(seconds: 1));
        if (mounted)
          widget.onRegistrationSuccess(); // Call callback only if mounted
      } else {
        final errorMsg =
            jsonDecode(response.body)['error'] ??
            'Unknown error ${response.statusCode}';
        if (mounted) {
          setState(() {
            _statusText =
                '❌ Registration upload failed: $errorMsg. Please try again.';
            _isUploading = false;
            _currentStep = LivenessStep.lookStraight; // Reset challenge
          });
          // Try restarting stream for retry ONLY if controller seems okay
          if (_cameraController != null &&
              _cameraController!.value.isInitialized &&
              !(_cameraController!.value.isStreamingImages)) {
            await _cameraController!
                .startImageStream(_processImageStream)
                .catchError((e) {
                  print("Error restarting stream after failed upload: $e");
                  if (mounted)
                    setState(
                      () => _statusText = 'Camera stream error. Please retry.',
                    );
                });
          } else if (mounted) {
            // If controller is bad, inform user
            setState(
              () => _statusText =
                  'Camera error after failed upload. Please restart the app.',
            );
          }
        }
      }
    } on TimeoutException {
      if (mounted) {
        setState(() {
          _statusText =
              '❌ Registration failed: Upload timed out. Please try again.';
          _isUploading = false;
          _currentStep = LivenessStep.lookStraight;
          // Try restarting stream
          if (_cameraController != null &&
              _cameraController!.value.isInitialized &&
              !(_cameraController!.value.isStreamingImages)) {
            _cameraController!.startImageStream(_processImageStream);
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _statusText =
              '❌ Error during capture/upload: ${e.toString()}. Please try again.';
          _isUploading = false;
          _currentStep = LivenessStep.lookStraight;
        });
        // Attempt to restart stream safely
        if (_cameraController != null &&
            _cameraController!.value.isInitialized &&
            !(_cameraController!.value.isStreamingImages)) {
          await _cameraController!
              .startImageStream(_processImageStream)
              .catchError((err) {
                print("Error restarting stream after exception: $err");
                if (mounted)
                  setState(
                    () => _statusText = 'Camera stream error. Please retry.',
                  );
              });
        } else if (mounted &&
            (_cameraController == null ||
                !_cameraController!.value.isInitialized)) {
          if (mounted)
            setState(
              () => _statusText =
                  '❌ Camera error after failure. Please restart app.',
            );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    Color borderColor = Colors.grey;
    if (_isUploading) {
      borderColor = Colors.blue;
    } else {
      switch (_currentStep) {
        case LivenessStep.lookStraight:
          borderColor = Colors.green;
          break;
        case LivenessStep.turnLeft:
        case LivenessStep.turnRight:
          borderColor = Colors.yellow;
          break;
        case LivenessStep.completed:
          borderColor = Colors.blue;
          break;
      }
    }

    return Scaffold(
      appBar: AppBar(title: const Text('First-time Setup: Face Scan')),
      body: Builder(
        builder: (context) {
          // Show error or loading based on initialization status
          if (!_isCameraInitialized ||
              _cameraController == null ||
              !_cameraController!.value.isInitialized) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                // Show status text (might contain error message) or default loading
                child: Text(
                  _statusText.startsWith('Error')
                      ? _statusText
                      : 'Initializing Camera...',
                  style: TextStyle(
                    color: _statusText.startsWith('Error')
                        ? Colors.red
                        : Colors.black,
                    fontSize: 16,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }

          // Use LayoutBuilder to get constraints for proper scaling of CameraPreview
          return LayoutBuilder(
            builder: (context, constraints) {
              final previewSize = _cameraController!
                  .value
                  .previewSize; // Size of the preview frame from camera
              final screenRatio =
                  constraints.maxWidth /
                  constraints
                      .maxHeight; // Aspect ratio of the available screen space
              var previewRatio = 1.0; // Default aspect ratio
              // Camera preview aspect ratio might be inverse (height/width) in portrait
              if (previewSize != null &&
                  previewSize.width != 0 &&
                  previewSize.height != 0) {
                previewRatio =
                    previewSize.height /
                    previewSize.width; // Use height/width for portrait preview
              }

              var scale = 1.0;
              // Calculate scale to cover the screen area while maintaining aspect ratio
              if (screenRatio > previewRatio) {
                // Screen is wider than preview -> scale to match screen height
                scale =
                    constraints.maxHeight /
                    (previewSize?.width ?? constraints.maxHeight);
              } else {
                // Screen is taller (or same ratio) than preview -> scale to match screen width
                scale =
                    constraints.maxWidth /
                    (previewSize?.height ?? constraints.maxWidth);
              }
              // For front camera, apply horizontal flip using Transform.scale
              final bool isFrontCamera =
                  _cameraController!.description.lensDirection ==
                  CameraLensDirection.front;

              return Stack(
                alignment: Alignment.center,
                children: [
                  // Center the scaled and potentially flipped preview
                  // Use FittedBox for simpler scaling to cover
                  SizedBox(
                    width: constraints.maxWidth,
                    height: constraints.maxHeight,
                    child: FittedBox(
                      fit: BoxFit.cover, // Ensures the preview covers the area
                      child: SizedBox(
                        width:
                            previewSize?.height ??
                            constraints
                                .maxWidth, // Use swapped dimensions for portrait
                        height: previewSize?.width ?? constraints.maxHeight,
                        child: Transform(
                          alignment: Alignment.center,
                          transform: Matrix4.identity()
                            ..scale(
                              isFrontCamera ? -1.0 : 1.0,
                              1.0,
                            ), // Apply flip if front camera
                          child: CameraPreview(_cameraController!),
                        ),
                      ),
                    ),
                  ),

                  // Status Text Overlay
                  Positioned(
                    bottom: 50,
                    left: 20,
                    right: 20,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        vertical: 10,
                        horizontal: 20,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.7),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        _statusText,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),

                  // Oval Overlay Border - Centered, size relative to screen
                  Center(
                    child: Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: borderColor, width: 4.0),
                        // Use borderRadius on rectangle for oval shape
                        // Adjust ellipse size based on screen dimensions for better fit
                        borderRadius: BorderRadius.all(
                          Radius.elliptical(
                            constraints.maxWidth * 0.35,
                            constraints.maxHeight * 0.3,
                          ),
                        ),
                      ),
                      width:
                          constraints.maxWidth *
                          0.7, // Oval width relative to screen width
                      height:
                          constraints.maxHeight *
                          0.6, // Oval height relative to screen height
                    ),
                  ),

                  // Loading indicator during upload, covering the screen
                  if (_isUploading)
                    Positioned.fill(
                      child: Container(
                        color: Colors.black.withOpacity(0.6),
                        child: const Center(child: CircularProgressIndicator()),
                      ),
                    ),
                ],
              );
            },
          );
        },
      ),
    );
  }
}
