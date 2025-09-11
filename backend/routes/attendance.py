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


# Utility: detect faces + embeddings (ArcFace + RetinaFace with fallback)
def detect_faces(tmp_path):
    faces = []
    try:
        reps = DeepFace.represent(
            img_path=tmp_path,
            model_name="ArcFace",          # strong embeddings
            detector_backend="retinaface", # robust detector
            enforce_detection=False
        )

        # DeepFace may return dict or list
        if isinstance(reps, dict):
            reps = [reps]

        for rep in reps:
            embedding = rep.get("embedding")
            box = rep.get("facial_area", {})

            faces.append({
                "embedding": embedding,
                "facial_area": {
                    "x": int(box.get("x", 0)),
                    "y": int(box.get("y", 0)),
                    "w": int(box.get("w", 0)),
                    "h": int(box.get("h", 0))
                }
            })

    except Exception as e:
        print("⚠️ RetinaFace failed, trying MTCNN:", e)
        try:
            reps = DeepFace.represent(
                img_path=tmp_path,
                model_name="ArcFace",
                detector_backend="mtcnn",  # fallback detector
                enforce_detection=False
            )
            if isinstance(reps, dict):
                reps = [reps]

            for rep in reps:
                embedding = rep.get("embedding")
                box = rep.get("facial_area", {})

                faces.append({
                    "embedding": embedding,
                    "facial_area": {
                        "x": int(box.get("x", 0)),
                        "y": int(box.get("y", 0)),
                        "w": int(box.get("w", 0)),
                        "h": int(box.get("h", 0))
                    }
                })
        except Exception as e2:
            print("❌ Face detection failed completely:", e2)

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


# 🟡 Mark endpoint (DB write) — supports checkin, checkout, break_start, break_end
@router.post("/mark")
async def mark_attendance(
    action: str = Form(...),  # "checkin", "checkout", "break_start", "break_end"
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
            from models.Attendance import Attendance
            record = db.query(Attendance).filter(
                Attendance.user_id == best_match.id,
                Attendance.date == today
            ).first()

            if not record:
                record = Attendance(user_id=best_match.id, date=today)
                db.add(record)

            if action == "checkin":
                if record.check_in:
                    status = "already_checked_in"
                else:
                    record.check_in = datetime.now().strftime("%H:%M:%S")
                    status = "checked_in"

            elif action == "break_start":
                if not record.check_in:
                    status = "checkin_missing"
                elif record.break_start:
                    status = "already_on_break"
                else:
                    record.break_start = datetime.now().strftime("%H:%M:%S")
                    status = "break_started"

            elif action == "break_end":
                if not record.break_start:
                    status = "break_not_started"
                elif record.break_end:
                    status = "already_break_ended"
                else:
                    record.break_end = datetime.now().strftime("%H:%M:%S")
                    status = "break_ended"

            elif action == "checkout":
                if not record.check_in:
                    status = "checkin_missing"
                elif record.check_out:
                    status = "already_checked_out"
                else:
                    record.check_out = datetime.now().strftime("%H:%M:%S")
                    status = "checked_out"

            else:
                status = "invalid_action"

            db.commit()
            db.refresh(record)

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