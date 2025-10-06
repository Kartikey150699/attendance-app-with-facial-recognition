from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect
from sqlalchemy.orm import Session
from utils.db import Base, engine, SessionLocal

# absolute imports
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

# Optional: if you have embedding logic in utils/face_utils or similar
try:
    from utils.face_utils import load_embeddings  # adjust path if needed
except ImportError:
    load_embeddings = None


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
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    required_tables = [
        "users", "attendance", "admin", "work_applications",
        "holiday", "paid_holidays", "approvers", "shifts", "shift_groups"
    ]

    missing_tables = [t for t in required_tables if t not in existing_tables]

    if missing_tables:
        print(f"Creating missing tables: {missing_tables}")
        Base.metadata.create_all(bind=engine)
    else:
        print("All tables already exist.")

# =====================================================
# Initialize Database and Embeddings
# =====================================================
init_database()

@app.on_event("startup")
def startup_event():
    """Run after app startup: refresh embeddings safely."""
    try:
        from routes.attendance import refresh_embeddings
        refresh_embeddings()
        print("Embeddings cache initialized successfully.")
    except Exception as e:
        print(f"⚠️ Could not refresh embeddings at startup: {e}")