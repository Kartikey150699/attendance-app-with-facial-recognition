from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from utils.db import Base
from datetime import datetime

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    # Foreign key to Attendance table
    attendance_id = Column(Integer, ForeignKey("attendance.id"), nullable=False)

    # Admin username who edited (VARCHAR must have length for MySQL)
    edited_by = Column(String(255), nullable=False)

    # Timestamp of edit (default UTC, can adjust to JST when displaying)
    edited_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Store JSON snapshot of old and new values
    changes = Column(Text, nullable=False)