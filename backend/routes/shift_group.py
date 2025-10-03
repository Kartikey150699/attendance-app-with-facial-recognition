from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.ShiftGroup import ShiftGroup
from models.EmployeeGroup import EmployeeGroup
from models.User import User
from models.Shift import Shift
from datetime import date, timedelta
from pydantic import BaseModel
from typing import Optional, Dict, List

router = APIRouter(prefix="/shift-groups", tags=["Shift Groups"])

# -------------------------
# DB Session dependency
# -------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -------------------------
# Pydantic Schemas
# -------------------------
class ShiftGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    schedule: Dict[str, List[str]]   # e.g. {"mon": ["10:00","19:00"], "tue": "-", ...}

class AssignEmployeeRequest(BaseModel):
    employee_id: str
    group_id: int


# -------------------------
# Create a new shift group
# -------------------------
@router.post("/create")
def create_group(payload: ShiftGroupCreate, db: Session = Depends(get_db)):
    if not payload.schedule:
        raise HTTPException(status_code=400, detail="Schedule is required")

    # Ensure group name is unique
    existing = db.query(ShiftGroup).filter(ShiftGroup.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Group name already exists")

    group = ShiftGroup(
        name=payload.name,
        description=payload.description,
        schedule=payload.schedule
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return {"message": "✅ Shift group created", "data": group}


# -------------------------
# Assign employee to a group
# -------------------------
@router.post("/assign")
def assign_employee(payload: AssignEmployeeRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.employee_id == payload.employee_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    group = db.query(ShiftGroup).filter(ShiftGroup.id == payload.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Check if already assigned
    existing = (
        db.query(EmployeeGroup)
        .filter(EmployeeGroup.employee_id == payload.employee_id, EmployeeGroup.group_id == payload.group_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Employee already in this group")

    # Save assignment
    mapping = EmployeeGroup(employee_id=payload.employee_id, group_id=payload.group_id)
    db.add(mapping)

    # Auto-generate shifts for next 30 days
    today = date.today()
    for i in range(30):
        d = today + timedelta(days=i)
        weekday = d.strftime("%a").lower()[:3]  # mon, tue, wed, etc.

        if group.schedule.get(weekday) and group.schedule[weekday] != "-":
            start, end = group.schedule[weekday]

            # Avoid duplicate shift for same employee/date
            existing_shift = (
                db.query(Shift)
                .filter(Shift.employee_id == payload.employee_id, Shift.date == d)
                .first()
            )
            if not existing_shift:
                shift = Shift(
                    employee_id=payload.employee_id,
                    department=user.department,
                    date=d,
                    start_time=start,
                    end_time=end,
                    assigned_by="Group Assignment",
                )
                db.add(shift)

    db.commit()
    return {"message": f"✅ Employee {payload.employee_id} assigned to group {payload.group_id} and shifts generated"}


# -------------------------
# List all groups
# -------------------------
@router.get("/")
def list_groups(db: Session = Depends(get_db)):
    return db.query(ShiftGroup).all()


# -------------------------
# List employees in a group
# -------------------------
@router.get("/{group_id}/employees")
def list_group_employees(group_id: int, db: Session = Depends(get_db)):
    return db.query(EmployeeGroup).filter(EmployeeGroup.group_id == group_id).all()


# -------------------------
# Delete a group
# -------------------------
@router.delete("/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(ShiftGroup).filter(ShiftGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    db.delete(group)
    db.commit()
    return {"message": "✅ Shift group deleted"}

# -------------------------
# Update/Edit an existing group
# -------------------------
class ShiftGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schedule: Optional[Dict[str, List[str]]] = None   # e.g. {"mon": ["09:00","18:00"], "wed": ["10:00","19:00"]}

@router.put("/{group_id}")
def update_group(group_id: int, payload: ShiftGroupUpdate, db: Session = Depends(get_db)):
    group = db.query(ShiftGroup).filter(ShiftGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Check unique name constraint if updating name
    if payload.name and payload.name != group.name:
        existing = db.query(ShiftGroup).filter(ShiftGroup.name == payload.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Group name already exists")
        group.name = payload.name

    # Update other fields
    if payload.description is not None:
        group.description = payload.description
    if payload.schedule is not None:
        group.schedule = payload.schedule

    db.commit()
    db.refresh(group)
    return {"message": "✅ Shift group updated", "data": group}