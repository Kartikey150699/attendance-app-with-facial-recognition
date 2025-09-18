from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from utils.db import get_db
from models.Holiday import Holiday
from datetime import date
from typing import List

router = APIRouter(prefix="/holiday", tags=["Holiday Management"])

# Get all holidays
@router.get("/", response_model=List[dict])
def get_holidays(db: Session = Depends(get_db)):
    holidays = db.query(Holiday).all()
    return [
        {
            "id": h.id,
            "date": h.date,
            "holiday_name": h.holiday_name,
            "created_by": h.created_by,
            "created_at": h.created_at,
        }
        for h in holidays
    ]

# Add a holiday
@router.post("/")
def add_holiday(holiday_date: date, holiday_name: str, db: Session = Depends(get_db)):
    # Check duplicate
    existing = db.query(Holiday).filter(Holiday.date == holiday_date).first()
    if existing:
        raise HTTPException(status_code=400, detail="Holiday already exists on this date")

    new_holiday = Holiday(date=holiday_date, holiday_name=holiday_name)
    db.add(new_holiday)
    db.commit()
    db.refresh(new_holiday)
    return {"message": "Holiday added successfully", "holiday": {
        "id": new_holiday.id,
        "date": new_holiday.date,
        "holiday_name": new_holiday.holiday_name
    }}

# Update holiday (date or name)
@router.put("/{holiday_id}")
def update_holiday(holiday_id: int, holiday_date: date, holiday_name: str, db: Session = Depends(get_db)):
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")

    holiday.date = holiday_date
    holiday.holiday_name = holiday_name
    db.commit()
    db.refresh(holiday)
    return {"message": "Holiday updated successfully", "holiday": {
        "id": holiday.id,
        "date": holiday.date,
        "holiday_name": holiday.holiday_name
    }}

# Delete holiday
@router.delete("/{holiday_id}")
def delete_holiday(holiday_id: int, db: Session = Depends(get_db)):
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")

    db.delete(holiday)
    db.commit()
    return {"message": "Holiday deleted successfully"}