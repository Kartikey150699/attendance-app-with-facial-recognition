from sqlalchemy import Column, Integer, String, Time, Date, ForeignKey
from utils.db import Base

class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("users.employee_id"), nullable=False)
    date = Column(Date, nullable=False)  # specific day of shift
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    department = Column(String(100), nullable=True)  # optional, for dept-wise shifts
    assigned_by = Column(String(255), nullable=True)  # add this if you track who assigned