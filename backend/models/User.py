from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from utils.db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    
    # Store embeddings as JSON string (can now hold multiple embeddings, e.g., [normal, masked])
    embedding = Column(Text, nullable=False)  
    
    created_at = Column(DateTime, default=datetime.utcnow)