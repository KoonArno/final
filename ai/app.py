# File: face-attendance-system/ai/app.py
# (เวอร์ชัน FastAPI, Facenet512, RetinaFace)

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from deepface import DeepFace
import numpy as np
import json
import io
import cv2
from deepface.modules import verification
import traceback
import os
from typing import List # For type hinting

app = FastAPI() # ⭐️ สร้าง FastAPI instance

# --- Configuration ---
DEEPFACE_THRESHOLD = 0.30 # 👈 ค่า Threshold สำหรับ Facenet512 + Cosine (ปรับจูนตามต้องการ)
DEEPFACE_MODEL = "Facenet512" # 👈 เปลี่ยน Model
DEEPFACE_METRIC = "cosine"
DETECTOR_BACKEND = 'retinaface' # 👈 เปลี่ยน Detector

# --- Pre-load models ---
try:
    print("Pre-building/loading DeepFace models...")
    print(f"Model: {DEEPFACE_MODEL}, Detector: {DETECTOR_BACKEND}")
    DeepFace.build_model(DEEPFACE_MODEL)
    # RetinaFace มักจะถูกโหลดเมื่อเรียกใช้ ไม่จำเป็นต้อง build_model แยก
    print("DeepFace models ready.")
except Exception as build_error:
    print(f"Warning: Error pre-building DeepFace models: {build_error}")


# --- Helper Function: อ่านรูปจาก UploadFile ---
async def read_image_from_uploadfile(file: UploadFile) -> np.ndarray | None:
    """Reads image bytes from UploadFile and decodes with OpenCV."""
    try:
        image_data = await file.read()
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR) # Reads as BGR
        if img is None:
            print("Error: Could not decode image")
            return None
        return img
    except Exception as e:
        print(f"Error reading/decoding image: {e}")
        return None

# --- Endpoints (สไตล์ FastAPI) ---

@app.get('/')
async def home():
    """Root endpoint to check if the service is running."""
    return {"message": f"AI Service (FastAPI/DeepFace with {DEEPFACE_MODEL} Model & {DETECTOR_BACKEND} Detector) is Running! 🧠"}

@app.post('/verify-face')
async def verify_face(
    image: UploadFile = File(...), # ⭐️ รับไฟล์รูป
    embedding: str = Form(...)     # ⭐️ รับ embedding เป็น form data
):
    """Verifies a face image against a stored embedding."""
    print(f"AI SERVICE (FastAPI/{DEEPFACE_MODEL}/{DETECTOR_BACKEND}): Received face verification request...")

    # --- อ่านรูปใหม่ ---
    img_new = await read_image_from_uploadfile(image)
    if img_new is None:
        raise HTTPException(status_code=400, detail="Could not read or decode the uploaded image.")

    try:
        # --- อ่าน Embedding เก่า ---
        stored_embedding = np.array(json.loads(embedding), dtype=np.float32)

        # --- สร้าง Embedding จากรูปใหม่ ---
        new_embedding_objs = DeepFace.represent(
            img_path = img_new,
            model_name = DEEPFACE_MODEL,
            enforce_detection = True,
            detector_backend = DETECTOR_BACKEND
        )

        if not new_embedding_objs or "embedding" not in new_embedding_objs[0]:
             raise HTTPException(status_code=500, detail="Failed to extract embedding from the new image.")

        new_embedding = np.array(new_embedding_objs[0]["embedding"], dtype=np.float32)

        # --- คำนวณระยะห่าง ---
        distance = verification.find_distance(
             stored_embedding,
             new_embedding,
             DEEPFACE_METRIC
         )
        distance = float(distance)
        is_match = distance <= DEEPFACE_THRESHOLD # ⭐️ ใช้ Threshold ใหม่

        print(f"AI SERVICE (FastAPI/{DEEPFACE_MODEL}/{DETECTOR_BACKEND}): Comparison complete. Distance: {distance:.4f}, Threshold: {DEEPFACE_THRESHOLD}, Match: {is_match}")

        return {"match": bool(is_match), "distance": distance}

    except ValueError as ve: # Handle errors from enforce_detection
         error_message = str(ve)
         print(f"DeepFace ValueError during verification: {error_message}")
         user_error = "Face detection error during verification."
         if "Face could not be detected" in error_message: user_error = "Could not detect face clearly."
         elif "exactly 1 face" in error_message: user_error = "Multiple faces detected."
         raise HTTPException(status_code=400, detail=f"DeepFace Error: {user_error}")
    except json.JSONDecodeError:
         print("Error decoding stored embedding JSON.")
         raise HTTPException(status_code=400, detail="Invalid format for stored embedding.")
    except Exception as e:
        traceback.print_exc()
        print(f"AI Error during verification: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal AI error during face processing.")


@app.post('/register-face')
async def register_face(image: UploadFile = File(...)): # ⭐️ รับไฟล์รูปอย่างเดียว
    """Registers a face by extracting its embedding."""
    print(f"AI SERVICE (FastAPI/{DEEPFACE_MODEL}/{DETECTOR_BACKEND}): Received face registration request...")

    # --- อ่านรูปภาพ ---
    img_register = await read_image_from_uploadfile(image)
    if img_register is None:
        raise HTTPException(status_code=400, detail="Could not read or decode the registration image.")

    try:
        # --- สกัด Embedding ---
        embedding_objs = DeepFace.represent(
            img_path = img_register,
            model_name = DEEPFACE_MODEL, # ⭐️ ใช้โมเดลใหม่
            enforce_detection = True,
            detector_backend = DETECTOR_BACKEND # ⭐️ ใช้ detector ใหม่
        )

        # Allow only one face for registration
        if len(embedding_objs) > 1:
             print(f"Warning: Found {len(embedding_objs)} faces during registration. Rejecting.")
             raise HTTPException(status_code=400, detail="Multiple faces detected. Please ensure only your face is clearly visible.")
        # Check if embedding extraction worked (enforce_detection should handle 'no face')
        if not embedding_objs or "embedding" not in embedding_objs[0]:
             raise HTTPException(status_code=500, detail="Failed to extract embedding during registration.")

        embedding: List[float] = embedding_objs[0]["embedding"] # Type hint for clarity

        print(f"AI SERVICE (FastAPI/{DEEPFACE_MODEL}/{DETECTOR_BACKEND}): Successfully extracted embedding.")
        # FastAPI automatically converts the list to JSON
        return {"embedding": embedding}

    except ValueError as ve: # Handle errors from enforce_detection
         error_message = str(ve)
         print(f"DeepFace ValueError during registration: {error_message}")
         user_error = "Face detection error during registration."
         if "Face could not be detected" in error_message: user_error = "Could not detect face clearly."
         # The multiple faces case is handled above now
         raise HTTPException(status_code=400, detail=f"DeepFace Error: {user_error}")
    except Exception as e:
        traceback.print_exc()
        print(f"AI Error during registration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal AI error during face processing.")

# --- Uvicorn entry point (ไม่จำเป็นสำหรับ Docker) ---
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=5001)