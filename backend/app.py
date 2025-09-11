from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# absolute imports
from routes import users, attendance, admin
from utils.db import Base, engine
from models import User, Attendance, Admin

# FastAPI App
app = FastAPI(
    title="FaceTrack Attendance API",
    description="Backend for FaceTrack: Face Recognition Attendance System",
    version="1.0.0"
)

# CORS setup (for React frontend)
origins = [
    "http://localhost:3000",  # React dev server
    # Add production domain later if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(users.router)
app.include_router(attendance.router)
app.include_router(admin.router)

# Root endpoint
@app.get("/")
def home():
    return {"message": "✅ FaceTrack Backend is running 🚀"}

# Auto-create tables
Base.metadata.create_all(bind=engine)