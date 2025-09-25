from sqlalchemy import Column, Integer, String, Date
from utils.db import Base

class PaidHoliday(Base):
    __tablename__ = "paid_holidays"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), nullable=False)      # Emp IDs like IFNT001
    employee_name = Column(String(100), nullable=False)   # Full name
    department = Column(String(100), nullable=True)       # Department name

    total_quota = Column(Integer, nullable=False)
    used_days = Column(Integer, default=0)
    remaining_days = Column(Integer, nullable=False)

    valid_from = Column(Date, nullable=True)
    valid_till = Column(Date, nullable=True)

    assigned_date = Column(Date, nullable=False)
    created_by = Column(Integer, nullable=False)