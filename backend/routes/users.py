from fastapi import APIRouter, UploadFile, Form, Depends, HTTPException, Query, File
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.User import User
from models.Attendance import Attendance
from deepface import DeepFace
import tempfile
import json
import cv2, numpy as np, tempfile
from pydantic import BaseModel
from typing import List, Optional

# Import refresh function from attendance
from routes.attendance import refresh_embeddings
router = APIRouter(prefix="/users", tags=["Users"])

# -------------------------
# Unified cache refresh helper (backend + frontend)
# -------------------------
def refresh_all_caches():
    """Refresh both backend and frontend embedding caches."""
    try:
        from app import refresh_embedding_cache  # lazy import avoids circular dependency
        refresh_embeddings()
        refresh_embedding_cache()
        print("✅ Embedding caches refreshed successfully (users.py)")
    except Exception as e:
        print(f"⚠️ Cache refresh skipped: {e}")

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
# Cosine similarity helper (robust version)
# -------------------------
def cosine_similarity(vec1, vec2):
    v1, v2 = np.array(vec1, dtype=float), np.array(vec2, dtype=float)

    # 🧠 Handle multi-embedding cases (e.g. (20,512))
    if v1.ndim > 1:
        v1 = np.mean(v1, axis=0)
    if v2.ndim > 1:
        v2 = np.mean(v2, axis=0)

    # 🧹 Normalize safely
    v1 /= np.linalg.norm(v1) + 1e-8
    v2 /= np.linalg.norm(v2) + 1e-8

    # 🔢 Return cosine similarity
    return float(np.dot(v1, v2))

# -------------------------
# Helper: advanced illumination normalization (Tan–Triggs + CLAHE)
# -------------------------
def normalize_lighting(img):
    # Convert to float and normalize
    img = np.float32(img) / 255.0
    img = np.log1p(img)                     # logarithmic compression
    img = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX)
    img = np.uint8(img)

    # Apply CLAHE on L channel
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    l = clahe.apply(l)
    lab = cv2.merge((l, a, b))
    img = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
    return img


# -------------------------
# Helper: compute image sharpness (for weighted averaging)
# -------------------------
def sharpness_score(img):
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()

# -------------------------
# Helper: compute weighted mean embedding
# -------------------------
def weighted_mean_embeddings(embeddings, weights):
    weights = np.array(weights)
    weights = weights / np.sum(weights)
    return np.sum(np.array(embeddings) * weights[:, None], axis=0)


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


