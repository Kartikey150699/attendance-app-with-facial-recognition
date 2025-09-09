from fastapi import APIRouter, UploadFile, Form, Depends
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.User import User
from deepface import DeepFace
import tempfile
import json

router = APIRouter(prefix="/users", tags=["Users"])

# Dependency: DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/register")
async def register_user(name: str = Form(...), file: UploadFile = None, db: Session = Depends(get_db)):
    if not file:
        return {"error": "No image uploaded"}

    # Save uploaded file temporarily
    contents = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    # Extract embedding with DeepFace
    try:
        embedding_obj = DeepFace.represent(img_path=tmp_path, model_name="Facenet")[0]
        embedding = embedding_obj["embedding"]
    except Exception as e:
        return {"error": f"Face not detected: {str(e)}"}

    # Save to DB
    user = User(name=name, embedding=json.dumps(embedding))
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": f"User {name} registered successfully!", "id": user.id}
