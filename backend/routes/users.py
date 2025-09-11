from fastapi import APIRouter, UploadFile, Form, Depends
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.User import User
from deepface import DeepFace
import tempfile
import json
import numpy as np

router = APIRouter(prefix="/users", tags=["Users"])

# Dependency: DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Cosine similarity helper
def cosine_similarity(vec1, vec2):
    v1, v2 = np.array(vec1, dtype=float), np.array(vec2, dtype=float)
    v1, v2 = v1 / np.linalg.norm(v1), v2 / np.linalg.norm(v2)
    return float(np.dot(v1, v2))


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
            # 🔹 Use ArcFace + RetinaFace for embeddings
            rep = DeepFace.represent(
                img_path=tmp_path,
                model_name="ArcFace",
                detector_backend="retinaface",
                enforce_detection=True
            )
            if rep and "embedding" in rep[0]:
                embeddings.append(rep[0]["embedding"])

        except Exception as e:
            print(f"⚠️ Face not detected in one frame: {e}")
            continue

    if not embeddings:
        return {"error": "❌ No face detected. Try again!"}

    # Average embeddings for stability
    avg_embedding = np.mean(embeddings, axis=0).tolist()

    # Check against all existing users
    users = db.query(User).all()
    threshold = 0.7  # similarity threshold (tune if needed)

    for user in users:
        stored_embedding = json.loads(user.embedding)
        score = cosine_similarity(avg_embedding, stored_embedding)

        if score >= threshold:
            return {"error": f"User '{user.name}' is already registered with this face!"}

    # If same name but different face → allow (new row)
    new_user = User(name=name, embedding=json.dumps(avg_embedding))
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": f"✅ User {name} registered successfully!",
        "id": new_user.id,
        "images_used": len(embeddings)
    }