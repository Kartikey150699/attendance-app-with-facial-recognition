from fastapi import APIRouter, Form, Depends
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.Admin import Admin

router = APIRouter(prefix="/admin", tags=["Admin"])

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
# Create admin (plain password)
# -------------------------
@router.post("/create")
def create_admin(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    # Check if username already exists
    if db.query(Admin).filter(Admin.username == username).first():
        return {"error": "Admin username already exists"}
    
    # ⚠️ storing plain password (for now, not secure)
    admin = Admin(username=username, password=password)
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return {"message": f"Admin {username} created successfully!"}

# -------------------------
# Admin login (plain password)
# -------------------------
@router.post("/login")
def admin_login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    admin = db.query(Admin).filter(Admin.username == username).first()
    if not admin or str(admin.password).strip() != str(password).strip():
        return {"error": "Invalid username or password"}
    
    return {"message": f"Welcome {username}!"}

# -------------------------
# Change password (username + old password required)
# -------------------------
@router.post("/change-password")
def change_password(
    username: str = Form(...),
    old_password: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db)
):
    # Fetch admin by entered username
    admin = db.query(Admin).filter(Admin.username == username).first()
    if not admin:
        return {"error": "Admin not found"}
    
    # Verify old password
    if str(admin.password).strip() != str(old_password).strip():
        return {"error": "Old password does not match, try again"}
    
    # Update to new password
    admin.password = new_password
    db.commit()
    db.refresh(admin)

    return {"message": f"Password updated successfully for {username}!"}
