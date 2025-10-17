from fastapi import APIRouter, UploadFile, Form, Depends, Query
import ctypes
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
import gc
import threading
import tensorflow as tf
import logging
from queue import Queue

# Global queue for async attendance DB writes
attendance_queue = Queue()
import psutil # type: ignore
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
import tensorflow as tf
tf.get_logger().setLevel('ERROR')

router = APIRouter(prefix="/attendance", tags=["Attendance"])

# -------------------------
# Native C++ Face Engine (ArcFace + RetinaFace + Cosine + Matching)
# -------------------------

# Resolve native lib path reliably from this file's folder
_here = os.path.dirname(os.path.abspath(__file__))

# macOS build name
engine_path = os.path.abspath(os.path.join(_here, "..", "cpp", "build", "libface_engine.dylib"))

# (Optional cross-platform fallback)
if not os.path.exists(engine_path):
    for alt in ["face_engine.so", "face_engine.dll"]:
        _p = os.path.abspath(os.path.join(_here, "..", "cpp", "build", alt))
        if os.path.exists(_p):
            engine_path = _p
            break

# Try to load the unified native engine
try:
    face_engine = ctypes.CDLL(engine_path)
    print(f"✅ Loaded C++ Face Engine: {engine_path}")

    # Optional: verify model presence
    try:
        face_engine.test_arcface_model()
    except Exception:
        print("⚠️ ArcFace model check skipped (optional).")

    # Reuse the same lib for cosine + matcher
    cosine_lib = face_engine
    vector_lib = face_engine

    # --- Define all exported function signatures ---
    # detect_and_embed → const char* (JSON)
    face_engine.detect_and_embed.restype = ctypes.c_char_p
    face_engine.detect_and_embed.argtypes = [ctypes.c_char_p]

    # cosine_similarity → double
    cosine_lib.cosine_similarity.restype = ctypes.c_double
    cosine_lib.cosine_similarity.argtypes = [
        ctypes.POINTER(ctypes.c_double),
        ctypes.POINTER(ctypes.c_double),
        ctypes.c_int
    ]

    # best_match → int
    vector_lib.best_match.restype = ctypes.c_int
    vector_lib.best_match.argtypes = [
        ctypes.POINTER(ctypes.c_double),  # input
        ctypes.POINTER(ctypes.c_double),  # all embeddings
        ctypes.c_int,                     # n_users
        ctypes.c_int,                     # dim
        ctypes.POINTER(ctypes.c_double)   # best_score
    ]

    # Quick test to ensure functions are callable
    v1 = np.array([1.0, 2.0, 3.0], dtype=np.float64)
    v2 = np.array([1.0, 2.0, 3.0], dtype=np.float64)
    ptr1 = v1.ctypes.data_as(ctypes.POINTER(ctypes.c_double))
    ptr2 = v2.ctypes.data_as(ctypes.POINTER(ctypes.c_double))
    test_result = cosine_lib.cosine_similarity(ptr1, ptr2, len(v1))
    print(f"✅ C++ cosine self-test OK: {test_result:.6f}")
    print("✅ Unified C++ Face Engine functions ready.")

except Exception as e:
    print(f"❌ Failed to load C++ Face Engine: {e}")
    face_engine = None

# -------------------------
# Smart Log Management (auto-truncate when file > 5 MB)
# -------------------------
LOG_FILE = "server.log"
LOG_MAX_SIZE_MB = 5  # truncate after this size

logger = logging.getLogger("attendance_app")
logger.setLevel(logging.INFO)

# file output
file_handler = logging.FileHandler(LOG_FILE, mode="a", encoding="utf-8")
formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S")
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# optional console output
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# =====================================================
# Background Attendance Writer Thread (Async DB Commits)
# =====================================================
def background_attendance_writer():
    """Continuously saves attendance records from the queue to the DB."""
    from models.Attendance import Attendance
    from utils.db import SessionLocal
    import threading

    db = SessionLocal()
    lock = threading.Lock()

    while True:
        item = attendance_queue.get()
        if item is None:
            break

        try:
            record_data, user_id = item

            with lock:
                existing = db.query(Attendance).filter(
                    Attendance.user_id == user_id,
                    Attendance.date == record_data["date"]
                ).first()

                if existing:
                    # Update existing record fields (in-place)
                    for k, v in record_data.items():
                        setattr(existing, k, v)
                    db.commit()
                    print(f"🔁 Updated record for user {user_id} ({record_data['date']})")
                else:
                    # Create new record
                    record = Attendance(**record_data)
                    db.add(record)
                    db.commit()
                    print(f"🆕 Created new record for user {user_id} ({record_data['date']})")

        except Exception as e:
            print(f"⚠️ Background DB write failed: {e}")
            db.rollback()
        finally:
            attendance_queue.task_done()

