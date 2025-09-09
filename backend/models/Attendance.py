from sqlalchemy import Column, Integer, Date, String, ForeignKey
from utils.db import Base

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date, nullable=False)
    check_in = Column(String(20), nullable=True)
    check_out = Column(String(20), nullable=True)
    status = Column(String(20), default="Present")
