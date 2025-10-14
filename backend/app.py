from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from utils.db import Base, engine, SessionLocal
from utils.db_init_safe import ensure_safe_foreign_keys  # Auto-fix FK safety
import os

# =====================================================
# Route Imports
# =====================================================
from routes import (
    users,
    attendance,
    admin,
    logs,
    work_applications,
    holiday,
    hr_logs,
    paid_holidays,
    approvers,
    shifts,
    shift_group
)

# =====================================================
# Model Imports
# =====================================================
from models import (
    User,
    Attendance,
    Admin,
    WorkApplication,
    Holiday,
    PaidHoliday,
    Approver,
    Shift
)

# =====================================================
# FastAPI App
# =====================================================
app = FastAPI(
    title="FaceTrack Attendance + Shift Groups API",
    description="Backend for FaceTrack: Face Recognition Attendance System with Shift Management",
    version="1.2.0"
)

# =====================================================
# CORS setup
# =====================================================
origins = [
    "http://localhost:3000",                 # Local frontend
    "https://attendance-face.vercel.app",    # Vercel frontend
    "https://facetrackaws.duckdns.org",      # AWS-hosted backend
    "http://13.114.163.222",                 # Allow frontend to call backend via IP
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# Router Registration
# =====================================================
app.include_router(users.router)
app.include_router(attendance.router)
app.include_router(admin.router)
app.include_router(logs.router)
app.include_router(work_applications.router)
app.include_router(holiday.router)
app.include_router(hr_logs.router)
app.include_router(paid_holidays.router)
app.include_router(approvers.router)
app.include_router(shifts.router)
app.include_router(shift_group.router)

# =====================================================
# Root Endpoint
# =====================================================
@app.get("/")
def home():
    return {
        "message": "✅ FaceTrack Backend is running 🚀 - Visit http://localhost:3000 for the FaceTrack App."
    }

# =====================================================
# Auto-create Tables (if missing)
# =====================================================
def init_database():
    """
    Check if all required tables exist.
    If not, create them silently and safely.
    """
    try:
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()

        required_tables = [
            "users", "attendance", "admin", "work_applications",
            "holiday", "paid_holidays", "approvers", "shifts", "shift_groups"
        ]

        missing_tables = [t for t in required_tables if t not in existing_tables]

        if missing_tables:
            Base.metadata.create_all(bind=engine)
            print(f"🧱 Created missing tables: {', '.join(missing_tables)}")
        else:
            print("✅ All required tables exist.")
    except Exception as e:
        print(f"⚠️ Database initialization skipped: {e}")


# =====================================================
# Ensure Missing Columns (e.g., threshold)
# =====================================================
def ensure_missing_columns():
    """
    Automatically adds missing columns to existing tables (for simple schema updates).
    Example: adds 'threshold' to 'users' if not found.
    """
    try:
        with engine.connect() as conn:
            # Check if 'threshold' column exists in the 'users' table
            result = conn.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'users'
            """))
            existing_columns = [row[0] for row in result]

            if "threshold" not in existing_columns:
                conn.execute(text("""
                    ALTER TABLE users
                    ADD COLUMN threshold FLOAT DEFAULT 0.40 NOT NULL
                """))
                print("✅ Added missing column: users.threshold (default 0.40)")
            else:
                print("✅ Column 'threshold' already exists in 'users' table.")

    except Exception as e:
        print(f"⚠️ Column check failed: {e}")


# =====================================================
# Initialize Database
# =====================================================
init_database()
ensure_missing_columns()

# =====================================================
# Global Cache (for frontend embedding requests)
# =====================================================
cached_embeddings = {}

def refresh_embedding_cache():
    """
    Load embeddings from database once for frontend ONNX recognition.
    """
    from routes.attendance import get_embeddings_cache
    try:
        global cached_embeddings
        cached_embeddings = get_embeddings_cache()
        print(f"✅ Cached {len(cached_embeddings)} user embeddings for hybrid frontend.")
    except Exception as e:
        print(f"⚠️ Embedding cache refresh failed: {e}")

# =====================================================
# Serve ArcFace ONNX Model + User Embeddings
# =====================================================
@app.get("/models/arcface.onnx")
def get_arcface_model():
    model_path = "models/arcface.onnx"
    if not os.path.exists(model_path):
        return JSONResponse({"error": "arcface.onnx not found"}, status_code=404)
    return FileResponse(model_path, media_type="application/octet-stream")

@app.get("/users/embeddings")
def get_embeddings():
    """
    Returns a compact JSON of user embeddings for frontend instant recognition.
    Example:
    { "Kartikey": [0.0023, 0.45, ...], "Amit": [...] }
    """
    try:
        if not cached_embeddings:
            refresh_embedding_cache()
        return JSONResponse(cached_embeddings)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# =====================================================
# Startup Event (Embeddings + Safe FK Setup)
# =====================================================
@app.on_event("startup")
def startup_event():
    """
    Run once when the app starts.
    Ensures:
    - Tables exist
    - Foreign keys are safe (ON DELETE SET NULL)
    - Embeddings refreshed (for backend + frontend cache)
    """
    try:
        inspector = inspect(engine)
        if "users" not in inspector.get_table_names():
            print("⚠️ No 'users' table found, skipping embedding refresh.")
            return

        # Step 1: Ensure foreign key safety
        ensure_safe_foreign_keys()

        # Step 2: Refresh embeddings
        from models.User import User
        from routes.attendance import refresh_embeddings

        with SessionLocal() as db:
            user_count = db.query(User).count()

        if user_count == 0:
            print("ℹ️ No users found — skipping embedding refresh.")
        else:
            refresh_embeddings()
            refresh_embedding_cache()
            print(f"✅ Refreshed embeddings successfully for {user_count} users.")

    except Exception as e:
        print(f"⚠️ Startup routine skipped: {e}")

    print("✅ System initialization complete — ready for use.")