from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from utils.db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    embedding = Column(Text, nullable=False)  # face embedding stored as JSON
    created_at = Column(DateTime, default=datetime.utcnow)