# Start the thread (daemon=True so it runs in background)
threading.Thread(target=background_attendance_writer, daemon=True).start()

# -------------------------
# Background thread to clean log if it grows too large
# -------------------------
def _clean_large_logs():
    while True:
        try:
            if os.path.exists(LOG_FILE):
                size_mb = os.path.getsize(LOG_FILE) / (1024 * 1024)
                if size_mb > LOG_MAX_SIZE_MB:
                    # safely truncate the log file without restarting backend
                    open(LOG_FILE, "w").close()
                    logger.info("🧹 Log file cleared automatically (exceeded 5 MB).")
            time.sleep(60)  # check every 1 minute
        except Exception as e:
            logger.warning(f"⚠️ Log cleanup error: {e}")
            time.sleep(120)

threading.Thread(target=_clean_large_logs, daemon=True).start()

# =====================================================
# Automatic Memory Cleaner (TensorFlow + Python + OS)
# =====================================================
def _auto_clear_memory():
    while True:
        try:
            process = psutil.Process(os.getpid())
            mem_mb = process.memory_info().rss / (1024 * 1024)

            # Trigger cleanup if backend RAM > 1500 MB (adjust as needed)
            if mem_mb > 1500:
                logger.info(f"🧠 Memory high ({mem_mb:.1f} MB) — running cleanup...")
                gc.collect()
                tf.keras.backend.clear_session()
                logger.info("✅ TensorFlow session and Python GC cleared.")

            time.sleep(300)  # check every 5 minutes
        except Exception as e:
            logger.warning(f"⚠️ Memory cleaner error: {e}")
            time.sleep(120)

# Start background thread
threading.Thread(target=_auto_clear_memory, daemon=True).start()

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

# =====================================================
# Export Embeddings for Frontend Hybrid Recognition
# =====================================================
def get_embeddings_cache():
    """
    Returns all user embeddings as a dictionary {name: [embedding]}.
    Used by app.py for frontend ONNX instant recognition.
    """
    from models.User import User
    from utils.db import SessionLocal
    import json

    embeddings = {}
    try:
        with SessionLocal() as db:
            users = db.query(User).all()
            for user in users:
                if user.embedding is not None:
                    try:
                        emb = json.loads(user.embedding) if isinstance(user.embedding, str) else user.embedding
                        # If stored as list of embeddings, take mean
                        if isinstance(emb[0], list):
                            emb = np.mean(np.array(emb), axis=0).tolist()
                        embeddings[user.name] = emb
                    except Exception as e:
                        logger.info(f"⚠️ Failed to parse embedding for {user.name}: {e}")
                        continue
    except Exception as e:
        logger.warning(f"⚠️ get_embeddings_cache() failed: {e}")

    return embeddings

# -------------------------
# Auto-Training Toggle Flag
# -------------------------
AUTO_TRAIN_ENABLED = False  # default OFF

# -------------------------
# Cosine similarity (vectorized version will be used inside)
# -------------------------
def cosine_similarity(vec1, vec2):
    v1 = np.array(vec1, dtype=np.float64)
    v2 = np.array(vec2, dtype=np.float64)

    # normalize both (safe)
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 > 0: v1 = v1 / n1
    if n2 > 0: v2 = v2 / n2

    ptr1 = v1.ctypes.data_as(ctypes.POINTER(ctypes.c_double))
    ptr2 = v2.ctypes.data_as(ctypes.POINTER(ctypes.c_double))

    return cosine_lib.cosine_similarity(ptr1, ptr2, len(v1))


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
            logger.warning("⚠️ Error calculating work:", e)
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

