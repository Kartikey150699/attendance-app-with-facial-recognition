from sqlalchemy import Column, Integer, DateTime, String, ForeignKey
from utils.db import Base
from datetime import datetime, timezone, timedelta

# Define JST timezone
JST = timezone(timedelta(hours=9))


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)

    # Keep user_id, but allow it to be NULL if user is deleted
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Store the user's name as a snapshot at the time of attendance
    user_name_snapshot = Column(String(100), nullable=True)

    # Date of the attendance record (with JST default)
    date = Column(DateTime, default=lambda: datetime.now(JST), nullable=False)

    # Time logs (store as proper DateTime instead of strings)
    check_in = Column(DateTime, nullable=True)
    break_start = Column(DateTime, nullable=True)
    break_end = Column(DateTime, nullable=True)
    check_out = Column(DateTime, nullable=True)

    # Status (default = Present)
    status = Column(String(20), default="Present")