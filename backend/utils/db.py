from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy_utils import database_exists, create_database # type: ignore

# ==========================================================
# Database URL
# ==========================================================
# Adjust username/password if needed
DATABASE_URL = "mysql+pymysql://root:root@localhost:3306/facetrack"

# Create engine (no echo for cleaner logs)
engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)

# ==========================================================
# Auto-create database if missing
# ==========================================================
try:
    if not database_exists(engine.url):
        create_database(engine.url)
        print("✅ Database 'facetrack' created successfully.")
    else:
        print("✅ Database 'facetrack' already exists.")
except Exception as e:
    print(f"⚠️ Could not verify/create database automatically: {e}")

# ==========================================================
# ORM setup
# ==========================================================
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ==========================================================
# Function to auto-create tables if missing
# ==========================================================
def ensure_tables_created(Base):
    """
    Ensure all declared tables exist — create them if missing.
    Safe to call before embeddings load.
    """
    try:
        from models import (
            User,
            Attendance,
            Holiday,
            WorkApplication,
            PaidHoliday,
            Approver,
        )  # Import all your models

        Base.metadata.create_all(bind=engine)
        print("✅ Tables verified or created successfully.")
    except Exception as e:
        print(f"❌ Failed to verify/create tables: {e}")

# ==========================================================
# DB session dependency for FastAPI
# ==========================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==========================================================
# Initialize tables automatically when this file is imported
# ==========================================================
ensure_tables_created(Base)