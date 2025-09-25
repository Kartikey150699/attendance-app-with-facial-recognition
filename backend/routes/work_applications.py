from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from utils.db import get_db
from models.WorkApplication import WorkApplication
from models.PaidHoliday import PaidHoliday 
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(
    prefix="/work-applications",
    tags=["Work Applications"]
)

# -----------------------------
# Pydantic model for status update
# -----------------------------
class StatusUpdate(BaseModel):
    status: str
    hr_notes: Optional[str] = None


# -----------------------------
# Get all work applications
# -----------------------------
@router.get("/")
def get_work_applications(db: Session = Depends(get_db)):
    apps = db.query(WorkApplication).all()
    return apps


# -----------------------------
# Create new work application
# -----------------------------
@router.post("/")
async def create_work_application(request: Request, db: Session = Depends(get_db)):
    data = await request.json()

    # Required fields
    employee_id = data.get("employee_id")
    name = data.get("name")
    application_type = data.get("application_type")
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    reason = data.get("reason")

    if not all([employee_id, name, application_type, start_date, end_date, reason]):
        raise HTTPException(status_code=400, detail="Missing required fields")

    # Optional fields
    start_time = data.get("start_time")
    end_time = data.get("end_time")
    use_paid_holiday = data.get("use_paid_holiday", "no")  # default = no

    # -----------------------------
    # Deduct Paid Holidays if opted
    # -----------------------------
    if use_paid_holiday == "yes":
        ph = db.query(PaidHoliday).filter(PaidHoliday.employee_id == employee_id).first()
        if not ph:
            raise HTTPException(status_code=400, detail="No paid holiday quota assigned")

        # Calculate number of days requested
        try:
            s_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            e_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")

        days_requested = (e_date - s_date).days + 1  # inclusive
        if ph.remaining_days < days_requested:
            raise HTTPException(status_code=400, detail="Not enough paid holidays remaining")

        # Deduct
        ph.used_days += days_requested
        ph.remaining_days -= days_requested
        db.add(ph)

    # -----------------------------
    # Create new application
    # -----------------------------
    new_app = WorkApplication(
        employee_id=employee_id,
        name=name,
        application_type=application_type,
        start_date=start_date,
        end_date=end_date,
        start_time=start_time,
        end_time=end_time,
        reason=reason,
        use_paid_holiday=use_paid_holiday,
    )

    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return new_app


# -----------------------------
# Update status of application
# -----------------------------
@router.put("/{app_id}/status")
def update_status(app_id: int, payload: StatusUpdate, db: Session = Depends(get_db)):
    app = db.query(WorkApplication).filter(WorkApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # If previously marked as paid holiday and now rejected → restore
    if app.use_paid_holiday == "yes" and payload.status == "Rejected" and app.status != "Rejected":
        ph = db.query(PaidHoliday).filter(PaidHoliday.employee_id == app.employee_id).first()
        if ph:
            # Calculate days requested
            days_requested = (app.end_date - app.start_date).days + 1
            ph.used_days -= days_requested
            ph.remaining_days += days_requested
            if ph.used_days < 0:
                ph.used_days = 0
            db.add(ph)

    app.status = payload.status
    app.hr_notes = payload.hr_notes
    db.commit()
    db.refresh(app)
    return app


# -----------------------------
# Delete application
# -----------------------------
@router.delete("/{app_id}")
def delete_application(app_id: int, db: Session = Depends(get_db)):
    app = db.query(WorkApplication).filter(WorkApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    db.delete(app)
    db.commit()
    return {"message": "Application deleted successfully"}