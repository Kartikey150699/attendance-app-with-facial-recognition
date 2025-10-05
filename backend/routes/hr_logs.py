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
    today = date.today()

    # --- Expanded query range: prev month → current → next month ---
    start_date = date(year, month, 1)
    prev_month_last_day = start_date - timedelta(days=1)
    prev_month_start = prev_month_last_day.replace(day=1)
    next_month = (start_date.replace(day=28) + timedelta(days=4)).replace(day=1)
    next_month_last_day = (next_month.replace(day=28) + timedelta(days=4))
    range_start = prev_month_start
    range_end = next_month_last_day

    # Current month exact range
    month_start = start_date
    month_end = date(year, month, monthrange(year, month)[1])

    # Fetch all active users
    users = db.query(User).all()
    if employee_id:
        users = [u for u in users if f"IFNT{str(u.id).zfill(3)}" == employee_id]

    # Holidays (expanded range)
    holidays = {
        h.date: h.holiday_name
        for h in db.query(Holiday)
        .filter(Holiday.date >= range_start, Holiday.date <= range_end)
        .all()
    }

    # Attendance logs (expanded range)
    attendance_logs = (
        db.query(Attendance)
        .filter(Attendance.date >= range_start, Attendance.date <= range_end)
        .all()
    )
    attendance_map = {(log.user_id, log.date.date()): log for log in attendance_logs}

    # Approved leaves (expanded range)
    leaves = (
        db.query(WorkApplication)
        .filter(
            WorkApplication.start_date <= range_end,
            WorkApplication.end_date >= range_start,
            WorkApplication.status == "Approved",
        )
        .all()
    )

    # Use application_type instead of reason (shows actual leave type like 有給休暇, 欠勤, etc.)
    leave_map = {}
    for leave in leaves:
        emp_id = leave.employee_id
        leave_type = (
            getattr(leave, "application_type", None)
            or getattr(leave, "leave_type", None)
            or "On Leave"
        )

        for d in (
            range_start + timedelta(days=i)
            for i in range((range_end - range_start).days + 1)
        ):
            if leave.start_date <= d <= leave.end_date:
                leave_map[(emp_id, d)] = leave_type

    # ------------------------------------
    # Build logs
    # ------------------------------------
    formatted_logs = []   # only current month (for table rows)
    expanded_logs = []    # full range (for weekly summaries)
    monthly_summary = {}

    for user in users:
        emp_id = f"IFNT{str(user.id).zfill(3)}"
        total_minutes_for_user = 0

        # Loop full expanded range
        for i in range((range_end - range_start).days + 1):
            current_date = range_start + timedelta(days=i)
            log = attendance_map.get((user.id, current_date))
            holiday_name = holidays.get(current_date)
            leave_reason = leave_map.get((emp_id, current_date))
            weekday = current_date.weekday()  # Mon=0, Sun=6

            # --- Status Logic (Fixed) ---
            if current_date > today:
                # FUTURE DATES — show approved leave or holiday
                if leave_reason:
                    status = leave_reason
                elif holiday_name:
                    status = holiday_name
                else:
                    status = "-"
            else:
                # PAST / TODAY
                if leave_reason:
                    status = leave_reason
                elif holiday_name and log and log.check_in:
                    status = "Worked on Holiday"
                elif holiday_name:
                    status = holiday_name
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
            late = "-"
            early_leave = "-"

            if log and log.check_in and log.check_out:
                try:
                    total_delta = log.check_out - log.check_in
                    total_minutes = int(total_delta.total_seconds() // 60)
                    th, tm = divmod(total_minutes, 60)
                    total_work_str = f"{th:02d}:{tm:02d}"

                    if log.break_start and log.break_end:
                        break_delta = log.break_end - log.break_start
                        break_minutes = int(break_delta.total_seconds() // 60)
                        bh, bm = divmod(break_minutes, 60)
                        break_time_str = f"{bh:02d}:{bm:02d}"
                    else:
                        break_minutes = 0

                    aw_minutes = max(total_minutes - break_minutes, 0)
                    ah, am = divmod(aw_minutes, 60)
                    actual_work_str = f"{ah:02d}:{am:02d}"

                    if current_date <= today:
                        total_minutes_for_user += aw_minutes

                    # --- Late / Early Leave Calculation ---
                    planned_start = "10:00"
                    planned_end = "19:00"
                    if weekday in (5, 6):  # Sat/Sun -> no shift
                        planned_start = planned_end = "-"

                    if (
                        planned_start != "-"
                        and log.check_in.strftime("%H:%M")
                        and log.check_out.strftime("%H:%M")
                    ):
                        if log.check_in.strftime("%H:%M") > planned_start:
                            late = "Yes"
                        else:
                            late = "No"

                        if log.check_out.strftime("%H:%M") < planned_end:
                            early_leave = "Yes"
                        else:
                            early_leave = "No"

                except Exception:
                    pass

            # --- Add Row ---
            row = {
                "id": log.id if log else None,
                "date": current_date.strftime("%Y-%m-%d"),
                "employee_id": emp_id,
                "name": user.name or "Unknown",
                "department": user.department or "-",
                "status": status,
                "check_in": log.check_in.strftime("%H:%M") if log and log.check_in else "-",
                "check_out": log.check_out.strftime("%H:%M") if log and log.check_out else "-",
                "break_time": break_time_str,
                "total_work": total_work_str,
                "actual_work": actual_work_str,
                "late": late,
                "early_leave": early_leave,
                # Extra fields (for frontend use)
                "holiday_name": holiday_name or "-",
                "leave_reason": leave_reason or "-",
            }

            expanded_logs.append(row)

            # Only add to main logs if inside current month
            if month_start <= current_date <= month_end:
                formatted_logs.append(row)

        # --- Monthly Summary ---
        h, m = divmod(total_minutes_for_user, 60)
        monthly_summary[emp_id] = f"{h}h {m}m"

    formatted_logs.sort(key=lambda x: x["date"])
    expanded_logs.sort(key=lambda x: x["date"])

    return {
        "logs": formatted_logs,           # current month only
        "expanded_logs": expanded_logs,   # full 3 months range
        "monthly_summary": monthly_summary,
        "range_start": range_start.strftime("%Y-%m-%d"),
        "range_end": range_end.strftime("%Y-%m-%d"),
    }