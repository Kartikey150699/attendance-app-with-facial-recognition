from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.Shift import Shift
from models.User import User
from datetime import date, timedelta
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
    date_: date
    start_time: str
    end_time: str
    assigned_by: str  # 👈 NEW (admin/HR who assigned)


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
        last_day = calendar.monthrange(year, month)[1]
        end_date = date(year, month, last_day)
        query = query.filter(Shift.date >= start_date, Shift.date <= end_date)

    elif week:
        # Weekly filter (ISO week: Monday=1, Sunday=7)
        first_day = date.fromisocalendar(year, week, 1)
        last_day = first_day + timedelta(days=6)
        query = query.filter(Shift.date >= first_day, Shift.date <= last_day)

    else:
        # Default = current week
        current_week = today.isocalendar()[1]
        first_day = date.fromisocalendar(year, current_week, 1)
        last_day = first_day + timedelta(days=6)
        query = query.filter(Shift.date >= first_day, Shift.date <= last_day)

    return query.all()


# -------------------------
# Assign or update a shift (per employee)
# -------------------------
@router.post("/assign")
def assign_shift(payload: ShiftAssignRequest, db: Session = Depends(get_db)):
    # Verify employee exists
    user = db.query(User).filter(User.employee_id == payload.employee_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if shift already exists for this employee & date
    existing_shift = (
        db.query(Shift)
        .filter(Shift.employee_id == payload.employee_id, Shift.date == payload.date_)
        .first()
    )

    if existing_shift:
        # Update existing shift
        existing_shift.start_time = payload.start_time
        existing_shift.end_time = payload.end_time
        existing_shift.assigned_by = payload.assigned_by
        db.commit()
        db.refresh(existing_shift)
        return {"message": "Shift updated successfully", "data": existing_shift}

    else:
        # Insert new shift
        shift = Shift(
            employee_id=payload.employee_id,
            department=user.department,
            date=payload.date_,
            start_time=payload.start_time,
            end_time=payload.end_time,
            assigned_by=payload.assigned_by,  # saved from frontend/admin
        )
        db.add(shift)
        db.commit()
        db.refresh(shift)
        return {"message": "Shift assigned successfully", "data": shift}


# -------------------------
# Delete a shift by employee & date
# -------------------------
@router.delete("/delete-by-date")
def delete_shift_by_date(
    employee_id: str,
    date_: date,
    db: Session = Depends(get_db),
):
    shift = (
        db.query(Shift)
        .filter(Shift.employee_id == employee_id, Shift.date == date_)
        .first()
    )
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    db.delete(shift)
    db.commit()
    return {"message": "Shift deleted successfully"}