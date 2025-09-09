from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware  # ✅ for React frontend
from routes import users, attendance, admin

from utils.db import Base, engine
from models.User import User
from models.Attendance import Attendance
from models.Admin import Admin

# ----------------------
# FastAPI App
# ----------------------
app = FastAPI(title="FaceTrack Attendance API")

# ----------------------
# CORS setup for React frontend
# ----------------------
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

# ----------------------
# Routers
# ----------------------
app.include_router(users.router)
app.include_router(attendance.router)  # ✅ contains /preview + /mark
app.include_router(admin.router)

# ----------------------
# Root endpoint
# ----------------------
@app.get("/")
def home():
    return {"message": "FaceTrack Backend is running 🚀"}

# ----------------------
# Create tables if not exist
# ----------------------
Base.metadata.create_all(bind=engine)
