from sqlalchemy import Column, Integer, String, Date, DateTime, Time
from datetime import datetime
from utils.db import Base


class WorkApplication(Base):
    __tablename__ = "work_applications"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)   
    application_type = Column(String(50), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    reason = Column(String(255), nullable=False)
    use_paid_holiday = Column(String(10), default="no")  # values: "yes" or "no"

    status = Column(String(20), default="Pending")
    hr_notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)