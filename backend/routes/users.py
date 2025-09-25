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
# Helper: apply synthetic mask
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
    for file in files:
        contents = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        try:
            # Normal embedding
            rep = DeepFace.represent(
                img_path=tmp_path,
                model_name="ArcFace",
                detector_backend="mtcnn",
                enforce_detection=True
            )
            if isinstance(rep, dict):
                rep = [rep]
            if rep and "embedding" in rep[0]:
                embeddings.append(rep[0]["embedding"])

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
                    embeddings.append(rep_mask[0]["embedding"])
        except Exception as e:
            print(f"⚠️ Face not detected in one frame: {e}")
            continue

    if not embeddings:
        raise HTTPException(status_code=400, detail="❌ No face detected. Try again!")

    # Prevent duplicate face registration
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

    # Create new user without employee_id first
    new_user = User(
        name=name,
        embedding=json.dumps(embeddings),
        department=department
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate employee_id after we know the auto-incremented ID
    new_user.employee_id = format_employee_id(new_user.id)
    db.commit()
    db.refresh(new_user)

    # Refresh cache
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
# Legacy support for frontend
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