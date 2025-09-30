from fastapi import APIRouter, UploadFile, Form, Depends, Query
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.User import User
from models.Attendance import Attendance
from models.Holiday import Holiday
from models.WorkApplication import WorkApplication
from deepface import DeepFace
import tempfile
import json
import numpy as np
import cv2
from datetime import date, datetime, timezone, timedelta
from calendar import monthrange

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
# JST timezone
# -------------------------
JST = timezone(timedelta(hours=9))

# -------------------------
# Cosine similarity (vectorized version will be used inside)
# -------------------------
def cosine_similarity(vec1, vec2):
    v1, v2 = np.array(vec1, dtype=float), np.array(vec2, dtype=float)
    v1, v2 = v1 / np.linalg.norm(v1), v2 / np.linalg.norm(v2)
    return float(np.dot(v1, v2))

# -------------------------
# Embedding Cache in Memory
# -------------------------
embedding_cache = []  # list of dicts (id, name, embeddings, np_embeddings)

def load_embeddings(db: Session):
    """Load all active user embeddings into memory cache."""
    global embedding_cache
    users = db.query(User).filter(User.is_active == True).all()
    cache = []
    for user in users:
        try:
            stored_embeddings = json.loads(user.embedding)
            if isinstance(stored_embeddings[0], (int, float)):
                stored_embeddings = [stored_embeddings]
            np_embs = np.array(stored_embeddings, dtype=float)
            # normalize once for fast cosine similarity
            np_embs = np_embs / np.linalg.norm(np_embs, axis=1, keepdims=True)
            cache.append({
                "id": user.id,
                "name": user.name,
                "embeddings": stored_embeddings,
                "np_embeddings": np_embs
            })
        except Exception as e:
            print(f"⚠️ Failed to load embeddings for {user.name}: {e}")
    embedding_cache = cache
    print(f"Loaded {len(embedding_cache)} users into embedding cache.")

# initialize cache at startup
with SessionLocal() as db:
    load_embeddings(db)

def refresh_embeddings():
    """Call this after adding/removing/updating users."""
    with SessionLocal() as db:
        load_embeddings(db)

# -------------------------
# Helper: calculate total work
# -------------------------
def calculate_total_work(record: Attendance):
    """Recalculate total working hours (excluding break) and update the record."""
    if record.check_in and record.check_out:
        try:
            total = record.check_out - record.check_in
            if record.break_start and record.break_end:
                total -= (record.break_end - record.break_start)
            total_minutes = total.total_seconds() // 60
            hours, minutes = divmod(total_minutes, 60)
            record.total_work = f"{int(hours)}h {int(minutes)}m"
        except Exception as e:
            print("⚠️ Error calculating total work:", e)
            record.total_work = "-"
    else:
        record.total_work = "-"

# -------------------------
# Detect faces using Neural Networks (MTCNN + ArcFace, fallback OpenCV Haar for masks)
# -------------------------
def detect_faces(tmp_path):
    faces = []
    try:
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
        print("⚠️ MTCNN failed:", e)

    # Fallback OpenCV Haar
    if not faces:
        try:
            img = cv2.imread(tmp_path)
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
                        "facial_area": {
                            "x": int(x),
                            "y": int(y),
                            "w": int(fw),
                            "h": int(fh)
                        }
                    })
        except Exception as e:
            print("❌ OpenCV fallback failed:", e)

    return faces

# -------------------------
# Vectorized Matching Helper
# -------------------------
def find_best_match(embedding, threshold, fallback_threshold=0.0):
    embedding = np.array(embedding, dtype=float)
    embedding = embedding / np.linalg.norm(embedding)

    best_match, best_score = None, -1
    for user in embedding_cache:
        sims = np.dot(user["np_embeddings"], embedding)
        score = float(np.max(sims))
        if score > best_score:
            best_match, best_score = user, score

    if best_match and best_score >= threshold:
        return best_match, best_score, "match"
    elif best_match and best_score >= fallback_threshold:
        return best_match, best_score, "maybe"
    else:
        return None, best_score, "unknown"

