from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.dialects.mysql import LONGTEXT  # Import MySQL LONGTEXT type
from datetime import datetime, timezone, timedelta
from utils.db import Base

# Define JST timezone
JST = timezone(timedelta(hours=9))


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    
    # New: Employee ID (unique, formatted like IFNT001)
    employee_id = Column(String(20), unique=True, index=True, nullable=True)

    name = Column(String(100), nullable=False)

    # Column for Department
    department = Column(String(100), nullable=True)

    # Store embeddings as JSON string (can now hold multiple embeddings, e.g., [normal, masked])
    embedding = Column(LONGTEXT, nullable=False)   # Changed to LONGTEXT

    # Save in JST instead of UTC
    created_at = Column(DateTime, default=lambda: datetime.now(JST))

    # Soft delete flag → if False, user is considered deleted
    is_active = Column(Boolean, default=True, nullable=False)