from fastapi import APIRouter, UploadFile, Form, Depends
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.User import User
from deepface import DeepFace
import tempfile
import json
import numpy as np
import cv2

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
# Cosine similarity helper
# -------------------------
def cosine_similarity(vec1, vec2):
    v1, v2 = np.array(vec1, dtype=float), np.array(vec2, dtype=float)
    v1, v2 = v1 / np.linalg.norm(v1), v2 / np.linalg.norm(v2)
    return float(np.dot(v1, v2))


# -------------------------
# Helper: apply synthetic mask (simple rectangle over lower half of face)
# -------------------------
def apply_synthetic_mask(image_path):
    img = cv2.imread(image_path)
    if img is None:
        return None

    h, w, _ = img.shape
    mask_color = (0, 0, 0)  # black mask
    y_start = int(h * 0.55)  # lower half of face
    cv2.rectangle(img, (0, y_start), (w, h), mask_color, -1)

    # Save to temporary file
    tmp_masked = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
    cv2.imwrite(tmp_masked.name, img)
    return tmp_masked.name


# -------------------------
# Register User
# -------------------------
@router.post("/register")
async def register_user(
    name: str = Form(...),
    files: list[UploadFile] = None,   # multiple screenshots from frontend
    db: Session = Depends(get_db)
):
    if not files or len(files) == 0:
        return {"error": "No images uploaded"}

    embeddings = []

    # Process uploaded frames
    for file in files:
        contents = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        try:
            # -------------------------
            # Normal embedding (MTCNN + ArcFace)
            # -------------------------
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

            # -------------------------
            # Masked embedding (synthetic mask applied)
            # -------------------------
            masked_path = apply_synthetic_mask(tmp_path)
            if masked_path:
                rep_mask = DeepFace.represent(
                    img_path=masked_path,
                    model_name="ArcFace",
                    detector_backend="mtcnn",
                    enforce_detection=False  # allow lower confidence
                )

                if isinstance(rep_mask, dict):
                    rep_mask = [rep_mask]

                if rep_mask and "embedding" in rep_mask[0]:
                    embeddings.append(rep_mask[0]["embedding"])

        except Exception as e:
            print(f"⚠️ Face not detected in one frame: {e}")
            continue

    if not embeddings:
        return {"error": "❌ No face detected. Try again!"}

    # -------------------------
    # Save all embeddings (not averaged)
    # -------------------------
    users = db.query(User).all()
    threshold = 0.55

    for user in users:
        stored_embeddings = json.loads(user.embedding)

        # Check against all embeddings of that user
        for stored_emb in stored_embeddings if isinstance(stored_embeddings[0], list) else [stored_embeddings]:
            score = cosine_similarity(embeddings[0], stored_emb)
            if score >= threshold:
                return {"error": f"User '{user.name}' is already registered with this face!"}

    # If same name but different face → allow new row
    new_user = User(name=name, embedding=json.dumps(embeddings))
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": f"✅ User {name} registered successfully!",
        "id": new_user.id,
        "embeddings_stored": len(embeddings)
    }