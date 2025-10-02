from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from utils.db import Base

class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    # Store hashed password (bcrypt hash usually ~60 chars, so 200 is safe)
    password = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)