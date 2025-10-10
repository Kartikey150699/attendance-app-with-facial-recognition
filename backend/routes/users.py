from fastapi import APIRouter, UploadFile, Form, Depends, HTTPException, Query, File
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.User import User
from models.Attendance import Attendance
from deepface import DeepFace
import tempfile
import json
import numpy as np
import cv2
from pydantic import BaseModel
from typing import List, Optional

# Import refresh function from attendance
from routes.attendance import refresh_embeddings

router = APIRouter(prefix="/users", tags=["Users"])


# -------------------------
# Dependency: DB session
# -------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -------------------------
# Employee ID formatter
# -------------------------
def format_employee_id(user_id: int) -> str:
    return f"IFNT{user_id:03d}"


# -------------------------
# Cosine similarity helper
# -------------------------
def cosine_similarity(vec1, vec2):
    v1, v2 = np.array(vec1, dtype=float), np.array(vec2, dtype=float)
    v1, v2 = v1 / np.linalg.norm(v1), v2 / np.linalg.norm(v2)
    return float(np.dot(v1, v2))


# -------------------------
# Helper: apply synthetic mask and sunglasses 
# -------------------------
def apply_synthetic_mask(image_path):
    img = cv2.imread(image_path)
    if img is None:
        return None

    h, w, _ = img.shape
    mask_color = (0, 0, 0)
    y_start = int(h * 0.55)
    cv2.rectangle(img, (0, y_start), (w, h), mask_color, -1)

    tmp_masked = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
    cv2.imwrite(tmp_masked.name, img)
    return tmp_masked.name


@router.post("/preview-align")
async def preview_align(file: UploadFile = File(...)):
    import cv2, numpy as np, tempfile

    contents = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    img = cv2.imread(tmp_path)
    if img is None:
        return {"alignment": "bad", "message": "No face detected"}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = detector.detectMultiScale(gray, 1.1, 5)

    if len(faces) == 0:
        return {"alignment": "bad", "message": "No face detected"}

    (x, y, w, h) = faces[0]
    h_img, w_img, _ = img.shape
    face_center_x = x + w / 2
    face_center_y = y + h / 2
    frame_center_x = w_img / 2
    frame_center_y = h_img / 2

    offset_x = abs(face_center_x - frame_center_x) / w_img
    offset_y = abs(face_center_y - frame_center_y) / h_img
    face_area_ratio = (w * h) / (w_img * h_img)

    if offset_x > 0.25 or offset_y > 0.25:
        return {"alignment": "bad", "message": "Move to the center"}
    if face_area_ratio < 0.15:
        return {"alignment": "bad", "message": "Move closer"}
    if face_area_ratio > 0.50:
        return {"alignment": "bad", "message": "Move slightly back"}

    return {"alignment": "perfect", "message": "Perfect alignment"}


