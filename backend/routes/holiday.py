from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from utils.db import get_db
from models.Holiday import Holiday
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/holiday", tags=["Holiday Management"])

# -----------------------------
# Pydantic Schemas
# -----------------------------
class HolidayBase(BaseModel):
    date: date
    holiday_name: str
    created_by: Optional[int] = None  # Admin ID (nullable)


class HolidayUpdate(BaseModel):
    date: date
    holiday_name: str
    created_by: Optional[int] = None


class HolidayResponse(BaseModel):
    id: int
    date: date
    holiday_name: str
    created_by: Optional[int]
    created_at: datetime

    class Config:
        orm_mode = True


# -----------------------------
# Routes
# -----------------------------

# Get all holidays
@router.get("/", response_model=List[HolidayResponse])
def get_holidays(db: Session = Depends(get_db)):
    holidays = db.query(Holiday).order_by(Holiday.date.asc()).all()
    return holidays


# Add a holiday
@router.post("/", response_model=HolidayResponse)
def add_holiday(payload: HolidayBase, db: Session = Depends(get_db)):
    # 🔹 Remove uniqueness check if you want multiple holidays on same date
    existing = db.query(Holiday).filter(Holiday.date == payload.date).first()
    if existing:
        raise HTTPException(status_code=400, detail="Holiday already exists on this date")

    new_holiday = Holiday(
        date=payload.date,
        holiday_name=payload.holiday_name,
        created_by=payload.created_by,  # ✅ keep it integer (nullable)
    )
    db.add(new_holiday)
    db.commit()
    db.refresh(new_holiday)
    return new_holiday


# Update holiday
@router.put("/{holiday_id}", response_model=HolidayResponse)
def update_holiday(holiday_id: int, payload: HolidayUpdate, db: Session = Depends(get_db)):
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")

    holiday.date = payload.date
    holiday.holiday_name = payload.holiday_name
    holiday.created_by = payload.created_by

    db.commit()
    db.refresh(holiday)
    return holiday


# Delete holiday
@router.delete("/{holiday_id}")
def delete_holiday(holiday_id: int, db: Session = Depends(get_db)):
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")

    db.delete(holiday)
    db.commit()
    return {"message": "Holiday deleted successfully"}