# Detection cache to skip redundant MTCNN runs
LAST_DETECTION = {"time": 0, "faces": []}
DETECTION_INTERVAL = 1.0  # seconds to reuse last detection

# =====================================================
# C++ Face Detection + Embedding Wrapper
# =====================================================
def cpp_detect_and_embed(image_path: str):
    """Use the native C++ engine (ArcFace only) to get embeddings for a cropped face."""
    try:
        # Call the C++ function
        result = face_engine.detect_and_embed(image_path.encode("utf-8"))
        if not result:
            return []
        data = json.loads(result.decode("utf-8"))
        return data  # [{"embedding": [...], "facial_area": {...}}, ...]
    except Exception as e:
        logger.warning(f"⚠️ C++ detect_and_embed failed: {e}")
        return []

def detect_faces(tmp_path):
    """
    Detect faces and generate embeddings using the native C++ engine.
    Falls back to DeepFace if C++ engine fails or detects nothing.
    """
    # Blaze already gives cropped face — directly use ArcFace embedding
    faces = cpp_detect_and_embed(tmp_path) if face_engine else []

    # --- Fallback to DeepFace if C++ engine found nothing ---
    if not faces:
        logger.warning("⚠️ ArcFace embedding failed, fallback to DeepFace")
        try:
            reps = DeepFace.represent(
                img_path=tmp_path,
                model_name="ArcFace",
                detector_backend="mtcnn",
                enforce_detection=False
            )

            if isinstance(reps, dict):
                reps = [reps]

            faces = []
            for rep in reps:
                emb = rep.get("embedding", [])
                box = rep.get("facial_area", {})
                faces.append({"embedding": emb, "facial_area": box})

        except Exception as e:
            logger.error(f"❌ DeepFace fallback failed: {e}")
            faces = []

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
            logger.warning(f"⚠️ Failed to load embeddings for {user.name}: {e}")

    embedding_cache = cache
    user_ids = ids
    user_names = names
    all_embeddings = np.vstack(np_list) if np_list else None

    logger.info(f"✅ Loaded {len(user_ids)} embeddings for {len(users)} users into cache.")

def refresh_embeddings():
    """Safely refresh the embedding cache — skips if tables not ready."""
    try:
        with SessionLocal() as db:
            inspector = inspect(db.bind)
            if "users" not in inspector.get_table_names():
                logger.warning("⚠️ Skipping embedding refresh — 'users' table not found yet.")
                return
            load_embeddings(db)
            logger.info("✅ Embedding cache refreshed successfully.")
    except Exception as e:
        logger.warning(f"⚠️ Safe refresh skipped: {e}")

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
                logger.info(f"✅ Loaded embeddings for {user_count} users.")
            else:
                logger.warning("⚠️ No users found — embedding cache empty.")
    else:
        logger.warning("⚠️ Skipped embedding load — 'users' table not found.")

except Exception as e:
    logger.warning(f"⚠️ Embedding preload skipped: {e}")


# -------------------------
# Vectorized Matching Helper
# -------------------------
def find_best_match(embedding, default_threshold=0.38, fallback_threshold=0.35):
    """
    Super-fast C++ vectorized matching — finds the most similar embedding.
    """
    global all_embeddings, user_names, user_ids
    if all_embeddings is None or len(all_embeddings) == 0:
        return None, -1, "unknown"

    # --- Normalize the input embedding safely ---
    emb = np.array(embedding, dtype=np.float64)
    norm = np.linalg.norm(emb)
    if norm == 0:
        return None, -1, "unknown"
    emb /= norm

    # --- Prepare pointers for C++ ---
    emb_ptr = emb.ctypes.data_as(ctypes.POINTER(ctypes.c_double))
    all_ptr = all_embeddings.ctypes.data_as(ctypes.POINTER(ctypes.c_double))
    n_users = all_embeddings.shape[0]
    dim = all_embeddings.shape[1]

    best_score = ctypes.c_double()
    best_index = vector_lib.best_match(emb_ptr, all_ptr, n_users, dim, ctypes.byref(best_score))
    best_score = best_score.value

    # --- Interpret result ---
    if best_index < 0 or best_index >= len(user_names):
        return None, -1, "unknown"

    name = user_names[best_index]
    user_id = user_ids[best_index]

    # --- Decision logic ---
    if best_score >= default_threshold:
        status = "match"
    elif best_score >= fallback_threshold:
        status = "maybe"
    else:
        status = "unknown"

    return {"id": user_id, "name": name}, best_score, status

