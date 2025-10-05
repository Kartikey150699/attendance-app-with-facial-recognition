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


# =====================================================
# DB Session dependency
# =====================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =====================================================
# Pydantic Schemas
# =====================================================
class ShiftGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    schedule: Dict[str, List[str]]  # {"mon": ["09:00", "18:00"], "tue": ["09:00", "18:00"], "sun": "-"}


class ShiftGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schedule: Optional[Dict[str, List[str]]] = None


class AssignEmployeeRequest(BaseModel):
    employee_id: str
    group_id: int


# =====================================================
# Serializer Helper
# =====================================================
def serialize_group(group: ShiftGroup):
    """Convert SQLAlchemy object to plain dict with all keys safely included."""
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "schedule": group.schedule,
    }


# =====================================================
# Helper → Regenerate shifts for an employee (today → next 60 days)
# =====================================================
def regenerate_shifts_for_employee(db: Session, user: User, group: ShiftGroup):
    today = date.today()
    end_date = today + timedelta(days=60)
    schedule = {k.lower(): v for k, v in (group.schedule or {}).items()}

    # Delete existing future group-assigned shifts
    db.query(Shift).filter(
        Shift.employee_id == user.employee_id,
        Shift.assigned_by.like("Group%"),
        Shift.date >= today,
    ).delete()

    # Create new ones
    current = today
    while current <= end_date:
        weekday = current.strftime("%a").lower()[:3]  # mon, tue, wed
        shift_def = schedule.get(weekday)

        if (
            not shift_def
            or shift_def == "-"
            or not isinstance(shift_def, list)
            or len(shift_def) != 2
        ):
            current += timedelta(days=1)
            continue

        start_time, end_time = shift_def
        if start_time == "00:00" and end_time == "00:00":
            current += timedelta(days=1)
            continue

        db.add(
            Shift(
                employee_id=user.employee_id,
                department=user.department,
                date=current,
                start_time=start_time,
                end_time=end_time,
                assigned_by=f"Group: {group.name}",
            )
        )
        current += timedelta(days=1)

    db.commit()


# =====================================================
# Create new Shift Group
# =====================================================
@router.post("/create")
def create_group(payload: ShiftGroupCreate, db: Session = Depends(get_db)):
    if not payload.schedule:
        raise HTTPException(status_code=400, detail="Schedule is required")

    existing = db.query(ShiftGroup).filter(ShiftGroup.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Group name already exists")

    normalized_schedule = {k.lower(): v for k, v in payload.schedule.items()}
    group = ShiftGroup(
        name=payload.name,
        description=payload.description,
        schedule=normalized_schedule,
    )
    db.add(group)
    db.commit()
    db.refresh(group)

    return {"message": "✅ Shift group created", "data": serialize_group(group)}


# =====================================================
# Assign employee to group + auto-generate shifts
# =====================================================
@router.post("/assign")
def assign_employee(payload: AssignEmployeeRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.employee_id == payload.employee_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    group = db.query(ShiftGroup).filter(ShiftGroup.id == payload.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Upsert EmployeeGroup
    mapping = db.query(EmployeeGroup).filter(EmployeeGroup.employee_id == payload.employee_id).first()
    if mapping:
        mapping.group_id = payload.group_id
    else:
        db.add(EmployeeGroup(employee_id=payload.employee_id, group_id=payload.group_id))
    db.commit()

    regenerate_shifts_for_employee(db, user, group)

    return {
        "message": f"✅ {payload.employee_id} assigned to group '{group.name}' and shifts regenerated.",
        "data": serialize_group(group),
    }


# =====================================================
# Get all shift groups
# =====================================================
@router.get("/")
def list_groups(db: Session = Depends(get_db)):
    groups = db.query(ShiftGroup).all()
    return [serialize_group(g) for g in groups]


# =====================================================
# Get employees in a group
# =====================================================
@router.get("/{group_id}/employees")
def list_group_employees(group_id: int, db: Session = Depends(get_db)):
    employees = db.query(EmployeeGroup).filter(EmployeeGroup.group_id == group_id).all()
    return [{"employee_id": e.employee_id, "group_id": e.group_id} for e in employees]


# =====================================================
# Update a shift group (and regenerate assigned employees' shifts)
# =====================================================
@router.put("/{group_id}")
def update_group(group_id: int, payload: ShiftGroupUpdate, db: Session = Depends(get_db)):
    group = db.query(ShiftGroup).filter(ShiftGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Unique name validation
    if payload.name and payload.name != group.name:
        exists = db.query(ShiftGroup).filter(ShiftGroup.name == payload.name).first()
        if exists:
            raise HTTPException(status_code=400, detail="Group name already exists")
        group.name = payload.name

    if payload.description is not None:
        group.description = payload.description

    if payload.schedule is not None:
        normalized_schedule = {k.lower(): v for k, v in payload.schedule.items()}
        group.schedule = normalized_schedule

    db.commit()
    db.refresh(group)

    # Regenerate shifts for all assigned employees
    mappings = db.query(EmployeeGroup).filter(EmployeeGroup.group_id == group_id).all()
    for m in mappings:
        user = db.query(User).filter(User.employee_id == m.employee_id).first()
        if user:
            regenerate_shifts_for_employee(db, user, group)

    return {"message": "✅ Shift group updated and shifts regenerated", "data": serialize_group(group)}


# =====================================================
# Delete a shift group
# =====================================================
@router.delete("/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(ShiftGroup).filter(ShiftGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    db.query(EmployeeGroup).filter(EmployeeGroup.group_id == group_id).delete()
    db.delete(group)
    db.commit()

    return {"message": "✅ Shift group deleted", "data": {"id": group_id}}


# =====================================================
# Get all employee-group mappings
# =====================================================
@router.get("/employee-groups/")
def list_all_employee_groups(db: Session = Depends(get_db)):
    mappings = db.query(EmployeeGroup).all()
    return [{"employee_id": m.employee_id, "group_id": m.group_id} for m in mappings]