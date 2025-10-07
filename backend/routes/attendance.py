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
import time 
from sqlalchemy import inspect
import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
import tensorflow as tf
tf.get_logger().setLevel('ERROR')

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
# Auto-Training Toggle Flag
# -------------------------
AUTO_TRAIN_ENABLED = False  # default OFF

# -------------------------
# Cosine similarity (vectorized version will be used inside)
# -------------------------
def cosine_similarity(vec1, vec2):
    v1, v2 = np.array(vec1, dtype=float), np.array(vec2, dtype=float)
    v1, v2 = v1 / np.linalg.norm(v1), v2 / np.linalg.norm(v2)
    return float(np.dot(v1, v2))


# -------------------------
# Helper: calculate total work
# -------------------------
def calculate_total_work(record: Attendance):
    """Recalculate total work, break time, and actual work, then update record."""
    if record.check_in and record.check_out:
        try:
            # Total work (raw: check_out - check_in)
            total = record.check_out - record.check_in
            total_minutes = int(total.total_seconds() // 60)
            th, tm = divmod(total_minutes, 60)
            record.total_work = f"{th:02d}:{tm:02d}"

            # Break time
            break_minutes = 0
            if record.break_start and record.break_end:
                break_delta = record.break_end - record.break_start
                break_minutes = int(break_delta.total_seconds() // 60)
                bh, bm = divmod(break_minutes, 60)
                record.break_time = f"{bh:02d}:{bm:02d}"
            else:
                record.break_time = "-"

            # Actual work = total - break
            aw_minutes = max(total_minutes - break_minutes, 0)
            ah, am = divmod(aw_minutes, 60)
            record.actual_work = f"{ah:02d}:{am:02d}"

        except Exception as e:
            print("⚠️ Error calculating work:", e)
            record.total_work = "-"
            record.break_time = "-"
            record.actual_work = "-"
    else:
        record.total_work = "-"
        record.break_time = "-"
        record.actual_work = "-"

# -------------------------
# Detect faces using Neural Networks (MTCNN + ArcFace, fallback OpenCV Haar for masks and sunglasses)
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
# Embedding Cache in Memory (Vectorized)
# -------------------------
embedding_cache = []   # raw list of users (optional for debugging)
all_embeddings = None  # big NumPy array [N, D]
user_ids = []          # parallel list of IDs
user_names = []        # parallel list of names

def load_embeddings(db: Session):
    """Load all active user embeddings into memory (vectorized for fast cosine similarity)."""
    global embedding_cache, all_embeddings, user_ids, user_names

    users = db.query(User).filter(User.is_active == True).all()

    cache = []
    ids, names, np_list = [], [], []

    for user in users:
        try:
            stored_embeddings = json.loads(user.embedding)

            # Ensure always list of embeddings
            if isinstance(stored_embeddings[0], (int, float)):
                stored_embeddings = [stored_embeddings]

            np_embs = np.array(stored_embeddings, dtype=float)
            # normalize each row
            np_embs = np_embs / np.linalg.norm(np_embs, axis=1, keepdims=True)

            # store user
            cache.append({
                "id": user.id,
                "name": user.name,
                "embeddings": stored_embeddings,
                "np_embeddings": np_embs
            })

            # for vectorized lookup, store each embedding row
            for row in np_embs:
                np_list.append(row)
                ids.append(user.id)
                names.append(user.name)

        except Exception as e:
            print(f"⚠️ Failed to load embeddings for {user.name}: {e}")

    embedding_cache = cache
    user_ids = ids
    user_names = names
    all_embeddings = np.vstack(np_list) if np_list else None

    print(f"✅ Loaded {len(user_ids)} embeddings for {len(users)} users into cache.")

def refresh_embeddings():
    """Safely refresh the embedding cache — skips if tables not ready."""
    try:
        with SessionLocal() as db:
            inspector = inspect(db.bind)
            if "users" not in inspector.get_table_names():
                print("⚠️ Skipping embedding refresh — 'users' table not found yet.")
                return
            load_embeddings(db)
            print("✅ Embedding cache refreshed successfully.")
    except Exception as e:
        print(f"⚠️ Safe refresh skipped: {e}")

# =====================================================
# Safe Embedding Load on Import (macOS + Windows compatible)
# =====================================================
try:
    # Load embeddings once when imported — needed for macOS reload issue
    from sqlalchemy import inspect
    inspector = inspect(SessionLocal().bind)

    if "users" in inspector.get_table_names():
        with SessionLocal() as db:
            user_count = db.query(User).count()
            if user_count > 0:
                load_embeddings(db)
                print(f"Loaded embeddings for {user_count} users.")
            else:
                print("No users found — embedding cache empty.")
    else:
        print("⚠️ Skipped embedding load — 'users' table not found.")

except Exception as e:
    print(f"⚠️ Embedding preload skipped: {e}")


# -------------------------
# Vectorized Matching Helper
# -------------------------
def find_best_match(embedding, threshold, fallback_threshold=0.0):
    global all_embeddings, user_ids, user_names
    if all_embeddings is None or len(all_embeddings) == 0:
        return None, -1, "unknown"

    # normalize input embedding
    emb = np.array(embedding, dtype=float)
    emb = emb / np.linalg.norm(emb)

    # cosine similarity against all users (vectorized)
    sims = np.dot(all_embeddings, emb)  # shape: (num_embeddings,)
    best_idx = int(np.argmax(sims))
    best_score = float(sims[best_idx])

    best_match = {"id": user_ids[best_idx], "name": user_names[best_idx]}

    if best_score >= threshold:
        return best_match, best_score, "match"
    elif best_score >= fallback_threshold:
        return best_match, best_score, "maybe"
    else:
        return None, best_score, "unknown"

# -------------------------
# Preview API s
# -------------------------
@router.post("/preview")
async def preview_faces(file: UploadFile = None):
    if not file:
        return {"error": "No image uploaded"}

    start_time = time.time()  # start timer

    contents = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    faces = detect_faces(tmp_path)
    if not faces:
        duration = time.time() - start_time
        print(f"⚡ Recognition completed in {duration:.3f} seconds (no faces found)")
        return {"results": []}

    results = []
    threshold = 0.55
    fallback_threshold = 0.50

    for face in faces:
        embedding = face.get("embedding")
        box = face.get("facial_area", {})

        best_match, best_score, status = find_best_match(
            embedding, threshold, fallback_threshold
        )

        # -------------------------
        # Gender + Age detection (for preview only, not stored)
        # -------------------------
        gender = "unknown"
        age = "N/A"
        try:
            x, y, w, h = box.get("x"), box.get("y"), box.get("w"), box.get("h")
            img = cv2.imread(tmp_path)
            cropped_face = img[y:y+h, x:x+w]

            # Temporarily disable age and gender analysis for speed
            # Normal DeepFace analyze (no preloaded MODELS)
            analyze_info = []
            #analyze_info = DeepFace.analyze(
             #   cropped_face,
             #   actions=["age", "gender"],
             #   enforce_detection=False
            #)

            # Gender
            dominant = analyze_info[0].get("dominant_gender", "unknown")
            gender_probs = analyze_info[0].get("gender", {})
            confidence = 0
            if dominant in gender_probs:
                confidence = gender_probs[dominant]
            gender = f"{dominant.capitalize()} ({confidence:.0f}%)"

            # Fast Hybrid Age Estimation (Optimized)
            raw_age = analyze_info[0].get("age", "N/A")
            if raw_age != "N/A":
                try:
                    raw_age = int(raw_age)

                    # --- Step 1: Lightweight texture sharpness (meanStdDev, much faster) ---
                    gray = cv2.cvtColor(cropped_face, cv2.COLOR_BGR2GRAY)
                    _, stddev = cv2.meanStdDev(gray)
                    blur_metric = stddev[0][0]  # higher = more detail

                    # --- Step 2: Gender & texture correction ---
                    gender_pred = analyze_info[0].get("dominant_gender", "unknown").lower()

                    if blur_metric < 35:
                        texture_correction = -3
                    elif blur_metric < 60:
                        texture_correction = -2
                    else:
                        texture_correction = -1

                    gender_correction = -1 if gender_pred == "female" else -2  # beard/skin bias

                    # --- Step 3: Base adaptive correction by predicted age ---
                    if raw_age <= 20:
                        base = -1
                    elif 21 <= raw_age <= 30:
                        base = -2
                    elif 31 <= raw_age <= 45:
                        base = -3
                    elif 46 <= raw_age <= 60:
                        base = -4
                    else:
                        base = -5

                    # --- Step 4: Combine all corrections ---
                    adjusted_age = raw_age + base + texture_correction + gender_correction
                    age = max(adjusted_age, 1)

                except Exception as e:
                    print("⚠️ Fast hybrid age smoothing failed:", e)
                    age = raw_age
            else:
                age = "N/A"

        except Exception as e:
            print("⚠️ Gender/Age detection skipped:", e)
            gender = "unknown"
            age = "N/A"

        # -------------------------
        # Append recognition results
        # -------------------------
        if status == "match":
            results.append({
                "name": best_match["name"],
                "employee_id": f"IFNT{best_match['id']:03d}",
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": "preview",
                "gender": gender,
                "age": age
            })
        elif status == "maybe":
            results.append({
                "name": best_match["name"],
                "employee_id": f"IFNT{best_match['id']:03d}",
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": "maybe_match",
                "gender": gender,
                "age": age
            })
        else:
            results.append({
                "name": "Unknown",
                "employee_id": None,
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": "unknown",
                "gender": gender,
                "age": age
            })

    duration = time.time() - start_time  # end timer

    # Terminal Logs with detected faces
    gender_age_summary = ", ".join([
        f"{f.get('gender', 'unknown')} | Age: {f.get('age', 'N/A')}"
        for f in results
    ]) or "unknown"
    print(f"Recognition completed in {duration:.3f} seconds | Faces detected: {len(faces)} | {gender_age_summary}")

    return {"results": results}

# -------------------------
# Toggle Auto-Train API
# -------------------------
@router.post("/toggle-auto-train")
async def toggle_auto_train():
    global AUTO_TRAIN_ENABLED
    AUTO_TRAIN_ENABLED = not AUTO_TRAIN_ENABLED
    status = "ON" if AUTO_TRAIN_ENABLED else "OFF"
    print(f"[AUTO-TRAIN] Toggled → {status}")
    return {"auto_train_enabled": AUTO_TRAIN_ENABLED}

# -------------------------
# Get Auto-Train Status API
# -------------------------
@router.get("/auto-train-status")
async def get_auto_train_status():
    status = "ON" if AUTO_TRAIN_ENABLED else "OFF"
    print(f"[AUTO-TRAIN] Status checked → {status}")
    return {"auto_train_enabled": AUTO_TRAIN_ENABLED}

# -------------------------
# Auto-update embeddings (Face Aging Consistency)
# -------------------------
def maybe_update_user_embedding(db: Session, user_id: int, new_embedding, similarity: float, threshold: float = 0.90):
    """
    If similarity is very high, add this embedding to keep user profile updated.
    """
    if similarity < threshold:
        return  # only update when system is very confident

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        return

    try:
        stored_embeddings = json.loads(user.embedding)
        if isinstance(stored_embeddings[0], (int, float)):
            stored_embeddings = [stored_embeddings]

        # Compare with last embedding, avoid duplicates
        last_emb = np.array(stored_embeddings[-1], dtype=float)
        new_emb = np.array(new_embedding, dtype=float)
        sim = cosine_similarity(last_emb, new_emb)

        if sim < 0.98:  # only add if slightly different
            stored_embeddings.append(new_embedding)
            user.embedding = json.dumps(stored_embeddings)
            db.commit()
            db.refresh(user)
            refresh_embeddings()
            print(f"Embedding updated for {user.name} (total: {len(stored_embeddings)})")
    except Exception as e:
        print(f"⚠️ Could not update embedding for {user_id}: {e}")


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
    aging_update_threshold = 0.80

    for face in faces:
        embedding = face.get("embedding")
        box = face.get("facial_area", {})

        # -------------------------
        # Gender + Age detection (for preview only, not stored)
        # -------------------------
        gender = "unknown"
        age = "N/A"
        try:
            x, y, w, h = box.get("x"), box.get("y"), box.get("w"), box.get("h")
            img = cv2.imread(tmp_path)
            cropped_face = img[y:y+h, x:x+w]

            # Temporarily disable age and gender analysis for speed
            # Normal DeepFace analyze (no preloaded models)
            analyze_info = []
            #analyze_info = DeepFace.analyze(
            #    cropped_face,
            #    actions=["age", "gender"],
             #   enforce_detection=False
            #)

            dominant = analyze_info[0].get("dominant_gender", "unknown")
            gender_probs = analyze_info[0].get("gender", {})
            confidence = 0
            if dominant in gender_probs:
                confidence = gender_probs[dominant]
            gender = f"{dominant.capitalize()} ({confidence:.0f}%)"

            # Fast Hybrid Age Estimation (Optimized)
            raw_age = analyze_info[0].get("age", "N/A")
            if raw_age != "N/A":
                try:
                    raw_age = int(raw_age)

                    # --- Step 1: Lightweight texture sharpness (meanStdDev, faster) ---
                    gray = cv2.cvtColor(cropped_face, cv2.COLOR_BGR2GRAY)
                    _, stddev = cv2.meanStdDev(gray)
                    blur_metric = stddev[0][0]  # higher = more detail, less blur

                    # --- Step 2: Gender & texture-based correction ---
                    gender_pred = analyze_info[0].get("dominant_gender", "unknown").lower()

                    if blur_metric < 35:
                        texture_correction = -3
                    elif blur_metric < 60:
                        texture_correction = -2
                    else:
                        texture_correction = -1

                    gender_correction = -1 if gender_pred == "female" else -2  # beard/skin bias

                    # --- Step 3: Base adaptive correction by predicted age ---
                    if raw_age <= 20:
                        base = -1
                    elif 21 <= raw_age <= 30:
                        base = -2
                    elif 31 <= raw_age <= 45:
                        base = -3
                    elif 46 <= raw_age <= 60:
                        base = -4
                    else:
                        base = -5

                    # --- Step 4: Combine all corrections ---
                    adjusted_age = raw_age + base + texture_correction + gender_correction
                    age = max(adjusted_age, 1)

                except Exception as e:
                    print("⚠️ Fast hybrid age smoothing failed:", e)
                    age = raw_age
            else:
                age = "N/A"

        except Exception as e:
            print("⚠️ Gender/Age detection skipped:", e)
            gender = "unknown"
            age = "N/A"

        # -------------------------
        # Work Application Login Flow (STRICT ID VALIDATION)
        # -------------------------
        if action == "work-application-login":
            if not employee_id:
                results.append({
                    "name": "Unknown",
                    "employee_id": None,
                    "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                    "status": "employee_id_missing",
                    "gender": gender,
                    "age": age
                })
                continue

            # Strict format check: must be IFNT followed by exactly 3 digits
            user = None
            if employee_id.startswith("IFNT"):
                numeric_part = employee_id[4:]
                if numeric_part.isdigit() and len(numeric_part) == 3:
                    expected_id = int(numeric_part)
                    db_user = db.query(User).filter(User.id == expected_id, User.is_active == True).first()
                    if db_user and employee_id == f"IFNT{db_user.id:03d}":
                        user = db_user

            if not user:
                results.append({
                    "name": "Unknown",
                    "employee_id": employee_id,
                    "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                    "status": "invalid_employee_id",
                    "gender": gender,
                    "age": age
                })
                continue

            stored_embeddings = json.loads(user.embedding)
            if isinstance(stored_embeddings[0], (int, float)):
                stored_embeddings = [stored_embeddings]

            matched = any(cosine_similarity(embedding, stored_emb) >= threshold for stored_emb in stored_embeddings)
            status = "logged_in" if matched else "face_mismatch"

            # safeguard - update embedding ONLY if AutoTrain ON and strong confirmed match
            if AUTO_TRAIN_ENABLED and status == "logged_in":
                best_score = max(cosine_similarity(embedding, stored_emb) for stored_emb in stored_embeddings)
                if best_score >= aging_update_threshold:
                    stored_embeddings.append(embedding)
                    # keep only last 20 embeddings
                    if len(stored_embeddings) > 20:
                        stored_embeddings = stored_embeddings[-20:]
                    user.embedding = json.dumps(stored_embeddings)
                    db.commit()
                    refresh_embeddings()
                    print(f"Embedding updated for {user.name} due to aging consistency")

            results.append({
                "name": user.name,
                "employee_id": employee_id,
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": status,
                "gender": gender,
                "age": age
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
                record = Attendance(
                    user_id=best_match["id"],
                    user_name_snapshot=best_match["name"],
                    date=today
                )
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

            # safeguard - update embeddings ONLY if AutoTrain ON and strong confirmed match
            user = db.query(User).filter(User.id == best_match["id"]).first()
            if AUTO_TRAIN_ENABLED and user and best_score >= aging_update_threshold:
                stored_embeddings = json.loads(user.embedding)
                if isinstance(stored_embeddings[0], (int, float)):
                    stored_embeddings = [stored_embeddings]

                stored_embeddings.append(embedding)
                if len(stored_embeddings) > 20:
                    stored_embeddings = stored_embeddings[-20:]
                user.embedding = json.dumps(stored_embeddings)
                db.commit()
                refresh_embeddings()
                print(f"Embedding updated for {user.name} (ID: {user.id}) | score={best_score:.2f}")

            results.append({
                "name": best_match["name"],
                "employee_id": f"IFNT{best_match['id']:03d}",
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": status,
                "total_work": record.total_work,
                "gender": gender,
                "age": age
            })

        elif status == "maybe":
            # safeguard: no update allowed for "maybe"
            results.append({
                "name": best_match["name"],
                "employee_id": f"IFNT{best_match['id']:03d}",
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": "maybe_match",
                "gender": gender,
                "age": age
            })
        else:
            results.append({
                "name": "Unknown",
                "employee_id": None,
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": "unknown",
                "gender": gender,
                "age": age
            })

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
        query = query.filter(
            Attendance.date >= date(year, 1, 1),
            Attendance.date <= date(year, 12, 31)
        )
    if month and year:
        last_day = monthrange(year, month)[1]
        query = query.filter(
            Attendance.date >= date(year, month, 1),
            Attendance.date <= date(year, month, last_day)
        )

    logs = query.order_by(Attendance.date.desc()).all()

    results = [
        {
            "date": log.date.strftime("%Y-%m-%d"),
            "check_in": log.check_in.strftime("%Y-%m-%dT%H:%M:%S") if log.check_in else None,
            "check_out": log.check_out.strftime("%Y-%m-%dT%H:%M:%S") if log.check_out else None,
            "break_start": log.break_start.strftime("%Y-%m-%dT%H:%M:%S") if log.break_start else None,
            "break_end": log.break_end.strftime("%Y-%m-%dT%H:%M:%S") if log.break_end else None,
            "break_time": log.break_time if log.break_time else "-",
            "total_work": log.total_work if log.total_work else "-",
            "actual_work": log.actual_work if log.actual_work else "-",
            "user_name_snapshot": log.user_name_snapshot or "-"
        }
        for log in logs
    ]
    return results

# -------------------------
# Get Attendance for Current User (self view)
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