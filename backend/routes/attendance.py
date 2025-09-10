from fastapi import APIRouter, UploadFile, Form, Depends
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.User import User
from models.Attendance import Attendance
from deepface import DeepFace
import tempfile
import json
import numpy as np
from datetime import date, datetime
import cv2   # 👈 OpenCV

# ✅ Router definition
router = APIRouter(prefix="/attendance", tags=["Attendance"])


# DB session dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Cosine similarity function
def cosine_similarity(vec1, vec2):
    v1, v2 = np.array(vec1, dtype=float), np.array(vec2, dtype=float)
    v1, v2 = v1 / np.linalg.norm(v1), v2 / np.linalg.norm(v2)
    return float(np.dot(v1, v2))


# Utility: detect faces + embeddings
def detect_faces(tmp_path):
    img = cv2.imread(tmp_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    detected_faces = detector.detectMultiScale(gray, 1.3, 5)

    faces = []
    for (x, y, w, h) in detected_faces:
        face_crop = img[y:y+h, x:x+w]

        try:
            rep = DeepFace.represent(face_crop, model_name="Facenet", enforce_detection=False)
            embedding = rep[0]["embedding"]
        except Exception:
            embedding = None

        faces.append({
            "embedding": embedding,
            "facial_area": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)}
        })
    return faces


# 🟢 Preview endpoint (NO DB writes)
@router.post("/preview")
async def preview_faces(file: UploadFile = None, db: Session = Depends(get_db)):
    if not file:
        return {"error": "No image uploaded"}

    contents = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    faces = detect_faces(tmp_path)
    if not faces:
        return {"results": []}

    results = []
    users = db.query(User).all()
    threshold = 0.6

    for face in faces:
        embedding = face.get("embedding")
        box = face.get("facial_area", {})
        best_match, best_score = None, -1

        if embedding is not None:
            for user in users:
                stored_emb = json.loads(user.embedding)
                score = cosine_similarity(embedding, stored_emb)
                if score > best_score:
                    best_match, best_score = user, score

        if best_match and best_score >= threshold:
            results.append({
                "name": best_match.name,
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": "preview"
            })
        else:
            results.append({
                "name": "Unknown",
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": "unknown"
            })

    return {"results": results}


# 🟡 Mark endpoint (DB write)
@router.post("/mark")
async def mark_attendance(
    action: str = Form(...),  # "checkin" or "checkout"
    file: UploadFile = None,
    db: Session = Depends(get_db),
):
    if not file:
        return {"error": "No image uploaded"}

    contents = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    faces = detect_faces(tmp_path)
    if not faces:
        return {"results": []}

    results = []
    today = date.today()
    action = action.lower().strip()
    users = db.query(User).all()
    threshold = 0.6

    for face in faces:
        embedding = face.get("embedding")
        box = face.get("facial_area", {})
        best_match, best_score = None, -1

        if embedding is not None:
            for user in users:
                stored_emb = json.loads(user.embedding)
                score = cosine_similarity(embedding, stored_emb)
                if score > best_score:
                    best_match, best_score = user, score

        print(f"➡️ Action: {action}, Match: {best_match.name if best_match else None}, Score: {best_score}")

        if best_match and best_score >= threshold:
            # find today's record
            record = db.query(Attendance).filter(
                Attendance.user_id == best_match.id,
                Attendance.date == today
            ).first()

            if action == "checkin":
                if record and record.check_in:
                    status = "already_checked_in"
                else:
                    if not record:
                        record = Attendance(user_id=best_match.id, date=today)
                        db.add(record)
                    record.check_in = datetime.now().strftime("%H:%M:%S")
                    record.status = "Present"
                    db.commit()
                    db.refresh(record)
                    status = "checked_in"

            elif action == "checkout":
                if not record or not record.check_in:
                    status = "checkin_missing"
                elif record.check_out:
                    status = "already_checked_out"
                else:
                    record.check_out = datetime.now().strftime("%H:%M:%S")
                    record.status = "Present"
                    db.commit()
                    db.refresh(record)
                    status = "checked_out"

            else:
                status = "invalid_action"

            results.append({
                "name": best_match.name,
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": status
            })
        else:
            results.append({
                "name": "Unknown",
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": "unknown"
            })

    return {"results": results}
