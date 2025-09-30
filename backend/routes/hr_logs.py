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
# HR Logs (month by month, all users × all days, with optional employee filter)
# -------------------------
@router.get("/")
def get_hr_logs(
    year: int = Query(...),
    month: int = Query(...),
    employee_id: str = Query(None, description="Optional employee ID e.g. IFNT001"),
    db: Session = Depends(get_db),
):
    start_date = date(year, month, 1)
    end_date = date(year, month, monthrange(year, month)[1])
    today = date.today()

    # Fetch all active users
    users = db.query(User).all()
    if employee_id:
        users = [u for u in users if f"IFNT{str(u.id).zfill(3)}" == employee_id]

    # Holidays
    holidays = {
        h.date: h.holiday_name
        for h in db.query(Holiday)
        .filter(Holiday.date >= start_date, Holiday.date <= end_date)
        .all()
    }

    # Attendance logs
    attendance_logs = (
        db.query(Attendance)
        .filter(Attendance.date >= start_date, Attendance.date <= end_date)
        .all()
    )
    attendance_map = {(log.user_id, log.date.date()): log for log in attendance_logs}

    # Approved leaves
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
        emp_id = leave.employee_id
        for d in (
            start_date + timedelta(days=i)
            for i in range((end_date - start_date).days + 1)
        ):
            if leave.start_date <= d <= leave.end_date:
                leave_map[(emp_id, d)] = leave.reason

    formatted_logs = []
    monthly_summary = {}

    for user in users:
        emp_id = f"IFNT{str(user.id).zfill(3)}"
        total_minutes_for_user = 0

        for day in range(1, monthrange(year, month)[1] + 1):
            current_date = date(year, month, day)
            log = attendance_map.get((user.id, current_date))
            holiday_name = holidays.get(current_date)
            leave_reason = leave_map.get((emp_id, current_date))

            # --- Status ---
            weekday = current_date.weekday()
            if current_date > today:
                status = "-"
            elif leave_reason:
                status = "On Leave"
            elif holiday_name and log and log.check_in:
                status = "Worked on Holiday"
            elif holiday_name:
                status = "Holiday"
            elif log and log.check_in:
                if weekday == 5:
                    status = "Present on Saturday"
                elif weekday == 6:
                    status = "Present on Sunday"
                else:
                    status = "Present"
            else:
                status = "-" if weekday in (5, 6) or holiday_name else "Absent"

            # --- Work Time Calculations ---
            total_work_str = "-"
            break_time_str = "-"
            actual_work_str = "-"

            if log and log.check_in and log.check_out:
                try:
                    # total time = checkout - checkin
                    total_delta = log.check_out - log.check_in
                    total_minutes = int(total_delta.total_seconds() // 60)
                    th, tm = divmod(total_minutes, 60)
                    total_work_str = f"{th:02d}:{tm:02d}"

                    # break time
                    if log.break_start and log.break_end:
                        break_delta = log.break_end - log.break_start
                        break_minutes = int(break_delta.total_seconds() // 60)
                        bh, bm = divmod(break_minutes, 60)
                        break_time_str = f"{bh:02d}:{bm:02d}"
                    else:
                        break_minutes = 0

                    # actual work = total - break
                    aw_minutes = max(total_minutes - break_minutes, 0)
                    ah, am = divmod(aw_minutes, 60)
                    actual_work_str = f"{ah:02d}:{am:02d}"

                    # accumulate monthly summary
                    if current_date <= today:
                        total_minutes_for_user += aw_minutes
                except Exception:
                    pass

            formatted_logs.append({
                "id": log.id if log else None,
                "date": current_date.strftime("%Y-%m-%d"),
                "employee_id": emp_id,
                "name": user.name or "Unknown",
                "department": user.department or "-",
                "status": status,
                "check_in": log.check_in.strftime("%H:%M") if log and log.check_in else "-",
                "check_out": log.check_out.strftime("%H:%M") if log and log.check_out else "-",
                "break_time": break_time_str,   # calculated live
                "total_work": total_work_str,   # calculated live
                "actual_work": actual_work_str, # calculated live
            })

        # --- Monthly Summary ---
        h, m = divmod(total_minutes_for_user, 60)
        monthly_summary[emp_id] = f"{h}h {m}m"

    formatted_logs.sort(key=lambda x: x["date"], reverse=True)

    return {"logs": formatted_logs, "monthly_summary": monthly_summary}