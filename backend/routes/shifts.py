from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.Shift import Shift
from models.User import User
from datetime import date, datetime, timedelta
from pydantic import BaseModel
import calendar

router = APIRouter(prefix="/shifts", tags=["Shifts"])


# =====================================================
# DB session dependency
# =====================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =====================================================
# Schema
# =====================================================
class ShiftAssignRequest(BaseModel):
    employee_id: str
    date_: str
    start_time: str
    end_time: str
    assigned_by: str


# =====================================================
# Helper: Safe serialization
# =====================================================
def serialize_shift(shift: Shift):
    """Convert Shift ORM to JSON-safe dict."""
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


# =====================================================
# Get all shifts (supports filters)
# =====================================================
@router.get("/")
def get_shifts(
    year: int = Query(None, description="Year (default=current)"),
    month: int = Query(None, description="Month (1-12)"),
    week: int = Query(None, description="ISO Week (1-53)"),
    employee_id: str = Query(None, description="Optional employee filter"),
    db: Session = Depends(get_db),
):
    today = date.today()
    if not year:
        year = today.year

    query = db.query(Shift)

    if employee_id:
        query = query.filter(Shift.employee_id == employee_id)

    if month:
        start_date = date(year, month, 1)
        end_date = date(year, month, calendar.monthrange(year, month)[1])
        query = query.filter(Shift.date.between(start_date, end_date))
    elif week:
        first_day = date.fromisocalendar(year, week, 1)
        last_day = first_day + timedelta(days=6)
        query = query.filter(Shift.date.between(first_day, last_day))
    else:
        # Default: show ±60 days window
        start_date = today - timedelta(days=7)
        end_date = today + timedelta(days=60)
        query = query.filter(Shift.date.between(start_date, end_date))

    shifts = query.order_by(Shift.date.asc()).all()
    return [serialize_shift(s) for s in shifts]


# =====================================================
# Assign or update a shift
# =====================================================
@router.post("/assign")
def assign_shift(payload: ShiftAssignRequest, db: Session = Depends(get_db)):
    """
    Assign or update a shift safely.
    Cleans invalid times like 00:00 or empty values → '-'
    Prevents '00:00-00:00' from being stored or shown.
    """

    # ---- Parse and validate date ----
    try:
        local_date = datetime.strptime(payload.date_, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format (YYYY-MM-DD)")

    # ---- Find user ----
    user = db.query(User).filter(User.employee_id == payload.employee_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # ---- Normalize time values ----
    def normalize_time(value: str) -> str:
        if not value:
            return "-"
        value = value.strip()
        if value in ["", "00:00", "0:00", "-", "None", "null", "--:--"]:
            return "-"
        if len(value) < 4 or ":" not in value:
            return "-"
        return value

    start_time = normalize_time(payload.start_time)
    end_time = normalize_time(payload.end_time)

    # If either side invalid → both '-'
    if start_time == "-" or end_time == "-":
        start_time = "-"
        end_time = "-"

    # ---- Check existing shift ----
    existing_shift = (
        db.query(Shift)
        .filter(Shift.employee_id == payload.employee_id, Shift.date == local_date)
        .first()
    )

    # ---- Update existing ----
    if existing_shift:
        # Prevent overwriting a valid shift with "-"
        if start_time == "-" and end_time == "-" and (
            existing_shift.start_time not in ["-", "00:00"]
            or existing_shift.end_time not in ["-", "00:00"]
        ):
            # Keep old times if new ones are placeholder
            pass
        else:
            existing_shift.start_time = start_time
            existing_shift.end_time = end_time
            existing_shift.assigned_by = payload.assigned_by
            db.commit()
            db.refresh(existing_shift)
        return {
            "message": "Shift updated successfully",
            "data": serialize_shift(existing_shift),
        }

    # ---- Create new ----
    new_shift = Shift(
        employee_id=payload.employee_id,
        department=user.department,
        date=local_date,
        start_time=start_time,
        end_time=end_time,
        assigned_by=payload.assigned_by,
    )
    db.add(new_shift)
    db.commit()
    db.refresh(new_shift)
    return {"message": "Shift assigned successfully", "data": serialize_shift(new_shift)}


# =====================================================
# Delete shift by employee + date
# =====================================================
@router.delete("/delete-by-date")
def delete_shift_by_date(employee_id: str, date_: str, db: Session = Depends(get_db)):
    """Delete a shift by employee_id and date."""
    try:
        local_date = datetime.strptime(date_, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format (YYYY-MM-DD)")

    shift = (
        db.query(Shift)
        .filter(Shift.employee_id == employee_id, Shift.date == local_date)
        .first()
    )
    if not shift:
        # Instead of raising 404, just respond 200 OK
        return {
            "message": f"No existing shift found for {employee_id} on {local_date} — nothing to delete.",
            "deleted": False
        }
    db.delete(shift)
    db.commit()
    return {"message": "Shift deleted successfully"}