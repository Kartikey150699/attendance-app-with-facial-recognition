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
import cv2

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
# Detect faces (MTCNN + ArcFace, fallback OpenCV DNN for masked faces)
# -------------------------
def detect_faces(tmp_path):
    faces = []

    try:
        # Primary detector: MTCNN
        reps = DeepFace.represent(
            img_path=tmp_path,
            model_name="ArcFace",
            detector_backend="mtcnn",
            enforce_detection=False
        )

        if isinstance(reps, dict):
            reps = [reps]

        for rep in reps:
            embedding = rep.get("embedding")
            box = rep.get("facial_area", {})
            w, h = box.get("w", 0), box.get("h", 0)
            confidence = rep.get("confidence", 1.0)

            # Filter invalid
            if w < 50 or h < 50:
                continue
            if w / (h + 1e-6) < 0.6 or w / (h + 1e-6) > 1.6:
                continue
            if confidence < 0.90:
                continue

            faces.append({
                "embedding": embedding,
                "facial_area": {"x": int(box.get("x", 0)), "y": int(box.get("y", 0)),
                                "w": int(w), "h": int(h)}
            })

    except Exception as e:
        print("⚠️ MTCNN failed:", e)

    # -------------------------
    # Fallback: OpenCV Haar Cascade (lightweight, handles masks decently)
    # -------------------------
    if not faces:
        try:
            img = cv2.imread(tmp_path)
            h, w = img.shape[:2]

            modelFile = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            face_cascade = cv2.CascadeClassifier(modelFile)

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            detected = face_cascade.detectMultiScale(gray, 1.1, 4)

            for (x, y, fw, fh) in detected:
                face_crop = img[y:y+fh, x:x+fw]
                if face_crop.size == 0:
                    continue

                rep = DeepFace.represent(
                    img_path=face_crop,
                    model_name="ArcFace",
                    detector_backend="skip",
                    enforce_detection=False
                )

                if isinstance(rep, dict):
                    rep = [rep]

                for r in rep:
                    faces.append({
                        "embedding": r.get("embedding"),
                        "facial_area": {"x": int(x), "y": int(y), "w": int(fw), "h": int(fh)}
                    })

        except Exception as e:
            print("❌ OpenCV fallback failed:", e)

    return faces


# -------------------------
# Preview API (live camera preview)
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
    threshold = 0.55

    for face in faces:
        embedding = face.get("embedding")
        box = face.get("facial_area", {})
        best_match, best_score = None, -1

        if embedding is not None:
            for user in users:
                stored_embeddings = json.loads(user.embedding)

                # Ensure stored_embeddings is always a list of vectors
                if isinstance(stored_embeddings[0], (int, float)):
                    stored_embeddings = [stored_embeddings]

                for stored_emb in stored_embeddings:
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
                stored_embeddings = json.loads(user.embedding)

                # Ensure stored_embeddings is always a list of vectors
                if isinstance(stored_embeddings[0], (int, float)):
                    stored_embeddings = [stored_embeddings]

                for stored_emb in stored_embeddings:
                    score = cosine_similarity(embedding, stored_emb)
                    if score > best_score:
                        best_match, best_score = user, score

        print(f"➡️ Action: {action}, Match: {best_match.name if best_match else None}, Score: {best_score}")

        if best_match and best_score >= threshold:

            # Work Application Authentication
            if action == "work-application":
                results.append({
                    "name": best_match.name,
                    "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                    "status": "authenticated"
                })
                continue

            # Normal Attendance Flow
            record = db.query(Attendance).filter(
                Attendance.user_id == best_match.id,
                Attendance.date == today
            ).first()

            if not record:
                record = Attendance(user_id=best_match.id, date=today)
                db.add(record)

            if action == "checkin":
                if record.check_out:
                    status = "already_checked_out"
                elif record.check_in:
                    status = "already_checked_in"
                else:
                    record.check_in = datetime.now().strftime("%H:%M:%S")
                    status = "checked_in"

            elif action == "break_start":
                if not record.check_in:
                    status = "checkin_missing"
                elif record.check_out:
                    status = "already_checked_out"
                elif record.break_end:
                    status = "already_break_ended"
                elif record.break_start:
                    status = "already_on_break"
                else:
                    record.break_start = datetime.now().strftime("%H:%M:%S")
                    status = "break_started"

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
            results.append({
                "name": "Unknown",
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": "unknown"
            })

    return {"results": results}