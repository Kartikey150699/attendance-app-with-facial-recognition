from sqlalchemy import Column, Integer, String, Date, DateTime
from datetime import datetime
from utils.db import Base

class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    holiday_name = Column(String(100), nullable=False)
    created_by = Column(String(100), nullable=True) 
    created_at = Column(DateTime, default=datetime.utcnow)