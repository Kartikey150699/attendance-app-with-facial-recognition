from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey
from datetime import datetime
from utils.db import Base

class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, unique=True)
    holiday_name = Column(String(100), nullable=False)
    
    # Link to admin who created the holiday (optional)
    created_by = Column(Integer, ForeignKey("admins.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)