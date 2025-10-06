from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect
from sqlalchemy.orm import Session
from utils.db import Base, engine, SessionLocal

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
    "http://localhost:3000",  # React dev server
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
# Root endpoint
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
    If not, create them — silently and safely.
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
            print(f"Created missing tables: {', '.join(missing_tables)}")
        else:
            print("✅ All required tables exist.")
    except Exception as e:
        print(f"⚠️ Database initialization skipped: {e}")

# =====================================================
# Initialize Database
# =====================================================
init_database()

# =====================================================
# Load Embeddings AFTER tables exist
# =====================================================
@app.on_event("startup")
def startup_event():
    """
    Run once when the app starts.
    Ensures all tables exist, then safely refresh embeddings if users exist.
    Compatible with macOS and Windows.
    """
    try:
        inspector = inspect(engine)
        if "users" not in inspector.get_table_names():
            print("⚠️ Skipping embedding refresh — 'users' table not found yet.")
            return

        from routes.attendance import refresh_embeddings
        from models import User

        with SessionLocal() as db:
            user_count = db.query(User).count()

        if user_count == 0:
            print("No users found — skipping embedding refresh.")
        else:
            refresh_embeddings()
            print(f"✅ Refreshed embeddings successfully for {user_count} users.")

    except Exception as e:
        print(f"⚠️ Startup embedding refresh skipped: {e}")

    print("✅ System initialization complete — ready for use.")