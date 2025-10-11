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
        # Step 1: Preprocess image (lighting normalization)
        img = cv2.imread(tmp_path)
        if img is not None:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

            # Slight brightness & contrast boost
            img = cv2.convertScaleAbs(img, alpha=1.2, beta=10)

            # Optional: CLAHE (Adaptive histogram equalization) — helps in uneven lighting
            lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            l = clahe.apply(l)
            lab = cv2.merge((l, a, b))
            img = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)

            # Save preprocessed image temporarily
            normalized_path = tmp_path.replace(".jpg", "_norm.jpg")
            cv2.imwrite(normalized_path, cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
            use_path = normalized_path
        else:
            use_path = tmp_path

        # Step 2: Extract embeddings using DeepFace (ArcFace + MTCNN)
        reps = DeepFace.represent(
            img_path=use_path,
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

            # Step 3: Basic filtering
            if w < 50 or h < 50:
                continue
            ratio = w / (h + 1e-6)
            if ratio < 0.6 or ratio > 1.6:
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

    # Step 4: Fallback to OpenCV Haar if DeepFace fails
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
                "np_embeddings": np_embs,
                "threshold": user.threshold,
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
def find_best_match(embedding, default_threshold=0.38, fallback_threshold=0.35):
    """
    Find best match using per-user adaptive threshold (μ - 2σ rule).
    Falls back to global threshold if user threshold missing.
    """
    global embedding_cache
    if not embedding_cache:
        return None, -1, "unknown"

    emb = np.array(embedding, dtype=float)
    emb = emb / np.linalg.norm(emb)

    best_match = None
    best_score = -1
    best_threshold = default_threshold
    status = "unknown"

    # Iterate through users in cache
    for data in embedding_cache:
        user_threshold = data.get("threshold", default_threshold)
        np_embs = data["np_embeddings"]

        # Cosine similarities for all embeddings of this user
        sims = np.dot(np_embs, emb)
        mean_sim = float(np.mean(sims))

        if mean_sim > best_score:
            best_score = mean_sim
            best_match = {"id": data["id"], "name": data["name"]}
            best_threshold = user_threshold

    # Decision logic
    if best_score >= best_threshold:
        status = "match"
    elif best_score >= fallback_threshold:
        status = "maybe"
    else:
        status = "unknown"

    return best_match, best_score, status

# -------------------------
# Temporary face session cache for live preview
# -------------------------
active_faces = {}  # {face_id: {"embedding": list, "name": str, "pending_name": str, "confirmed": bool, "last_seen": float}}
FACE_EXPIRY_SECONDS = 5.0
CONFIRM_THRESHOLD = 0.88  # similarity to confirm the same face

# -------------------------
# Preview API (with confidence % and smart recheck logic)
# -------------------------
@router.post("/preview")
async def preview_faces(file: UploadFile = None):
    if not file:
        return {"error": "No image uploaded"}

    start_time = time.time()

    # --- Read uploaded image ---
    contents = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    # --- Run detection ---
    faces = detect_faces(tmp_path)
    if not faces:
        duration = time.time() - start_time
        print(f"⚡ Recognition completed in {duration:.3f}s (no faces found)")
        return {"results": []}

    # --- Cleanup expired faces ---
    now = time.time()
    expired = [
        fid for fid, data in active_faces.items()
        if now - data["last_seen"] > FACE_EXPIRY_SECONDS
    ]
    for fid in expired:
        del active_faces[fid]
        print(f"🧹 Expired face removed: {fid} — will be rechecked if seen again")

    results = []
    threshold = 40
    fallback_threshold = 0.35

    # --- Loop through all detected faces ---
    for idx, face in enumerate(faces):
        face_id = f"face_{idx + 1}"
        embedding = face.get("embedding")
        box = face.get("facial_area", {})

        # --- Check if this face matches any cached one ---
        matched_id = None
        for fid, data in active_faces.items():
            sim = cosine_similarity(embedding, data["embedding"])
            if sim > CONFIRM_THRESHOLD:
                matched_id = fid
                break

        confidence = 0.0
        name = "Unknown"
        result_status = "verifying"

        # --- Existing face already in cache ---
        if matched_id:
            data = active_faces[matched_id]
            data["last_seen"] = now

            # --- If confirmed or permanent unknown, skip recheck ---
            if data.get("confirmed"):
                name = data["name"]
                confidence = 100.0
                result_status = "known"
                print(f"✅ Skipping confirmed face {name}")

            elif data.get("permanent_unknown"):
                name = "Unknown"
                confidence = 0.0
                result_status = "unknown"
                print(f"🛑 Skipping permanently unknown face {matched_id}")

            else:
                # --- Silent internal verification (until 3x) ---
                best_match, best_score, status = find_best_match(
                    embedding, threshold, fallback_threshold
                )
                confidence = round(best_score * 100, 2)

                if status == "match" and best_match["name"] == data["pending_name"]:
                    data["confirm_count"] = data.get("confirm_count", 1) + 1

                    if data["confirm_count"] >= 3:
                        data["confirmed"] = True
                        data["name"] = best_match["name"]
                        print(
                            f"✅ Face {matched_id} verified internally as {data['name']} "
                            f"(3x match, {confidence:.2f}%)"
                        )
                    else:
                        print(
                            f"🔁 Internal recheck {data['confirm_count']}/3 for "
                            f"{data['pending_name']} ({confidence:.2f}%)"
                        )

                    name = data["pending_name"]
                    result_status = "verifying"

                else:
                    # --- Unknown or mismatched face ---
                    data["unknown_count"] = data.get("unknown_count", 0) + 1
                    if data["unknown_count"] >= 3:
                        data["permanent_unknown"] = True
                        data["name"] = "Unknown"
                        print(
                            f"🚫 Face {matched_id} locked as Unknown after 3 failed checks"
                        )
                        name = "Unknown"
                        confidence = 0.0
                        result_status = "unknown"
                    else:
                        print(
                            f"🔁 Unknown recheck {data['unknown_count']}/3 "
                            f"({confidence:.2f}%)"
                        )
                        name = data["pending_name"]

        # --- New face (not seen before) ---
        else:
            best_match, best_score, status = find_best_match(
                embedding, threshold, fallback_threshold
            )
            pending_name = (
                best_match["name"] if status in ["match", "maybe"] else "Unknown"
            )
            confidence = round(best_score * 100, 2)

            active_faces[face_id] = {
                "embedding": embedding,
                "name": pending_name if status == "match" else "Unknown",
                "pending_name": pending_name,
                "confirmed": False,
                "permanent_unknown": False,
                "confirm_count": 1 if status == "match" else 0,
                "unknown_count": 1 if status != "match" else 0,
                "last_seen": now,
            }

            print(
                f"⚡ New face {face_id} recognized instantly as {pending_name} "
                f"({confidence:.2f}%)"
            )
            name = pending_name
            result_status = "new_face"

        # --- Gender/Age (still disabled for speed) ---
        gender = "unknown"
        age = "N/A"

        # --- Append final result for frontend ---
        results.append(
            {
                "face_id": face_id,
                "name": name,
                "confidence": confidence,
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": result_status,
                "gender": gender,
                "age": age,
            }
        )

    # --- Rest condition (backend can sleep until new face appears) ---
    all_done = all(
        d.get("confirmed") or d.get("permanent_unknown")
        for d in active_faces.values()
    )

    duration = time.time() - start_time
    print(
        f"⚡ Recognition completed in {duration:.3f}s | Active faces: {len(active_faces)}"
    )

    return {"results": results, "stop_preview": all_done}

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
    If similarity is very high, update user's embedding bank using
    weighted + median fusion and adaptive threshold recalculation.
    """
    if similarity < threshold:
        return  # only update when system is confident

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        return

    try:
        stored_embeddings = json.loads(user.embedding)
        if isinstance(stored_embeddings[0], (int, float)):
            stored_embeddings = [stored_embeddings]

        # Add the new embedding (if sufficiently different)
        last_emb = np.array(stored_embeddings[-1], dtype=float)
        new_emb = np.array(new_embedding, dtype=float)
        sim = cosine_similarity(last_emb, new_emb)
        if sim >= 0.98:
            return  # too similar — skip duplicate

        stored_embeddings.append(new_embedding)
        # Keep most recent 20
        if len(stored_embeddings) > 20:
            stored_embeddings = stored_embeddings[-20:]

        # ------------------------------------------------------
        # (1) Recompute Median + Weighted Embedding Fusion
        # ------------------------------------------------------
        emb_vectors = np.array(stored_embeddings, dtype=float)
        norms = np.linalg.norm(emb_vectors, axis=1, keepdims=True)
        emb_vectors = emb_vectors / (norms + 1e-8)

        # Weighted mean based on sharpness proxy (variance)
        weights = np.var(emb_vectors, axis=1)
        weights = weights / np.sum(weights)
        weighted_mean = np.sum(emb_vectors * weights[:, None], axis=0)

        # Median embedding
        median_embedding = np.median(emb_vectors, axis=0)

        # Final fused embedding
        final_embedding = (weighted_mean + median_embedding) / 2.0
        final_embedding /= np.linalg.norm(final_embedding)

        # ------------------------------------------------------
        # (2) Recalculate adaptive threshold (same logic as /register)
        # ------------------------------------------------------
        sims = np.dot(emb_vectors, emb_vectors.T)
        upper_tri = sims[np.triu_indices_from(sims, k=1)]
        mean_sim = float(np.mean(upper_tri))

        if mean_sim > 0.88:
            user_threshold = 0.42
        elif mean_sim > 0.82:
            user_threshold = 0.40
        elif mean_sim > 0.78:
            user_threshold = 0.38
        else:
            user_threshold = 0.36

        # ------------------------------------------------------
        # (3) Save updated data
        # ------------------------------------------------------
        user.embedding = json.dumps(final_embedding.tolist())
        user.threshold = user_threshold
        db.commit()
        db.refresh(user)

        refresh_embeddings()
        print(
            f"🧠 Auto-Train updated {user.name}: "
            f"{len(stored_embeddings)} samples, threshold={user_threshold:.2f}"
        )

    except Exception as e:
        print(f"⚠️ Could not auto-update embedding for {user_id}: {e}")


# -------------------------
# Mark Attendance API (aligned with Preview recognition + Work Application)
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
    threshold = 0.35
    fallback_threshold = 0.30
    aging_update_threshold = 0.90

    for face in faces:
        embedding = face.get("embedding")
        box = face.get("facial_area", {})

        gender = "unknown"
        age = "N/A"

        # --- Recognition (shared logic) ---
        best_match, best_score, status = find_best_match(
            embedding, threshold, fallback_threshold
        )
        confidence = round(best_score * 100, 2)

        # ---------------------------------------------------------------------
        #  WORK APPLICATION LOGIN — face + employee_id verification
        # ---------------------------------------------------------------------
        if action == "work-application":
            if not employee_id:
                return {"results": [{"status": "invalid_employee_id"}]}

            user = db.query(User).filter(User.employee_id == employee_id).first()
            if not user:
                return {"results": [{"status": "invalid_employee_id"}]}

            # if face is unknown or not matched
            if status != "match":
                return {
                    "results": [
                        {
                            "status": "face_mismatch",
                            "name": "Unknown",
                            "employee_id": employee_id,
                            "confidence": confidence,
                            "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                        }
                    ]
                }

            # valid match but ensure the face belongs to this employee
            if best_match["id"] != user.id:
                return {
                    "results": [
                        {
                            "status": "face_mismatch",
                            "name": best_match["name"],
                            "employee_id": employee_id,
                            "confidence": confidence,
                            "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                        }
                    ]
                }

            # ✅ Face and Employee ID match
            print(f"🟢 Work Application login verified for {user.name} ({employee_id})")
            return {
                "results": [
                    {
                        "status": "logged_in",
                        "name": user.name,
                        "employee_id": employee_id,
                        "confidence": confidence,
                        "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                    }
                ]
            }

        # ---------------------------------------------------------------------
        #  NORMAL ATTENDANCE ACTIONS (checkin, checkout, break, etc.)
        # ---------------------------------------------------------------------
        if status == "match":
            user = db.query(User).filter(User.id == best_match["id"]).first()
            if not user:
                results.append({
                    "name": "Unknown",
                    "employee_id": None,
                    "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                    "status": "unknown",
                    "confidence": confidence,
                    "gender": gender,
                    "age": age
                })
                continue

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

            # --- Auto-Train (median + threshold update) ---
            if AUTO_TRAIN_ENABLED and best_score >= aging_update_threshold:
                maybe_update_user_embedding(db, user.id, embedding, best_score)

            results.append({
                "name": best_match["name"],
                "employee_id": f"IFNT{best_match['id']:03d}",
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": status,
                "confidence": confidence,
                "total_work": record.total_work,
                "gender": gender,
                "age": age
            })

        elif status == "maybe":
            results.append({
                "name": best_match["name"],
                "employee_id": f"IFNT{best_match['id']:03d}",
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": "maybe_match",
                "confidence": confidence,
                "gender": gender,
                "age": age
            })

        else:
            results.append({
                "name": "Unknown",
                "employee_id": None,
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                "status": "unknown",
                "confidence": confidence,
                "gender": gender,
                "age": age
            })

    # --- Reset preview cache after mark ---
    try:
        global active_faces
        active_faces.clear()
        print("🧹 Cleared active_faces cache after attendance mark")
    except Exception as e:
        print(f"⚠️ Cache clear skipped: {e}")

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