from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect
from sqlalchemy.orm import Session
from utils.db import Base, engine, SessionLocal
from utils.db_init_safe import ensure_safe_foreign_keys  # Auto-fix FK safety

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
    description="Backend for FaceTrack: Face Recognition Attendance System with Shift Group Management",
    version="1.1.0"
)

# =====================================================
# CORS setup
# =====================================================
origins = [
    "http://localhost:3000",                 # local dev
    "https://attendance-face.vercel.app",    # Vercel frontend
    "https://facetrackaws.duckdns.org",      # new HTTPS backend
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
# Initialize Database
# =====================================================
init_database()

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
    - Embeddings refreshed (if users exist)
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
            print(f"✅ Refreshed embeddings successfully for {user_count} users.")

    except Exception as e:
        print(f"⚠️ Startup routine skipped: {e}")

    print("✅ System initialization complete — ready for use.")