# -------------------------
# Register User (auto employee_id)
# -------------------------
@router.post("/register")
async def register_user(
    name: str = Form(...),
    files: List[UploadFile] = File(...),
    department: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No images uploaded")

    embeddings = []
    valid_frame_found = False  # Track at least one aligned frame

    for file in files:
        contents = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        try:
            # ------------------------------------------------------
            # (1) Adaptive Gamma + CLAHE Preprocessing
            # ------------------------------------------------------
            img = cv2.imread(tmp_path)
            if img is None:
                print("⚠️ Failed to read image — skipping.")
                continue

            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

            # Adaptive gamma correction
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            mean_intensity = np.mean(gray)
            gamma = 1.4 if mean_intensity < 110 else 1.0
            img = np.power(img / 255.0, gamma)
            img = np.uint8(img * 255)

            # CLAHE (Contrast Limited Adaptive Histogram Equalization)
            lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            l = clahe.apply(l)
            lab = cv2.merge((l, a, b))
            img = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)

            # Overwrite temp image with preprocessed version
            cv2.imwrite(tmp_path, cv2.cvtColor(img, cv2.COLOR_RGB2BGR))

            # ------------------------------------------------------
            # (2) Face Position + Framing Enforcement
            # ------------------------------------------------------
            detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            faces = detector.detectMultiScale(gray, 1.1, 5)

            if len(faces) == 0:
                raise HTTPException(status_code=400, detail="⚠️ No face detected. Please adjust camera.")

            (x, y, w, h) = faces[0]
            h_img, w_img, _ = img.shape
            face_center_x = x + w / 2
            face_center_y = y + h / 2
            frame_center_x = w_img / 2
            frame_center_y = h_img / 2

            offset_x = abs(face_center_x - frame_center_x) / w_img
            offset_y = abs(face_center_y - frame_center_y) / h_img
            face_area_ratio = (w * h) / (w_img * h_img)

            # Reject if face is off-center or too small
            if offset_x > 0.25 or offset_y > 0.25:
                raise HTTPException(
                    status_code=400,
                    detail="⚠️ Face not centered. Please align your face properly in the frame."
                )
            if face_area_ratio < 0.15:
                raise HTTPException(
                    status_code=400,
                    detail="⚠️ Face too far. Move closer to the camera."
                )

            valid_frame_found = True  # Alignment is correct, we can now register

            # ------------------------------------------------------
            # (3) Generate Embeddings (Normal + Masked)
            # ------------------------------------------------------
            rep = DeepFace.represent(
                img_path=tmp_path,
                model_name="ArcFace",
                detector_backend="mtcnn",
                enforce_detection=True
            )

            if isinstance(rep, dict):
                rep = [rep]
            if rep and "embedding" in rep[0]:
                emb = np.array(rep[0]["embedding"], dtype=float)
                emb /= np.linalg.norm(emb)
                embeddings.append(emb.tolist())

            # Masked embedding
            masked_path = apply_synthetic_mask(tmp_path)
            if masked_path:
                rep_mask = DeepFace.represent(
                    img_path=masked_path,
                    model_name="ArcFace",
                    detector_backend="mtcnn",
                    enforce_detection=False
                )
                if isinstance(rep_mask, dict):
                    rep_mask = [rep_mask]
                if rep_mask and "embedding" in rep_mask[0]:
                    emb2 = np.array(rep_mask[0]["embedding"], dtype=float)
                    emb2 /= np.linalg.norm(emb2)
                    embeddings.append(emb2.tolist())

        except HTTPException as he:
            # Raise directly for clear feedback
            raise he
        except Exception as e:
            print(f"⚠️ Frame skipped due to error: {e}")
            continue

    # ------------------------------------------------------
    # (4) Ensure at least one good frame
    # ------------------------------------------------------
    if not valid_frame_found:
        raise HTTPException(
            status_code=400,
            detail="❌ Registration failed. Please center your face and try again."
        )

    if not embeddings:
        raise HTTPException(status_code=400, detail="❌ No valid faces after preprocessing. Try again!")

    # ------------------------------------------------------
    # (5) Validation and Duplicate Checking
    # ------------------------------------------------------
    users = db.query(User).all()
    threshold = 0.55
    for user in users:
        stored_embeddings = json.loads(user.embedding)
        emb_list = stored_embeddings if isinstance(stored_embeddings[0], list) else [stored_embeddings]
        for stored_emb in emb_list:
            score = cosine_similarity(embeddings[0], stored_emb)
            if score >= threshold:
                raise HTTPException(
                    status_code=400,
                    detail=f"User '{user.name}' is already registered with this face!"
                )

    # ------------------------------------------------------
    # (6) Save New User + Assign Employee ID
    # ------------------------------------------------------
    new_user = User(
        name=name,
        embedding=json.dumps(embeddings),
        department=department
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    new_user.employee_id = format_employee_id(new_user.id)
    db.commit()
    db.refresh(new_user)

    # ------------------------------------------------------
    # (7) Refresh cache
    # ------------------------------------------------------
    refresh_embeddings()

    return {
        "message": f"✅ User {name} registered successfully!",
        "employee_id": new_user.employee_id,
        "department": new_user.department,
        "embeddings_stored": len(embeddings)
    }


# -------------------------
# Pydantic schema for updating user
# -------------------------
class UpdateUserRequest(BaseModel):
    current_employee_id: str
    new_name: Optional[str] = None
    new_department: Optional[str] = None


# -------------------------
# Update User (name + department)
# -------------------------
@router.put("/update-user")
async def update_user(payload: UpdateUserRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.employee_id == payload.current_employee_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"No user found with employee_id '{payload.current_employee_id}'")

    if payload.new_name:
        user.name = payload.new_name
    if payload.new_department is not None:
        user.department = payload.new_department

    db.commit()
    db.refresh(user)

    refresh_embeddings()

    return {
        "message": "✅ User updated successfully",
        "id": user.id,
        "employee_id": user.employee_id,
        "name": user.name,
        "department": user.department
    }


# -------------------------
# Hard Delete User (by employee_id)
# -------------------------
@router.delete("/delete-by-id/{employee_id}")
async def delete_user_by_id(employee_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.employee_id == employee_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"No user found with employee_id '{employee_id}'")

    # Preserve attendance history
    records = db.query(Attendance).filter(Attendance.user_id == user.id).all()
    for record in records:
        record.user_name_snapshot = user.name
        record.user_id = None

    db.delete(user)
    db.commit()

    refresh_embeddings()

    return {"message": f"🗑️ User {user.name} deleted successfully (attendance preserved)."}


# -------------------------
# Hard Delete User (by name)
# -------------------------
@router.delete("/delete-by-name/{name}")
async def delete_user_by_name(name: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.name == name).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"No user found with name '{name}'")

    # Preserve attendance history (For deleted users, Shown in the "Attendance Logs")
    records = db.query(Attendance).filter(Attendance.user_id == user.id).all()
    for record in records:
        record.user_name_snapshot = user.name
        record.user_id = None

    db.delete(user)
    db.commit()

    refresh_embeddings()

    return {"message": f"🗑️ User {user.name} deleted successfully (attendance preserved)."}


# -------------------------
# List Users (active / deleted toggle)
# -------------------------
@router.get("/list")
async def list_users(
    show_deleted: bool = Query(False, description="Set true to include deleted users"),
    db: Session = Depends(get_db)
):
    if show_deleted:
        deleted_records = db.query(Attendance).filter(Attendance.user_id == None).all()
        return [
            {
                "id": r.id,
                "employee_id": "DELETED",
                "name": r.user_name_snapshot or "Unknown",
                "department": None,
                "created_at": r.date.isoformat(),
            }
            for r in deleted_records
        ]
    else:
        users = db.query(User).all()
        return [
            {
                "id": u.id,
                "employee_id": u.employee_id,
                "name": u.name,
                "department": u.department,
                "created_at": u.created_at.isoformat(),
            }
            for u in users
        ]


# -------------------------
# Legacy support for frontend (Fetch basic details to the React server)
# -------------------------
@router.get("/active")
async def legacy_active_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "employee_id": u.employee_id,
            "name": u.name,
            "department": u.department,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


# -------------------------
# List deleted users
# -------------------------
@router.get("/deleted")
def get_deleted_users(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.is_active == False).all()
    return [
        {
            "id": u.id,
            "employee_id": u.employee_id or "DELETED",
            "name": u.name,
            "department": u.department,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]