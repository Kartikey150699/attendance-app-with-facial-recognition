from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from utils.db import Base

class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    password = Column(String(200), nullable=False)  # later: store hashed password
    created_at = Column(DateTime, default=datetime.utcnow)
