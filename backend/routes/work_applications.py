from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from utils.db import get_db
from models.WorkApplication import WorkApplication
from typing import Optional
from pydantic import BaseModel

router = APIRouter(
    prefix="/work-applications",
    tags=["Work Applications"]
)

# Pydantic model for status update
class StatusUpdate(BaseModel):
    status: str
    hr_notes: Optional[str] = None

# Get all work applications
@router.get("/")
def get_work_applications(db: Session = Depends(get_db)):
    apps = db.query(WorkApplication).all()
    return apps

# Create new work application
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

    new_app = WorkApplication(
        employee_id=employee_id,
        name=name,
        application_type=application_type,
        start_date=start_date,
        end_date=end_date,
        start_time=start_time,
        end_time=end_time,
        reason=reason
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return new_app

# Update status of application
@router.put("/{app_id}/status")
def update_status(app_id: int, payload: StatusUpdate, db: Session = Depends(get_db)):
    app = db.query(WorkApplication).filter(WorkApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    app.status = payload.status
    app.hr_notes = payload.hr_notes
    db.commit()
    db.refresh(app)
    return app

# Delete application
@router.delete("/{app_id}")
def delete_application(app_id: int, db: Session = Depends(get_db)):
    app = db.query(WorkApplication).filter(WorkApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    db.delete(app)
    db.commit()
    return {"message": "Application deleted successfully"}