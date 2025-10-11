from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float
from sqlalchemy.dialects.mysql import LONGTEXT  # For large embedding storage
from datetime import datetime, timezone, timedelta
from utils.db import Base

# Define JST timezone
JST = timezone(timedelta(hours=9))


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    # Unique Employee ID (e.g., IFNT001)
    employee_id = Column(String(20), unique=True, index=True, nullable=True)

    # Basic details
    name = Column(String(100), nullable=False)
    department = Column(String(100), nullable=True)

    # Store multiple embeddings as JSON string (LONGTEXT for size)
    embedding = Column(LONGTEXT, nullable=False)

    # New: Per-user adaptive threshold (used for recognition strictness)
    threshold = Column(Float, default=0.40, nullable=False)

    # Creation timestamp (JST)
    created_at = Column(DateTime, default=lambda: datetime.now(JST))

    # Soft delete flag
    is_active = Column(Boolean, default=True, nullable=False)