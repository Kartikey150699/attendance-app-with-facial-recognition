from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from utils.db import SessionLocal
from models.User import User
from models.Approver import Approver
from models.WorkApplication import WorkApplication

router = APIRouter(prefix="/approvers", tags=["Approvers"])


# -------------------------
# Dependency: DB session
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
class AssignApproverRequest(BaseModel):
    work_application_id: int
    approver_id: str
    level: int


class UpdateApproverRequest(BaseModel):
    approver_id: str | None = None
    new_level: int | None = None


class UpdateApproverStatusRequest(BaseModel):
    status: str  # "Approved" | "Rejected" | "Pending"


# -------------------------
# Add Approver for Application
# -------------------------
@router.post("/assign")
def assign_approver(payload: AssignApproverRequest, db: Session = Depends(get_db)):
    work_app = db.query(WorkApplication).filter(WorkApplication.id == payload.work_application_id).first()
    approver = db.query(User).filter(User.employee_id == payload.approver_id).first()

    if not work_app:
        raise HTTPException(status_code=404, detail="Work application not found")
    if not approver:
        raise HTTPException(status_code=404, detail="Approver not found")

    # Prevent duplicate approvers
    existing = (
        db.query(Approver)
        .filter(
            Approver.work_application_id == payload.work_application_id,
            Approver.approver_id == payload.approver_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Approver already assigned to this application")

    new_approver = Approver(
        work_application_id=payload.work_application_id,
        approver_id=payload.approver_id,
        level=payload.level,
        status="Pending",
    )
    db.add(new_approver)
    db.commit()
    db.refresh(new_approver)

    return {
        "message": "✅ Approver assigned successfully",
        "data": {
            "id": new_approver.id,
            "work_application_id": new_approver.work_application_id,
            "approver_id": new_approver.approver_id,
            "approver_name": approver.name,
            "level": new_approver.level,
            "status": new_approver.status,
        },
    }


# -------------------------
# List Approvers for Application
# -------------------------
@router.get("/{work_application_id}")
def list_approvers(work_application_id: int, db: Session = Depends(get_db)):
    approvers = (
        db.query(Approver)
        .filter(Approver.work_application_id == work_application_id)
        .order_by(Approver.level.asc())
        .all()
    )
    if not approvers:
        return []

    result = []
    for a in approvers:
        approver_user = db.query(User).filter(User.employee_id == a.approver_id).first()
        result.append({
            "id": a.id,
            "work_application_id": a.work_application_id,
            "approver_id": a.approver_id,
            "approver_name": approver_user.name if approver_user else "Unknown",
            "level": a.level,
            "status": a.status,
        })

    return result


# -------------------------
# Update Approver (approver or level)
# -------------------------
@router.put("/{approver_id}/update")
def update_approver(approver_id: int, payload: UpdateApproverRequest, db: Session = Depends(get_db)):
    approver = db.query(Approver).filter(Approver.id == approver_id).first()
    if not approver:
        raise HTTPException(status_code=404, detail="Approver record not found")

    # Change approver
    if payload.approver_id:
        approver_user = db.query(User).filter(User.employee_id == payload.approver_id).first()
        if not approver_user:
            raise HTTPException(status_code=404, detail="New approver not found")

        duplicate = (
            db.query(Approver)
            .filter(
                Approver.work_application_id == approver.work_application_id,
                Approver.approver_id == payload.approver_id,
                Approver.id != approver.id
            )
            .first()
        )
        if duplicate:
            raise HTTPException(status_code=400, detail="This approver is already assigned to this application")

        approver.approver_id = payload.approver_id

    # Change level
    if payload.new_level is not None:
        approver.level = payload.new_level

    db.commit()
    db.refresh(approver)

    approver_user = db.query(User).filter(User.employee_id == approver.approver_id).first()

    return {
        "message": "✅ Approver updated successfully",
        "data": {
            "id": approver.id,
            "work_application_id": approver.work_application_id,
            "approver_id": approver.approver_id,
            "approver_name": approver_user.name if approver_user else "Unknown",
            "level": approver.level,
            "status": approver.status,
        },
    }


# -------------------------
# Update Approver Status (Sequential Workflow + Cascade rejection)
# -------------------------
@router.put("/{approver_id}/status")
def update_approver_status(
    approver_id: int, payload: UpdateApproverStatusRequest, db: Session = Depends(get_db)
):
    approver = db.query(Approver).filter(Approver.id == approver_id).first()
    if not approver:
        raise HTTPException(status_code=404, detail="Approver record not found")

    if payload.status not in ["Pending", "Approved", "Rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")

    approvers = (
        db.query(Approver)
        .filter(Approver.work_application_id == approver.work_application_id)
        .order_by(Approver.level.asc())
        .all()
    )

    current_turn = next((a for a in approvers if a.status == "Pending"), None)
    if not current_turn:
        raise HTTPException(status_code=400, detail="No pending approvers left")

    if approver.id != current_turn.id:
        raise HTTPException(status_code=403, detail="Not your turn yet")

    approver.status = payload.status

    work_app = db.query(WorkApplication).filter(WorkApplication.id == approver.work_application_id).first()
    if not work_app:
        raise HTTPException(status_code=404, detail="Work application not found")

    if payload.status == "Rejected":
        work_app.status = "Rejected"

        # Cascade rejection: mark all remaining approvers as rejected
        for higher in approvers:
            if higher.id != approver.id and higher.status == "Pending":
                higher.status = "Rejected"

    else:  # Approved
        if all(a.status == "Approved" for a in approvers):
            work_app.status = "Approved"
        else:
            work_app.status = "Pending"

    db.commit()
    db.refresh(approver)
    db.refresh(work_app)

    approver_user = db.query(User).filter(User.employee_id == approver.approver_id).first()

    return {
        "message": f"✅ Status updated to {approver.status}",
        "data": {
            "id": approver.id,
            "work_application_id": approver.work_application_id,
            "approver_id": approver.approver_id,
            "approver_name": approver_user.name if approver_user else "Unknown",
            "level": approver.level,
            "status": approver.status,
        },
        "application_status": work_app.status
    }


# -------------------------
# Delete Approver
# -------------------------
@router.delete("/{approver_id}")
def delete_approver(approver_id: int, db: Session = Depends(get_db)):
    approver = db.query(Approver).filter(Approver.id == approver_id).first()
    if not approver:
        raise HTTPException(status_code=404, detail="Approver not found")

    db.delete(approver)
    db.commit()

    return {"message": "🗑️ Approver removed successfully"}


# -------------------------
# List Applications by Approver (with rejection message)
# -------------------------
@router.get("/by-approver/{employee_id}")
def list_by_approver(employee_id: str, db: Session = Depends(get_db)):
    approvers = (
        db.query(Approver)
        .filter(Approver.approver_id == employee_id)
        .order_by(Approver.id.desc())
        .all()
    )
    if not approvers:
        return []

    result = []
    for a in approvers:
        work_app = db.query(WorkApplication).filter(WorkApplication.id == a.work_application_id).first()
        if not work_app:
            continue

        applicant = db.query(User).filter(User.employee_id == work_app.employee_id).first()
        approver_user = db.query(User).filter(User.employee_id == a.approver_id).first()

        app_approvers = (
            db.query(Approver)
            .filter(Approver.work_application_id == a.work_application_id)
            .order_by(Approver.level.asc())
            .all()
        )

        # Dynamic rejection message
        rejection_message = None
        if a.status == "Rejected":
            rejector = next((ap for ap in app_approvers if ap.status == "Rejected" and ap.level < a.level), None)
            if rejector:
                rejector_user = db.query(User).filter(User.employee_id == rejector.approver_id).first()
                rejection_message = f"Rejected earlier by {rejector_user.name if rejector_user else f'Level {rejector.level} approver'}"
            else:
                rejection_message = f"Rejected by {approver_user.name if approver_user else 'Unknown'}"

        # Check action eligibility
        can_take_action = False
        waiting_for = None
        if a.status == "Pending":
            lower_levels = [ap for ap in app_approvers if ap.level < a.level]
            if all(ap.status == "Approved" for ap in lower_levels):
                can_take_action = True
            else:
                blocking = next((ap for ap in lower_levels if ap.status != "Approved"), None)
                if blocking:
                    blocker_user = db.query(User).filter(User.employee_id == blocking.approver_id).first()
                    waiting_for = blocker_user.name if blocker_user else f"Level {blocking.level} approver"

        result.append({
            "id": a.id,
            "work_application_id": a.work_application_id,
            "approver_id": a.approver_id,
            "approver_name": approver_user.name if approver_user else "Unknown",
            "level": a.level,
            "status": a.status,
            "rejection_message": rejection_message,
            "employee_id": work_app.employee_id,
            "employee_name": applicant.name if applicant else "Unknown",
            "department": applicant.department if applicant else None,
            "application_type": work_app.application_type,
            "created_at": work_app.created_at,
            "start_date": str(work_app.start_date) if work_app.start_date else None,
            "end_date": str(work_app.end_date) if work_app.end_date else None,
            "reason": work_app.reason,
            "application_status": work_app.status,
            "can_take_action": can_take_action,
            "waiting_for": waiting_for,
        })

    return result