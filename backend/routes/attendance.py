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

router = APIRouter(prefix="/attendance", tags=["Attendance"])

# -------------------------
# DB session dependency
# -------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -------------------------
# Cosine similarity
# -------------------------
def cosine_similarity(vec1, vec2):
    v1, v2 = np.array(vec1, dtype=float), np.array(vec2, dtype=float)
    v1, v2 = v1 / np.linalg.norm(v1), v2 / np.linalg.norm(v2)
    return float(np.dot(v1, v2))

# -------------------------
# Detect faces (DeepFace embeddings)
# -------------------------
def detect_faces(tmp_path):
    faces = []
    try:
        # Use SAME model + detector as users.py -- Very Important otherwise Model won't work !!!
        reps = DeepFace.represent(
            img_path=tmp_path,
            model_name="ArcFace",  # must match users.py (Model and Detector)
            detector_backend="mtcnn",  # IMPORTANT COMMENT -- USE "RetinaFace" as detector if we deploy on cloud, but cannot use it on computer because very slow on CPUs, works perfect with GPUs
            enforce_detection=False
        )

        if isinstance(reps, dict):
            reps = [reps]

        for rep in reps:
            embedding = rep.get("embedding")
            box = rep.get("facial_area", {})
            w, h = box.get("w", 0), box.get("h", 0)
            confidence = rep.get("confidence", 1.0)

            # Filter invalid faces
            if w < 50 or h < 50:
                continue
            if w / (h + 1e-6) < 0.6 or w / (h + 1e-6) > 1.6:
                continue
            if confidence < 0.90:
                continue

            faces.append({
                "embedding": embedding,
                "facial_area": {
                    "x": int(box.get("x", 0)),
                    "y": int(box.get("y", 0)),
                    "w": int(w),
                    "h": int(h)
                }
            })

    except Exception as e:
        print("❌ Face detection failed completely:", e)

    return faces

# -------------------------
# Preview API (used for live camera preview)
# -------------------------
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
    threshold = 0.55  # similarity threshold

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

# -------------------------
# Mark Attendance API
# -------------------------
@router.post("/mark")
async def mark_attendance(
    action: str = Form(...),
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
    threshold = 0.55

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
            # -------------------------
            # Work Application Authentication
            # -------------------------
            if action == "work-application":
                results.append({
                    "name": best_match.name,
                    "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                    "status": "authenticated"
                })
                continue  # Skip attendance logging

            # -------------------------
            # Normal Attendance Flow
            # -------------------------
            record = db.query(Attendance).filter(
                Attendance.user_id == best_match.id,
                Attendance.date == today
            ).first()

            if not record:
                record = Attendance(user_id=best_match.id, date=today)
                db.add(record)

            # -------------------------
            # Check-In
            # -------------------------
            if action == "checkin":
                if record.check_out:
                    status = "already_checked_out"
                elif record.check_in:
                    status = "already_checked_in"
                else:
                    record.check_in = datetime.now().strftime("%H:%M:%S")
                    status = "checked_in"

            # -------------------------
            # Break Start
            # -------------------------
            elif action == "break_start":
                if not record.check_in:
                    status = "checkin_missing"
                elif record.check_out:
                    status = "already_checked_out"
                elif record.break_end:
                    status = "already_break_ended"  # no restart after ending
                elif record.break_start:
                    status = "already_on_break"
                else:
                    record.break_start = datetime.now().strftime("%H:%M:%S")
                    status = "break_started"

            # -------------------------
            # Break End
            # -------------------------
            elif action == "break_end":
                if not record.check_in:
                    status = "checkin_missing"
                elif record.check_out:
                    status = "already_checked_out"
                elif not record.break_start:
                    status = "break_not_started"
                elif record.break_end:
                    status = "already_break_ended"
                else:
                    record.break_end = datetime.now().strftime("%H:%M:%S")
                    status = "break_ended"

            # -------------------------
            # Checkout
            # -------------------------
            elif action == "checkout":
                if not record.check_in:
                    status = "checkin_missing"
                elif record.check_out:
                    status = "already_checked_out"
                elif record.break_start and not record.break_end:
                    status = "cannot_checkout_on_break"
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
            # -------------------------
            # No match found
            # -------------------------
            results.append({
                "name": "Unknown",
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": "unknown"
            })

    return {"results": results}