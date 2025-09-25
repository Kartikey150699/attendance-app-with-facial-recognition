from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from utils.db import get_db
from models.PaidHoliday import PaidHoliday
from models.User import User
from datetime import date

router = APIRouter(prefix="/paid-holidays", tags=["Paid Holidays"])


# -----------------------------
# Serializer: always include department from User
# -----------------------------
def serialize_paid_holiday(holiday: PaidHoliday, user: User = None):
    return {
        "id": holiday.id,
        "employee_id": holiday.employee_id,
        "employee_name": holiday.employee_name,
        "department": user.department if user else "-",   # always from User
        "total_quota": holiday.total_quota,
        "used_days": holiday.used_days,
        "remaining_days": holiday.remaining_days,
        "valid_from": holiday.valid_from,
        "valid_till": holiday.valid_till,
        "assigned_date": holiday.assigned_date,
        "created_by": holiday.created_by,
    }


# -----------------------------
# Get all paid holiday quotas
# -----------------------------
@router.get("/")
def get_paid_holidays(db: Session = Depends(get_db)):
    holidays = db.query(PaidHoliday).all()
    results = []
    for h in holidays:
        # Match with employee_id in User table
        user = db.query(User).filter(User.employee_id == h.employee_id).first()
        results.append(serialize_paid_holiday(h, user))
    return results


# -----------------------------
# Assign a new paid holiday quota
# -----------------------------
@router.post("/")
def create_paid_holiday(holiday: dict, db: Session = Depends(get_db)):
    required_fields = ["employee_id", "employee_name", "total_quota", "created_by"]
    for field in required_fields:
        if field not in holiday:
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    total = holiday["total_quota"]
    used = holiday.get("used_days", 0)
    remaining = total - used if total >= used else 0

    new_holiday = PaidHoliday(
        employee_id=holiday["employee_id"],
        employee_name=holiday["employee_name"],
        total_quota=total,
        used_days=used,
        remaining_days=remaining,
        valid_from=holiday.get("valid_from", date.today()),
        valid_till=holiday.get("valid_till"),
        assigned_date=date.today(),
        created_by=holiday["created_by"],
    )

    db.add(new_holiday)
    db.commit()
    db.refresh(new_holiday)

    # Match with employee_id in User table
    user = db.query(User).filter(User.employee_id == new_holiday.employee_id).first()
    return serialize_paid_holiday(new_holiday, user)


# -----------------------------
# Update an existing quota
# -----------------------------
@router.put("/{holiday_id}")
def update_paid_holiday(holiday_id: int, holiday: dict, db: Session = Depends(get_db)):
    db_holiday = db.query(PaidHoliday).filter(PaidHoliday.id == holiday_id).first()
    if not db_holiday:
        raise HTTPException(status_code=404, detail="Paid holiday record not found")

    if "total_quota" in holiday:
        db_holiday.total_quota = holiday["total_quota"]

    if "used_days" in holiday:
        db_holiday.used_days = holiday["used_days"]

    db_holiday.remaining_days = db_holiday.total_quota - db_holiday.used_days
    db_holiday.valid_from = holiday.get("valid_from", db_holiday.valid_from)
    db_holiday.valid_till = holiday.get("valid_till", db_holiday.valid_till)

    db.commit()
    db.refresh(db_holiday)

    # Match with employee_id in User table
    user = db.query(User).filter(User.employee_id == db_holiday.employee_id).first()
    return serialize_paid_holiday(db_holiday, user)


# -----------------------------
# Delete quota
# -----------------------------
@router.delete("/{holiday_id}")
def delete_paid_holiday(holiday_id: int, db: Session = Depends(get_db)):
    db_holiday = db.query(PaidHoliday).filter(PaidHoliday.id == holiday_id).first()
    if not db_holiday:
        raise HTTPException(status_code=404, detail="Paid holiday record not found")

    db.delete(db_holiday)
    db.commit()
    return {"message": "✅ Paid holiday record deleted successfully"}