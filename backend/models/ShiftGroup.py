from sqlalchemy import Column, Integer, String, JSON
from utils.db import Base

class ShiftGroup(Base):
    __tablename__ = "shift_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)  
    description = Column(String(255), nullable=True)
    schedule = Column(JSON, nullable=False)  # stores weekly shift schedule (mon–sun)