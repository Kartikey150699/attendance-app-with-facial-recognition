from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ==========================================================
# Database URL
# ==========================================================
# Adjust username/password if needed
DATABASE_URL = "mysql+pymysql://root:root@localhost:3306/facetrack"

# Create engine (no echo for cleaner logs)
engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)

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
        Base.metadata.create_all(bind=engine)
        print("Tables verified or created successfully.")
    except Exception as e:
        print(f"Failed to verify/create tables: {e}")

# ==========================================================
# DB session dependency for FastAPI
# ==========================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()