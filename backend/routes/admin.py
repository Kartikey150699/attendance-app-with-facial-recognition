from fastapi import APIRouter, Form, Depends
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.Admin import Admin
from passlib.context import CryptContext

router = APIRouter(prefix="/admin", tags=["Admin"])

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Dependency: DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -------------------------
# Create first admin
# -------------------------
@router.post("/create")
def create_admin(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    # Check if username exists
    if db.query(Admin).filter(Admin.username == username).first():
        return {"error": "Admin username already exists"}
    
    hashed_password = pwd_context.hash(password)
    admin = Admin(username=username, password=hashed_password)
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return {"message": f"Admin {username} created successfully!"}

# -------------------------
# Admin login
# -------------------------
@router.post("/login")
def admin_login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.username == username).first()
    if not admin:
        return {"error": "Invalid username or password"}
    
    if not pwd_context.verify(password, admin.password):
        return {"error": "Invalid username or password"}
    
    return {"message": f"Welcome {username}!"}