# -------------------------
# Simplified alignment endpoint (frontend handles alignment)
# -------------------------
@router.post("/preview-align")
async def preview_align(file: UploadFile = File(...)):
    """
    This endpoint is kept only for compatibility.
    The frontend now performs all face alignment and distance checks.
    """
    return {"alignment": "perfect", "message": "Alignment handled on frontend"}


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
    # ------------------------------------------------------
    # (0) Normalize input
    # ------------------------------------------------------
    name = " ".join(name.split())  # trims edges + reduces multiple spaces
    if department:
        department = " ".join(department.split())

    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No images uploaded")

    embeddings = []
    valid_frame_found = False  # Track at least one valid frame

    for file in files:
        contents = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        try:
            # ------------------------------------------------------
            # (1) Advanced Preprocessing (Lighting + Gamma + Sharpness)
            # ------------------------------------------------------
            img = cv2.imread(tmp_path)
            if img is None:
                print("⚠️ Failed to read image — skipping.")
                continue

            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

            # Tan–Triggs illumination normalization
            img = normalize_lighting(img)

            # Adaptive gamma correction (brighten if dark)
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            mean_intensity = np.mean(gray)
            gamma = 1.4 if mean_intensity < 110 else 1.0
            img = np.power(img / 255.0, gamma)
            img = np.uint8(img * 255)

            # Compute image sharpness
            sharpness = sharpness_score(img)

            # Save processed image
            cv2.imwrite(tmp_path, cv2.cvtColor(img, cv2.COLOR_RGB2BGR))

            # ------------------------------------------------------
            # (2) Face Detection Only — no alignment or center checks
            # ------------------------------------------------------
            detector = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            faces = detector.detectMultiScale(gray, 1.1, 5)

            if len(faces) == 0:
                raise HTTPException(status_code=400, detail="⚠️ No face detected. Please adjust camera.")

            valid_frame_found = True

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
                embeddings.append((emb, sharpness))  # store embedding + sharpness

            # Masked embedding for robustness
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
                    embeddings.append((emb2, sharpness * 0.8))

        except HTTPException as he:
            raise he
        except Exception as e:
            print(f"⚠️ Frame skipped due to error: {e}")
            continue

    # ------------------------------------------------------
    # (4) Ensure at least one good frame
    # ------------------------------------------------------
    if not valid_frame_found or not embeddings:
        raise HTTPException(
            status_code=400,
            detail="❌ Registration failed. Ensure good lighting and visible face."
        )

    # ------------------------------------------------------
    # (5) Weighted + Median Embedding Fusion (Stable Identity)
    # ------------------------------------------------------
    emb_vectors = [e[0] for e in embeddings]
    weights = np.array([e[1] for e in embeddings])
    weights = weights / np.sum(weights)

    # Weighted mean (based on sharpness)
    weighted_mean = np.sum([w * v for w, v in zip(weights, emb_vectors)], axis=0)

    # Median embedding (robust to outliers / lighting variance)
    median_embedding = np.median(np.array(emb_vectors), axis=0)

    # Fuse both for best stability
    final_embedding = (weighted_mean + median_embedding) / 2.0
    final_embedding /= np.linalg.norm(final_embedding)

    # ------------------------------------------------------
    # (5.5) Adaptive user threshold based on embedding stability
    # ------------------------------------------------------
    emb_matrix = np.vstack(emb_vectors)
    sims = np.dot(emb_matrix, emb_matrix.T)
    upper_tri = sims[np.triu_indices_from(sims, k=1)]
    mean_sim = float(np.mean(upper_tri))

    # Dynamic threshold rule:
    if mean_sim > 0.88:
        user_threshold = 0.42
    elif mean_sim > 0.82:
        user_threshold = 0.40
    elif mean_sim > 0.78:
        user_threshold = 0.38
    else:
        user_threshold = 0.36

    # ------------------------------------------------------
    # (6) Validation — Check duplicates (by face only)
    # ------------------------------------------------------
    users = db.query(User).all()
    threshold = 0.55  # similarity threshold for duplicate faces

    # 🔹 Allow same names, only block similar embeddings
    for user in users:
        stored_emb = np.array(json.loads(user.embedding), dtype=float)
        score = cosine_similarity(final_embedding, stored_emb)
        if score >= threshold:
            raise HTTPException(
                status_code=400,
                detail=f"⚠️ A similar face already exists in the system (User: {user.name})."
            )

    # ------------------------------------------------------
    # (7) Save User + Generate Employee ID
    # ------------------------------------------------------
    new_user = User(
        name=name,
        embedding=json.dumps(final_embedding.tolist()),
        department=department,
        threshold=user_threshold 
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    new_user.employee_id = format_employee_id(new_user.id)
    db.commit()
    db.refresh(new_user)

    # ------------------------------------------------------
    # (8) Refresh embeddings cache
    # ------------------------------------------------------
    refresh_all_caches()

    return {
        "message": f"✅ User {name} registered successfully!",
        "employee_id": new_user.employee_id,
        "department": new_user.department,
        "frames_processed": len(files),
        "final_embedding_dim": len(final_embedding),
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

    refresh_all_caches()

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

    refresh_all_caches()

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

    refresh_all_caches()

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

# -------------------------
# Export embeddings for frontend (Hybrid Mode)
# -------------------------
@router.get("/embeddings")
async def get_embeddings_for_frontend(db: Session = Depends(get_db)):
    """
    Returns cached user embeddings for frontend instant recognition.
    """
    users = db.query(User).all()
    data = []
    for u in users:
        try:
            emb = json.loads(u.embedding)
            data.append({
                "employee_id": u.employee_id,
                "name": u.name,
                "embedding": emb,
                "threshold": u.threshold
            })
        except Exception as e:
            print(f"⚠️ Skipped user {u.name}: {e}")
    return {"count": len(data), "users": data}