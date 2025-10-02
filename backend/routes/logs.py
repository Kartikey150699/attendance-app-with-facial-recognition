from fastapi import APIRouter, Depends, Query, HTTPException, Body
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from utils.db import SessionLocal
from models.User import User
from models.Attendance import Attendance
from models.AuditLog import AuditLog
from datetime import datetime, date, time
from calendar import monthrange
import json
import pytz
import pandas as pd
import io
from fastapi.responses import StreamingResponse
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

router = APIRouter(prefix="/logs", tags=["Logs"])

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
# Helper: calculate total work
# -------------------------
def calculate_total_work(log: Attendance):
    """Recalculate total working hours (excluding break) and update the record."""
    if log.check_in and log.check_out:
        try:
            total = log.check_out - log.check_in
            if log.break_start and log.break_end:
                total -= (log.break_end - log.break_start)

            total_minutes = total.total_seconds() // 60
            hours, minutes = divmod(total_minutes, 60)
            log.total_work = f"{int(hours)}h {int(minutes)}m"
        except Exception as e:
            print("⚠️ Error calculating work time:", e)
            log.total_work = "-"
    else:
        log.total_work = "-"

# -------------------------
# Attendance Logs API (per month)
# -------------------------
@router.get("/")
def get_attendance_logs(
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    start_date = date(year, month, 1)
    end_date = date(year, month, monthrange(year, month)[1])

    logs = (
        db.query(Attendance)
        .filter(Attendance.date >= start_date, Attendance.date <= end_date)
        .order_by(Attendance.date.desc())
        .all()
    )

    formatted_logs = []
    for log in logs:
        # Ensure total_work is always up to date
        old_total = log.total_work
        calculate_total_work(log)
        if log.total_work != old_total:
            db.commit()
            db.refresh(log)

        user = db.query(User).filter(User.id == log.user_id).first()
        if user:
            employee_id = f"IFNT{str(user.id).zfill(3)}"
            user_name = log.user_name_snapshot
            department = user.department if hasattr(user, "department") else "-"
        else:
            employee_id = "DELETED"
            user_name = log.user_name_snapshot or "Deleted User"
            department = "-"

        def fmt(dt: datetime):
            return dt.strftime("%H:%M") if dt else None

        # Calculate overtime (if > 8h = 480 mins)
        overtime = "-"
        if log.total_work and log.total_work != "-":
            try:
                parts = log.total_work.replace("h", "").replace("m", "").split()
                h, m = map(int, parts)
                total_minutes = h * 60 + m
                overtime_minutes = max(0, total_minutes - 480)
                if overtime_minutes > 0:
                    oh, om = divmod(overtime_minutes, 60)
                    overtime = f"{int(oh)}h {int(om)}m"
            except Exception:
                overtime = "-"

        formatted_logs.append({
            "id": log.id,
            "employee_id": employee_id,
            "date": log.date.strftime("%Y-%m-%d"),
            "user_name_snapshot": user_name,
            "department": department,
            "check_in": fmt(log.check_in),
            "break_start": fmt(log.break_start),
            "break_end": fmt(log.break_end),
            "check_out": fmt(log.check_out),
            "total_work": log.total_work or "-",
            "overtime": overtime,
        })

    return formatted_logs

# -------------------------
# Pydantic model for update payload
# -------------------------
class AttendanceUpdate(BaseModel):
    date: Optional[str] = None
    check_in: Optional[str] = None
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    check_out: Optional[str] = None
    edited_by: Optional[str] = "admin"

# -------------------------
# Update Attendance Log (Admin can fix)
# -------------------------
@router.put("/update/{log_id}")
def update_attendance(
    log_id: int,
    payload: AttendanceUpdate,
    db: Session = Depends(get_db),
):
    log = db.query(Attendance).filter(Attendance.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    old_data = {
        "date": log.date.strftime("%Y-%m-%d") if log.date else None,
        "check_in": log.check_in.strftime("%H:%M") if log.check_in else None,
        "break_start": log.break_start.strftime("%H:%M") if log.break_start else None,
        "break_end": log.break_end.strftime("%H:%M") if log.break_end else None,
        "check_out": log.check_out.strftime("%H:%M") if log.check_out else None,
        "total_work": log.total_work,
    }

    if payload.date:
        try:
            log.date = datetime.strptime(payload.date, "%Y-%m-%d").date()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    def parse_time(t: str):
        try:
            hh, mm = map(int, t.split(":"))
            return datetime.combine(log.date, time(hh, mm))
        except Exception:
            return None

    if payload.check_in:
        log.check_in = parse_time(payload.check_in)
    if payload.break_start:
        log.break_start = parse_time(payload.break_start)
    if payload.break_end:
        log.break_end = parse_time(payload.break_end)
    if payload.check_out:
        log.check_out = parse_time(payload.check_out)

    calculate_total_work(log)
    db.commit()
    db.refresh(log)

    new_data = {
        "date": log.date.strftime("%Y-%m-%d"),
        "check_in": log.check_in.strftime("%H:%M") if log.check_in else None,
        "break_start": log.break_start.strftime("%H:%M") if log.break_start else None,
        "break_end": log.break_end.strftime("%H:%M") if log.break_end else None,
        "check_out": log.check_out.strftime("%H:%M") if log.check_out else None,
        "total_work": log.total_work,
    }

    changes = {}
    for key in new_data:
        if old_data.get(key) != new_data.get(key):
            changes[key] = {"old": old_data.get(key), "new": new_data.get(key)}

    if changes:
        audit = AuditLog(
            attendance_id=log.id,
            edited_by=payload.edited_by or "admin",
            edited_at=datetime.utcnow(),
            changes=json.dumps(changes)
        )
        db.add(audit)
        db.commit()

    return {"message": "Attendance updated successfully", "log": new_data}

# -------------------------
# Fetch Audit Trail for a log
# -------------------------
@router.get("/audit/{log_id}")
def get_audit_trail(log_id: int, db: Session = Depends(get_db)):
    audits = (
        db.query(AuditLog)
        .filter(AuditLog.attendance_id == log_id)
        .order_by(AuditLog.edited_at.desc())
        .all()
    )

    jst = pytz.timezone("Asia/Tokyo")

    return [
        {
            "id": a.id,
            "edited_by": a.edited_by,
            "edited_at": a.edited_at.replace(tzinfo=pytz.utc).astimezone(jst).strftime("%Y-%m-%d %H:%M"),
            "changes": json.loads(a.changes),
        }
        for a in audits
    ]

# -------------------------
# Export Logs
# -------------------------
@router.post("/export")
def export_logs(
    year: int = Query(...),
    month: int = Query(...),
    format: str = Query("csv"),
    logs: list = Body(...),
    db: Session = Depends(get_db),
):
    file_stream = io.BytesIO()
    today_str = datetime.now().strftime("%Y_%m_%d")
    filename = f"attendance_logs_{today_str}"

    headers = [
        "Employee ID",
        "Date",
        "Employee",
        "Department",
        "Check In",
        "Break Start",
        "Break End",
        "Check Out",
        "Total Working",
        "Overtime"
    ]

    rows = []
    for log in logs:
        rows.append([
            log.get("employee_id", "-"),
            log.get("date", "-"),
            log.get("user_name_snapshot", "-"),
            log.get("department", "-"),
            log.get("check_in", "-") or "-",
            log.get("break_start", "-") or "-",
            log.get("break_end", "-") or "-",
            log.get("check_out", "-") or "-",
            log.get("total_work", "-"),
            log.get("overtime", "-"),
        ])

    df = pd.DataFrame(rows, columns=headers)

    if format == "csv":
        df.to_csv(file_stream, index=False)
        file_stream.seek(0)
        return StreamingResponse(
            file_stream,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'}
        )

    elif format == "excel":
        df.to_excel(file_stream, index=False, engine="openpyxl")
        file_stream.seek(0)
        return StreamingResponse(
            file_stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'}
        )

    elif format == "pdf":
        pdf_stream = io.BytesIO()

        def add_page_number(canvas, doc):
            page_num = canvas.getPageNumber()
            text = f"Page {page_num}"
            canvas.setFont("Helvetica", 9)
            canvas.drawRightString(A4[0] - inch, 0.5 * inch, text)

        # Use landscape A4
        doc = SimpleDocTemplate(pdf_stream, pagesize=landscape(A4))

        styles = getSampleStyleSheet()
        normal = styles["Normal"]
        title_style = styles["Title"]

        logo = Image("static/logo.png", width=1*inch, height=1*inch)
        title = Paragraph("<b><font size=22>FaceTrack Attendance</font></b>", title_style)

        jst = pytz.timezone("Asia/Tokyo")
        export_time = datetime.now(jst).strftime("%Y-%m-%d %H:%M:%S")
        metadata = Paragraph(
            f"<para align='right'><font size=10>Exported: {export_time} (JST)</font></para>",
            normal
        )

        header_table = Table([[logo, title, metadata]], colWidths=[1.2*inch, 4*inch, 2*inch])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ALIGN', (1,0), (1,0), 'CENTER'),
            ('ALIGN', (2,0), (2,0), 'RIGHT'),
        ]))

        # Wrap text inside cells
        wrap_style = ParagraphStyle("wrap", parent=styles["Normal"], fontSize=9, alignment=1)
        data = [headers] + [[Paragraph(str(cell), wrap_style) for cell in row] for row in rows]

        # Auto-fit columns to page width
        page_width = landscape(A4)[0] - 2*40
        col_widths = [page_width / len(headers)] * len(headers)

        table = Table(data, colWidths=col_widths, repeatRows=1)

        table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.lightblue),
            ('TEXTCOLOR', (0,0), (-1,0), colors.black),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 11),
            ('FONTSIZE', (0,1), (-1,-1), 9),
            ('GRID', (0,0), (-1,-1), 0.5, colors.black),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.lightgrey]),
        ]))

        footer = Paragraph(
            "<para align='center'><font size=10>Generated by FaceTrack Attendance System</font></para>",
            normal
        )

        elements = [header_table, Spacer(1, 0.3*inch), table, Spacer(1, 0.3*inch), footer]
        doc.build(elements, onFirstPage=add_page_number, onLaterPages=add_page_number)

        pdf_stream.seek(0)
        return StreamingResponse(
            pdf_stream,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'}
        )

    else:
        return {"error": "Invalid export format"}