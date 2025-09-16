from fastapi import APIRouter, Form, Depends
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.Admin import Admin

router = APIRouter(prefix="/admin", tags=["Admin"])

# Database session dependency
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

    # Save new admin
    admin = Admin(username=username, password=password)
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

    if not admin or str(admin.password).strip() != str(password).strip():
        return {"error": "Invalid username or password. Try again!"}

    # Return admin info so frontend can store
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

    if str(admin.password).strip() != str(old_password).strip():
        return {"error": "Old password does not match, try again!"}

    if str(old_password).strip() == str(new_password).strip():
        return {"error": "Old password and new password cannot be the same!"}

    # Update password
    admin.password = new_password
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
    # Prevent deleting yourself
    if username == current_admin:
        return {"error": "You cannot delete yourself. Contact another admin."}

    # Check if target admin exists
    admin = db.query(Admin).filter(Admin.username == username).first()
    if not admin:
        return {"error": f"Admin '{username}' does not exist"}

    # Delete admin row
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