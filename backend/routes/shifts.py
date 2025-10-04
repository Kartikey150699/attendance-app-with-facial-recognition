from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.Shift import Shift
from models.User import User
from datetime import date, datetime, timedelta
from pydantic import BaseModel
import calendar

router = APIRouter(prefix="/shifts", tags=["Shifts"])

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
# Request model for assigning a shift
# -------------------------
class ShiftAssignRequest(BaseModel):
    employee_id: str
    date_: str  # keep as string (avoid UTC conversion)
    start_time: str
    end_time: str
    assigned_by: str  # admin/HR who assigned


# -------------------------
# Helper → serialize shift safely (fix timezone bug)
# -------------------------
def serialize_shift(shift: Shift):
    """Convert SQLAlchemy Shift object to dict with safe date format."""
    # Always format as local YYYY-MM-DD string (no UTC)
    d = shift.date
    if isinstance(d, (datetime, date)):
        d = d.strftime("%Y-%m-%d")
    return {
        "id": shift.id,
        "employee_id": shift.employee_id,
        "department": shift.department,
        "date": d,
        "start_time": shift.start_time,
        "end_time": shift.end_time,
        "assigned_by": shift.assigned_by,
    }


# -------------------------
# Get all shifts (weekly/monthly)
# -------------------------
@router.get("/")
def get_shifts(
    year: int = Query(None, description="Year (default = current year)"),
    month: int = Query(None, description="Month number (1-12)"),
    week: int = Query(None, description="ISO Week number (1-53)"),
    db: Session = Depends(get_db),
):
    today = date.today()
    if not year:
        year = today.year

    query = db.query(Shift)

    if month:
        # Monthly filter
        start_date = date(year, month, 1)
        end_date = date(year, month, calendar.monthrange(year, month)[1])
        query = query.filter(Shift.date >= start_date, Shift.date <= end_date)

    elif week:
        # Weekly filter (ISO week: Monday=1)
        first_day = date.fromisocalendar(year, week, 1)
        last_day = first_day + timedelta(days=6)
        query = query.filter(Shift.date >= first_day, Shift.date <= last_day)

    else:
        # Default = current week
        current_week = today.isocalendar()[1]
        first_day = date.fromisocalendar(year, current_week, 1)
        last_day = first_day + timedelta(days=6)
        query = query.filter(Shift.date >= first_day, Shift.date <= last_day)

    shifts = query.all()
    return [serialize_shift(s) for s in shifts]


# -------------------------
# Assign or update a shift (per employee)
# -------------------------
@router.post("/assign")
def assign_shift(payload: ShiftAssignRequest, db: Session = Depends(get_db)):
    """Create or update an employee's shift with timezone-safe date handling."""

    # Parse date string into pure local date
    try:
        local_date = datetime.strptime(payload.date_, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format (expected YYYY-MM-DD)")

    # Verify employee
    user = db.query(User).filter(User.employee_id == payload.employee_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if existing shift exists
    existing_shift = (
        db.query(Shift)
        .filter(Shift.employee_id == payload.employee_id, Shift.date == local_date)
        .first()
    )

    if existing_shift:
        existing_shift.start_time = payload.start_time
        existing_shift.end_time = payload.end_time
        existing_shift.assigned_by = payload.assigned_by
        db.commit()
        db.refresh(existing_shift)
        return {
            "message": "Shift updated successfully",
            "data": serialize_shift(existing_shift),
        }

    # New shift
    new_shift = Shift(
        employee_id=payload.employee_id,
        department=user.department,
        date=local_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        assigned_by=payload.assigned_by,
    )
    db.add(new_shift)
    db.commit()
    db.refresh(new_shift)

    return {"message": "Shift assigned successfully", "data": serialize_shift(new_shift)}


# -------------------------
# Delete a shift by employee & date
# -------------------------
@router.delete("/delete-by-date")
def delete_shift_by_date(
    employee_id: str,
    date_: str,
    db: Session = Depends(get_db),
):
    """Delete a shift safely by local date string."""
    try:
        local_date = datetime.strptime(date_, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format (expected YYYY-MM-DD)")

    shift = (
        db.query(Shift)
        .filter(Shift.employee_id == employee_id, Shift.date == local_date)
        .first()
    )

    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    db.delete(shift)
    db.commit()
    return {"message": "Shift deleted successfully"}