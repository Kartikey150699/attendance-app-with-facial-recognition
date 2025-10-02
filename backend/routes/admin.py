from fastapi import APIRouter, Form, Depends
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.Admin import Admin
from utils.security import get_password_hash, verify_password

router = APIRouter(prefix="/admin", tags=["Admin"])

# DB session dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Create admin
@router.post("/create")
def create_admin(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    # Check if admin already exists
    if db.query(Admin).filter(Admin.username == username).first():
        return {"error": f"Admin '{username}' already exists"}

    # Hash password before saving
    hashed_password = get_password_hash(password)

    admin = Admin(username=username, password=hashed_password)
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return {"message": f"Admin '{username}' created successfully!"}


# Admin login
@router.post("/login")
def admin_login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    admin = db.query(Admin).filter(Admin.username == username).first()

    # Verify password with hashing
    if not admin or not verify_password(password, admin.password):
        return {"error": "Invalid username or password. Try again!"}

    return {
        "message": f"Welcome {admin.username}!",
        "admin": {
            "id": admin.id,
            "username": admin.username
        }
    }


# Change password
@router.post("/change-password")
def change_password(
    username: str = Form(...),
    old_password: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db)
):
    admin = db.query(Admin).filter(Admin.username == username).first()

    if not admin:
        return {"error": "Admin not found"}

    # Verify old password
    if not verify_password(old_password, admin.password):
        return {"error": "Old password does not match, try again!"}

    # Prevent same old/new password
    if verify_password(new_password, admin.password):
        return {"error": "Old password and new password cannot be the same!"}

    # Hash new password before saving
    admin.password = get_password_hash(new_password)
    db.commit()
    db.refresh(admin)
    return {"message": f"Password updated successfully for '{username}'!"}


# Delete admin
@router.post("/delete")
def delete_admin(
    username: str = Form(...),
    current_admin: str = Form(...),  # Must be passed from frontend
    db: Session = Depends(get_db)
):
    if username == current_admin:
        return {"error": "You cannot delete yourself. Contact another admin."}

    admin = db.query(Admin).filter(Admin.username == username).first()
    if not admin:
        return {"error": f"Admin '{username}' does not exist"}

    db.delete(admin)
    db.commit()
    return {"message": f"Admin '{username}' deleted successfully!"}


# List all admins
@router.get("/list")
def list_admins(db: Session = Depends(get_db)):
    admins = db.query(Admin).all()
    return {
        "admins": [
            {"id": admin.id, "username": admin.username}
            for admin in admins
        ]
    }