# -------------------------
# Preview API
# -------------------------
@router.post("/preview")
async def preview_faces(file: UploadFile = None):
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
    threshold = 0.55

    for face in faces:
        embedding = face.get("embedding")
        box = face.get("facial_area", {})
        best_match, best_score, status = find_best_match(embedding, threshold)

        if status == "match":
            results.append({
                "name": best_match["name"],
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
    employee_id: str = Form(None),
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
    threshold = 0.65
    fallback_threshold = 0.60

    for face in faces:
        embedding = face.get("embedding")
        box = face.get("facial_area", {})

        # -------------------------
        # Work Application Login Flow
        # -------------------------
        if action == "work-application-login":
            if not employee_id:
                results.append({"name": "Unknown", "employee_id": None,
                                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                                "status": "employee_id_missing"})
                continue

            user_id = employee_id.replace("IFNT", "")
            try:
                user_id = int(user_id)
            except:
                user_id = None

            user = db.query(User).filter(User.id == user_id, User.is_active == True).first()

            if not user:
                results.append({"name": "Unknown", "employee_id": employee_id,
                                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                                "status": "invalid_employee_id"})
                continue

            stored_embeddings = json.loads(user.embedding)
            if isinstance(stored_embeddings[0], (int, float)):
                stored_embeddings = [stored_embeddings]

            matched = any(cosine_similarity(embedding, stored_emb) >= threshold for stored_emb in stored_embeddings)
            status = "logged_in" if matched else "face_mismatch"

            results.append({
                "name": user.name,
                "employee_id": employee_id,
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": status
            })
            continue

        # -------------------------
        # Normal Attendance Flow
        # -------------------------
        best_match, best_score, status = find_best_match(embedding, threshold, fallback_threshold)

        if status == "match":
            record = db.query(Attendance).filter(
                Attendance.user_id == best_match["id"],
                Attendance.date == today
            ).first()

            if not record:
                record = Attendance(user_id=best_match["id"],
                                    user_name_snapshot=best_match["name"],
                                    date=today)
                db.add(record)

            now_jst = datetime.now(JST)

            if action == "checkin":
                if record.check_out:
                    status = "already_checked_out"
                elif record.check_in:
                    status = "already_checked_in"
                else:
                    record.check_in = now_jst
                    status = "checked_in"

            elif action == "break_start":
                if not record.check_in:
                    status = "checkin_missing"
                elif record.check_out:
                    status = "already_checked_out"
                elif record.break_start and not record.break_end:
                    status = "already_on_break"
                else:
                    record.break_start = now_jst
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
                    record.break_end = now_jst
                    status = "break_ended"
                    calculate_total_work(record) 

            elif action == "checkout":
                if not record.check_in:
                    status = "checkin_missing"
                elif record.check_out:
                    status = "already_checked_out"
                elif record.break_start and not record.break_end:
                    status = "cannot_checkout_on_break"
                else:
                    record.check_out = now_jst
                    status = "checked_out"
                    calculate_total_work(record) 

            else:
                status = "invalid_action"

            db.commit()
            db.refresh(record)

            results.append({
                "name": best_match["name"],
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": status,
                "total_work": record.total_work
            })

        elif status == "maybe":
            results.append({"name": best_match["name"],
                            "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                            "status": "maybe_match"})
        else:
            results.append({"name": "Unknown",
                            "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                            "status": "unknown"})

    return {"results": results}


# -------------------------
# Get Full Attendance Logs for a User (with optional month/year filter)
# -------------------------
@router.get("/user/{user_id}")
async def get_user_attendance(
    user_id: int,
    db: Session = Depends(get_db),
    month: int = Query(None, ge=1, le=12, description="Filter by month (1-12)"),
    year: int = Query(None, ge=2000, le=2100, description="Filter by year"),
):
    query = db.query(Attendance).filter(Attendance.user_id == user_id)

    # Apply filters if month/year are provided
    if year:
        query = query.filter(Attendance.date >= date(year, 1, 1),
                             Attendance.date <= date(year, 12, 31))
    if month and year:
        last_day = monthrange(year, month)[1]
        query = query.filter(Attendance.date >= date(year, month, 1),
                             Attendance.date <= date(year, month, last_day))

    logs = query.order_by(Attendance.date.desc()).all()

    results = [
        {
            "date": log.date,
            "check_in": log.check_in,
            "check_out": log.check_out,
            "break_start": log.break_start,
            "break_end": log.break_end,
            "total_work": log.total_work,
            "user_name_snapshot": log.user_name_snapshot
        }
        for log in logs
    ]
    return results

# -------------------------
# Get Attendance for Current User (self view, with status like HR Logs)
# -------------------------
@router.get("/my-attendance")
async def get_my_attendance(
    employee_id: str = Query(..., description="Employee ID (e.g., IFNT001)"),
    db: Session = Depends(get_db),
    month: int = Query(..., ge=1, le=12, description="Filter by month"),
    year: int = Query(..., ge=2000, le=2100, description="Filter by year"),
):
    from calendar import monthrange

    # Convert employee_id like "IFNT001" → 1
    try:
        user_id = int(employee_id.replace("IFNT", ""))
    except ValueError:
        return {"error": "Invalid employee_id"}

    start_date = date(year, month, 1)
    end_date = date(year, month, monthrange(year, month)[1])

    # Fetch user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"error": "User not found"}

    # Fetch holidays
    holidays = {
        h.date: h.holiday_name
        for h in db.query(Holiday)
        .filter(Holiday.date >= start_date, Holiday.date <= end_date)
        .all()
    }

    # Fetch attendance logs
    attendance_logs = (
        db.query(Attendance)
        .filter(
            Attendance.user_id == user_id,
            Attendance.date >= start_date,
            Attendance.date <= end_date,
        )
        .all()
    )
    attendance_map = {log.date.date(): log for log in attendance_logs}

    # Fetch approved leaves
    leaves = (
        db.query(WorkApplication)
        .filter(
            WorkApplication.employee_id == employee_id,
            WorkApplication.start_date <= end_date,
            WorkApplication.end_date >= start_date,
            WorkApplication.status == "Approved",
        )
        .all()
    )
    leave_map = {}
    for leave in leaves:
        for d in (
            start_date + timedelta(days=i)
            for i in range((end_date - start_date).days + 1)
        ):
            if leave.start_date <= d <= leave.end_date:
                leave_map[d] = leave.reason

    # Build results day by day
    results = []
    today = date.today()
    for day in range(1, monthrange(year, month)[1] + 1):
        current_date = date(year, month, day)
        log = attendance_map.get(current_date)
        holiday_name = holidays.get(current_date)
        leave_reason = leave_map.get(current_date)

        # Decide status
        weekday = current_date.weekday()  # 0=Mon ... 6=Sun
        if current_date > today:
            status = "-" 
        elif leave_reason:
            status = "On Leave"
        elif holiday_name and log and log.check_in:
            status = "Worked on Holiday"
        elif holiday_name:
            status = "Holiday"
        elif log and log.check_in:
            if weekday == 5:
                status = "Present on Saturday"
            elif weekday == 6:
                status = "Present on Sunday"
            else:
                status = "Present"
        else:
            if weekday in (5, 6) or holiday_name:
                status = "-"
            else:
                status = "Absent"

        results.append({
            "date": current_date.strftime("%Y-%m-%d"),
            "employee_id": employee_id,
            "name": user.name,
            "department": user.department or "-",
            "status": status,
            "check_in": log.check_in.strftime("%Y-%m-%dT%H:%M:%S") if log and log.check_in else None,
            "check_out": log.check_out.strftime("%Y-%m-%dT%H:%M:%S") if log and log.check_out else None,
            "total_work": log.total_work if log and log.total_work else "-",
        })

    return results