# -------------------------
# Temporary face session cache for live preview
# -------------------------
active_faces = {}  # {face_id: {"embedding": list, "name": str, "pending_name": str, "confirmed": bool, "last_seen": float}}
FACE_EXPIRY_SECONDS = 5.0
CONFIRM_THRESHOLD = 0.75  # similarity to confirm the same face

# -------------------------
# Preview API (multi-face, stable IDs, smart recheck logic)
# -------------------------
@router.post("/preview")
async def preview_faces(
    file: UploadFile = None,
    action: str = Form("preview"),
    employee_id: str = Form(""),
    face_index: int = Form(0)  # ✅ new: support multi-face from frontend
):
    if not file:
        return {"error": "No image uploaded"}

    start_time = time.time()

    # --- Read uploaded image ---
    contents = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    # =========================================================
    # 🧠 STEP 1: Compute embedding (ArcFace only)
    # =========================================================
    try:
        import cv2
        from deepface import DeepFace

        img = cv2.imread(tmp_path)
        rep = DeepFace.represent(
            img_path=img,
            model_name="ArcFace",
            enforce_detection=False  # trust frontend crop
        )[0]["embedding"]

        faces = [{"embedding": rep, "facial_area": {}}]
    except Exception as e:
        logger.error(f"❌ ArcFace direct embedding failed: {e}")
        faces = []

    # =========================================================
    # 🧱 STEP 2: Handle no face
    # =========================================================
    if not faces:
        duration = time.time() - start_time
        logger.info(f"⚡ Recognition completed in {duration:.3f}s (no faces found)")
        return {"results": []}

    # =========================================================
    # ♻️ STEP 3: Prepare cache
    # =========================================================
    now = time.time()
    global active_faces
    if "active_faces" not in globals():
        active_faces = {}

    FACE_EXPIRY_SECONDS = globals().get("FACE_EXPIRY_SECONDS", 60)
    CONFIRM_THRESHOLD = globals().get("CONFIRM_THRESHOLD", 0.40)

    # Cleanup expired
    expired = [
        fid for fid, data in active_faces.items()
        if now - data.get("last_seen", 0) > FACE_EXPIRY_SECONDS
    ]
    for fid in expired:
        del active_faces[fid]
        logger.info(f"🧹 Expired face removed: {fid}")

    results = []
    threshold = 0.38
    fallback_threshold = 0.35

    # =========================================================
    # 🔍 STEP 4: Process detected (single uploaded) face
    # =========================================================
    for idx, face in enumerate(faces):
        # ✅ use frontend-provided index for stable multi-face IDs
        face_id = f"face_{face_index + 1}"
        embedding = face.get("embedding")
        box = face.get("facial_area", {})

        matched_id = None
        for fid, data in active_faces.items():
            try:
                sim = cosine_similarity(embedding, data["embedding"])
                if sim > CONFIRM_THRESHOLD:
                    matched_id = fid
                    break
            except Exception:
                continue

        confidence = 0.0
        name = "Unknown"
        result_status = "verifying"

        # =====================================================
        # 🔁 STEP 4A: Previously seen faces
        # =====================================================
        if matched_id:
            data = active_faces[matched_id]
            data["last_seen"] = now

            if data.get("confirmed"):
                name = data["name"]
                confidence = 100.0
                result_status = "known"
                logger.info(f"✅ Skipping confirmed face {name}")

            elif data.get("permanent_unknown"):
                name = "Unknown"
                confidence = 0.0
                result_status = "unknown"
                logger.warning(f"🛑 Skipping permanently unknown face {matched_id}")

            else:
                try:
                    best_match, best_score, status = find_best_match(
                        embedding, threshold, fallback_threshold
                    )
                    confidence = round(best_score * 100, 2)

                    if status == "match" and best_match["name"] == data["pending_name"]:
                        data["confirm_count"] = data.get("confirm_count", 1) + 1
                        if data["confirm_count"] >= 3:
                            data["confirmed"] = True
                            data["name"] = best_match["name"]
                            logger.info(
                                f"✅ Face {matched_id} verified internally as {data['name']} "
                                f"(3x match, {confidence:.2f}%)"
                            )
                        else:
                            logger.info(
                                f"🔁 Internal recheck {data['confirm_count']}/3 for "
                                f"{data['pending_name']} ({confidence:.2f}%)"
                            )

                        name = data["pending_name"]
                        result_status = "verifying"

                    else:
                        data["unknown_count"] = data.get("unknown_count", 0) + 1
                        if data["unknown_count"] >= 3:
                            data["permanent_unknown"] = True
                            data["name"] = "Unknown"
                            logger.warning(
                                f"🚫 Face {matched_id} locked as Unknown after 3 failed checks"
                            )
                            name = "Unknown"
                            confidence = 0.0
                            result_status = "unknown"
                        else:
                            logger.warning(
                                f"🔁 Unknown recheck {data['unknown_count']}/3 "
                                f"({confidence:.2f}%)"
                            )
                            name = data["pending_name"]

                except Exception as e:
                    logger.error(f"⚠️ Recheck failed: {e}")
                    name = data.get("pending_name", "Unknown")
                    confidence = 0.0
                    result_status = "unknown"

        # =====================================================
        # 🆕 STEP 4B: New faces (first-time seen)
        # =====================================================
        else:
            try:
                best_match, best_score, status = find_best_match(
                    embedding, threshold, fallback_threshold
                )
                pending_name = (
                    best_match["name"] if status in ["match", "maybe"] else "Unknown"
                )
                confidence = round(best_score * 100, 2)

                # ✅ Use face_index to keep identity separate per person
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

                logger.info(
                    f"⚡ New face {face_id} recognized instantly as {pending_name} "
                    f"({confidence:.2f}%)"
                )
                name = pending_name
                result_status = "new_face"

            except Exception as e:
                logger.error(f"⚠️ New face comparison failed: {e}")
                name = "Unknown"
                confidence = 0.0
                result_status = "error"

        # =====================================================
        # 📦 STEP 5: Package results for frontend
        # =====================================================
        results.append(
            {
                "face_id": face_id,
                "name": name,
                "employee_id": employee_id,
                "confidence": confidence,
                "box": [
                    box.get("x"),
                    box.get("y"),
                    box.get("w"),
                    box.get("h"),
                ],
                "status": result_status,
                "gender": "unknown",
                "age": "N/A",
                "embedding": embedding,
            }
        )

    # =========================================================
    # 💤 STEP 6: Final logging
    # =========================================================
    all_done = all(
        d.get("confirmed") or d.get("permanent_unknown")
        for d in active_faces.values()
    )

    duration = time.time() - start_time
    if any(r["status"] in ("new_face", "verifying", "known") for r in results):
        logger.info(
            f"⚡ Recognition event in {duration:.3f}s | Active faces: {len(active_faces)}"
        )

    # Optional — clearer debug summary
    if len(active_faces) > 1:
        logger.info(
            "Current active faces → "
            + ", ".join(f"{fid}:{d['name']}" for fid, d in active_faces.items())
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
    logger.info(f"[AUTO-TRAIN] Toggled → {status}")
    return {"auto_train_enabled": AUTO_TRAIN_ENABLED}

# -------------------------
# Get Auto-Train Status API
# -------------------------
@router.get("/auto-train-status")
async def get_auto_train_status():
    status = "ON" if AUTO_TRAIN_ENABLED else "OFF"
    logger.info(f"[AUTO-TRAIN] Status checked → {status}")
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
        logger.info(
            f"🧠 Auto-Train updated {user.name}: "
            f"{len(stored_embeddings)} samples, threshold={user_threshold:.2f}"
        )

    except Exception as e:
        logger.warning(f"⚠️ Could not auto-update embedding for {user_id}: {e}")


# -------------------------
# Mark Attendance API (multi-face safe + synced with Preview)
# -------------------------
from fastapi import Request, UploadFile, Form, Depends
from sqlalchemy.orm import Session
from datetime import datetime, date
import tempfile
import time

@router.post("/mark")
async def mark_attendance(
    request: Request,
    action: str = Form(None),
    file: UploadFile = None,
    employee_id: str = Form(""),
    face_index: int = Form(0),  # ✅ keep consistent with /preview
    db: Session = Depends(get_db),
):
    """
    Handles:
    1️⃣ Work Application JSON login (face_name + employee_id)
    2️⃣ Normal Attendance (Check-in / Check-out / Breaks)
    3️⃣ Multi-face frame recognition (each face handled separately)
    """
    try:
        # Try parsing JSON (used in Work Application login)
        data = await request.json()
        action = data.get("action", action)
        employee_id = data.get("employee_id", employee_id)
        face_name = data.get("face_name")
        confidence = data.get("confidence", 0)
    except Exception:
        data = {}
        face_name = None
        confidence = 0

    today = date.today()
    strict_threshold = 0.40
    fallback_threshold = 0.35
    aging_update_threshold = 0.90
    now_jst = datetime.now(JST)

    # ------------------------------------------------------------
    # CASE 1: Work Application (JSON only, no image)
    # ------------------------------------------------------------
    if action == "work-application" and not file:
        user = db.query(User).filter(User.employee_id == employee_id).first()
        if not user:
            return {"results": [{"status": "invalid_employee_id"}]}

        if face_name and user.name.lower() in face_name.lower() and confidence >= 50:
            logger.info(f"🟢 Verified WorkApp login for {user.name} ({employee_id}) [{confidence}%]")
            return {
                "results": [
                    {
                        "status": "logged_in",
                        "name": user.name,
                        "employee_id": employee_id,
                        "confidence": confidence,
                    }
                ]
            }
        else:
            logger.warning(
                f"⚠️ Face/ID mismatch — detected {face_name} vs expected {user.name} ({employee_id})"
            )
            return {
                "results": [
                    {
                        "status": "face_mismatch",
                        "name": face_name or "Unknown",
                        "employee_id": employee_id,
                        "confidence": confidence,
                    }
                ]
            }

    # ------------------------------------------------------------
    # CASE 2: Normal Attendance (FormData + Uploaded Frame)
    # ------------------------------------------------------------
    if not file:
        return {"error": "No image uploaded"}

    # Save uploaded frame
    contents = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    # Run face detection/embedding
    try:
        faces = detect_faces(tmp_path)
    except Exception as e:
        logger.error(f"❌ detect_faces failed: {e}")
        return {"results": []}

    if not faces:
        return {"results": []}

    # ------------------------------------------------------------
    # Multi-face consistency
    # ------------------------------------------------------------
    global active_faces
    if "active_faces" not in globals():
        active_faces = {}

    results = []
    action = (action or "").lower().strip()

    for idx, face in enumerate(faces):
        # ✅ Use provided index or fallback to sequential
        face_id = f"face_{face_index + idx + 1}"
        embedding = face.get("embedding")
        box = face.get("facial_area", {})
        gender = "unknown"
        age = "N/A"

        # --------------------------------------------------------
        # Compute match using strict + fallback thresholds
        # --------------------------------------------------------
        try:
            best_match, best_score, status = find_best_match(
                embedding, strict_threshold, fallback_threshold
            )
            confidence = round(best_score * 100, 2)
        except Exception as e:
            logger.error(f"⚠️ find_best_match failed: {e}")
            results.append({
                "face_id": face_id,
                "name": "Unknown",
                "employee_id": None,
                "status": "error_comparing_embeddings",
                "confidence": 0.0,
            })
            continue

        # Prevent low-score false positives
        if best_score < fallback_threshold:
            logger.info(f"🚫 Low-score face ({confidence:.2f}%) — ignored")
            results.append({
                "face_id": face_id,
                "name": "Unknown",
                "employee_id": None,
                "status": "unknown",
                "confidence": confidence,
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
            })
            continue

        # Maintain cache stability
        prev_face = active_faces.get(face_id, {})
        prev_name = prev_face.get("name")
        prev_conf = prev_face.get("confidence", 0)
        if prev_name and prev_name != best_match["name"]:
            if confidence - prev_conf < 10:
                best_match["name"] = prev_name
                confidence = prev_conf

        # Update cache
        active_faces[face_id] = {
            "name": best_match["name"],
            "confidence": confidence,
            "last_seen": now_jst,
        }

        # --------------------------------------------------------
        # Work Application fallback (with uploaded frame)
        # --------------------------------------------------------
        if action == "work-application":
            user = db.query(User).filter(User.employee_id == employee_id).first()
            if not user:
                return {"results": [{"status": "invalid_employee_id"}]}

            name_ok = (
                best_match["name"].lower() in user.name.lower()
                or user.name.lower() in best_match["name"].lower()
            )
            if name_ok and best_score >= 0.35:
                logger.info(f"🟢 Work Application login verified for {user.name} ({employee_id})")
                results.append({
                    "face_id": face_id,
                    "name": user.name,
                    "employee_id": employee_id,
                    "status": "logged_in",
                    "confidence": confidence,
                    "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                })
            else:
                logger.warning(f"⚠️ Face mismatch for {user.name} ({employee_id})")
                results.append({
                    "face_id": face_id,
                    "name": best_match["name"],
                    "employee_id": employee_id,
                    "status": "face_mismatch",
                    "confidence": confidence,
                    "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
                })
            continue

        # --------------------------------------------------------
        # Attendance: Check-in / Check-out / Break
        # --------------------------------------------------------
        if status == "match":
            user = db.query(User).filter(User.id == best_match["id"]).first()
            if not user:
                results.append({
                    "face_id": face_id,
                    "name": "Unknown",
                    "employee_id": None,
                    "status": "unknown",
                    "confidence": confidence,
                })
                continue

            record = (
                db.query(Attendance)
                .filter(Attendance.user_id == user.id, Attendance.date == today)
                .first()
            )
            if not record:
                record = Attendance(
                    user_id=user.id,
                    user_name_snapshot=user.name,
                    date=today,
                )
                db.add(record)

            # ----- Attendance flow -----
            if action == "checkin":
                if record.check_in:
                    status = "already_checked_in"
                else:
                    record.check_in = now_jst
                    status = "checked_in"

            elif action == "checkout":
                if not record.check_in:
                    status = "checkin_missing"
                elif record.check_out:
                    status = "already_checked_out"
                else:
                    record.check_out = now_jst
                    status = "checked_out"
                    calculate_total_work(record)

            elif action == "break_start":
                if record.break_start and not record.break_end:
                    status = "already_on_break"
                else:
                    record.break_start = now_jst
                    status = "break_started"

            elif action == "break_end":
                if not record.break_start:
                    status = "break_not_started"
                elif record.break_end:
                    status = "already_break_ended"
                else:
                    record.break_end = now_jst
                    status = "break_ended"
                    calculate_total_work(record)
            else:
                status = "invalid_action"

            # Save to DB queue
            record_data = {
                "user_id": record.user_id,
                "user_name_snapshot": record.user_name_snapshot,
                "date": record.date,
                "check_in": record.check_in,
                "check_out": record.check_out,
                "break_start": record.break_start,
                "break_end": record.break_end,
            }
            attendance_queue.put((record_data, record.user_id))

            # Optional adaptive update
            if AUTO_TRAIN_ENABLED and best_score >= aging_update_threshold:
                maybe_update_user_embedding(db, user.id, embedding, best_score)

            results.append({
                "face_id": face_id,
                "name": best_match["name"],
                "employee_id": f"IFNT{best_match['id']:03d}",
                "status": status,
                "confidence": confidence,
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
            })

        else:
            results.append({
                "face_id": face_id,
                "name": "Unknown",
                "employee_id": None,
                "status": "unknown",
                "confidence": confidence,
                "box": [box.get("x"), box.get("y"), box.get("w"), box.get("h")],
            })

    # ------------------------------------------------------------
    # Cleanup cache (expire faces older than 60s)
    # ------------------------------------------------------------
    for fid, data in list(active_faces.items()):
        if (now_jst - data["last_seen"]).seconds > 60:
            del active_faces[fid]

    db.commit()

    # Clear cache after successful mark
    try:
        active_faces.clear()
        logger.info("🧹 Cleared active_faces cache after mark")
    except Exception as e:
        logger.warning(f"⚠️ Cache clear skipped: {e}")

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

# =====================================================
# ⚡ Ultra-Fast Instant Mark API (Frontend JSON only)
# =====================================================
@router.post("/mark-instant")
async def mark_instant(data: dict):
    """
    Instant attendance mark — supports multiple faces at once.

    Accepts:
      {
        "faces": [
          { "employee_id": "IFNT032", "action": "checkin", "confidence": 97 },
          { "employee_id": "IFNT036", "action": "checkout", "confidence": 93 }
        ]
      }

    Returns:
      { "results": [ {...}, {...} ] }
    """
    from utils.db import SessionLocal

    faces = data.get("faces", [])
    if not faces:
        faces = [{
            "employee_id": data.get("employee_id"),
            "action": data.get("action"),
            "confidence": data.get("confidence", 0),
        }]

    results = []
    today = date.today()

    with SessionLocal() as db:
        print("🧠 Faces received from frontend:", faces)
        for face in faces:
            try:
                employee_id = (face.get("employee_id") or "").strip()
                action = (face.get("action") or "").lower().strip()
                confidence = face.get("confidence", 0)
                now_jst = datetime.now(JST)

                # --- Missing ID ---
                if not employee_id:
                    results.append({
                        "name": "Unknown",
                        "employee_id": None,
                        "status": "missing_employee_id",
                        "confidence": confidence,
                        "timestamp": now_jst.strftime("%Y-%m-%d %H:%M:%S"),
                    })
                    continue

                # --- Find user ---
                user = db.query(User).filter(
                    (User.employee_id == employee_id) | (User.name == employee_id)
                ).first()

                if not user:
                    results.append({
                        "name": "Unknown",
                        "employee_id": employee_id,
                        "status": "invalid_user",
                        "confidence": confidence,
                        "timestamp": now_jst.strftime("%Y-%m-%d %H:%M:%S"),
                    })
                    continue

                # --- Find or create record ---
                record = db.query(Attendance).filter(
                    Attendance.user_id == user.id,
                    Attendance.date == today
                ).first()

                if not record:
                    record = Attendance(
                        user_id=user.id,
                        user_name_snapshot=user.name,
                        date=today
                    )
                    db.add(record)
                    db.flush()

                # =====================================================
                # 🧠 MAIN ATTENDANCE LOGIC
                # =====================================================
                if action == "checkin":
                    if record.check_out:
                        status = "already_checked_out"
                    elif record.check_in:
                        status = "already_checked_in"
                    else:
                        record.check_in = now_jst
                        record.status = "checked_in"
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
                        record.break_end = None
                        record.status = "on_break"
                        status = "break_started"

                elif action == "break_end":
                    if not record.check_in:
                        # 🔹 new case: ending break without check-in
                        status = "cannot_end_break_no_checkin"
                    elif record.check_out:
                        status = "already_checked_out"
                    elif not record.break_start:
                        # 🔹 new case: ending break without starting it
                        status = "break_not_started"
                    elif record.break_end:
                        status = "already_break_ended"
                    else:
                        record.break_end = now_jst
                        record.status = "checked_in"
                        calculate_total_work(record)
                        status = "break_ended"

                elif action == "checkout":
                    if not record.check_in:
                        status = "checkin_missing"
                    elif record.check_out:
                        status = "already_checked_out"
                    elif record.break_start and not record.break_end:
                        status = "cannot_checkout_on_break"
                    else:
                        record.check_out = now_jst
                        record.status = "checked_out"
                        calculate_total_work(record)
                        status = "checked_out"

                else:
                    status = "invalid_action"

                # --- Commit after each ---
                db.commit()
                db.flush()

                results.append({
                    "name": user.name,
                    "employee_id": user.employee_id,
                    "status": status,
                    "confidence": confidence,
                    "timestamp": now_jst.strftime("%Y-%m-%d %H:%M:%S"),
                })

            except Exception as e:
                db.rollback()
                print(f"⚠️ Error processing {face}: {e}")
                results.append({
                    "name": "Unknown",
                    "employee_id": face.get("employee_id"),
                    "status": "db_error",
                    "confidence": face.get("confidence", 0),
                    "timestamp": datetime.now(JST).strftime("%Y-%m-%d %H:%M:%S"),
                })

    print("✅ Results prepared for frontend:", results)
    return {"results": results}