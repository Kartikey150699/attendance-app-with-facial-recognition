from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.User import User
from models.Attendance import Attendance
from models.Holiday import Holiday
from models.WorkApplication import WorkApplication
from datetime import date, timedelta
from calendar import monthrange

router = APIRouter(prefix="/hr_logs", tags=["HR Logs"])

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
# HR Logs (month by month, all users × all days)
# -------------------------
@router.get("/")
def get_hr_logs(
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    start_date = date(year, month, 1)
    end_date = date(year, month, monthrange(year, month)[1])

    # Fetch all active users
    users = db.query(User).all()

    # Fetch holidays for the month
    holidays = {
        h.date: h.holiday_name
        for h in db.query(Holiday)
        .filter(Holiday.date >= start_date, Holiday.date <= end_date)
        .all()
    }

    # Fetch all attendance logs for this month
    attendance_logs = (
        db.query(Attendance)
        .filter(Attendance.date >= start_date, Attendance.date <= end_date)
        .all()
    )
    # Normalize to date
    attendance_map = {(log.user_id, log.date.date()): log for log in attendance_logs}

    # Fetch all approved leaves
    leaves = (
        db.query(WorkApplication)
        .filter(
            WorkApplication.start_date <= end_date,
            WorkApplication.end_date >= start_date,
            WorkApplication.status == "Approved",
        )
        .all()
    )
    leave_map = {}
    for leave in leaves:
        employee_id = leave.employee_id
        for d in (
            start_date + timedelta(days=i)
            for i in range((end_date - start_date).days + 1)
        ):
            if leave.start_date <= d <= leave.end_date:
                leave_map[(employee_id, d)] = leave.reason

    formatted_logs = []
    # Generate logs for every user × every day
    for user in users:
        employee_id = f"IFNT{str(user.id).zfill(3)}"
        for day in range(1, monthrange(year, month)[1] + 1):
            current_date = date(year, month, day)

            # Fixed: lookup using normalized date
            log = attendance_map.get((user.id, current_date))
            holiday_name = holidays.get(current_date)
            leave_reason = leave_map.get((employee_id, current_date))

            # Determine status
            weekday = current_date.weekday()  # 0=Mon ... 6=Sun
            if leave_reason:
                status = "On Leave"
            elif holiday_name and log and log.check_in:
                status = "Worked on Holiday"
            elif holiday_name:
                status = "Holiday"
            elif log and log.check_in:  # check-in only = present
                if weekday == 5:
                    status = "Present on Saturday"
                elif weekday == 6:
                    status = "Present on Sunday"
                else:
                    status = "Present"
            else:
                if weekday in (5, 6) or holiday_name:
                    status = "-"
                else:
                    status = "Absent"

            formatted_logs.append({
                "id": log.id if log else None,
                "date": current_date.strftime("%Y-%m-%d"),
                "employee_id": employee_id,
                "name": user.name or "Unknown",
                "status": status,
                "check_in": log.check_in.strftime("%H:%M") if log and log.check_in else "-",
                "check_out": log.check_out.strftime("%H:%M") if log and log.check_out else "-",
                "total_work": log.total_work if log and log.total_work else "-",
            })

    # Sort newest first
    formatted_logs.sort(key=lambda x: x["date"], reverse=True)
    return formatted_logs