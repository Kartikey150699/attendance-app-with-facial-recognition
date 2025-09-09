from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ⚡ Change username & password to match your MySQL Workbench
DATABASE_URL = "mysql+pymysql://root:root@localhost:3306/facetrack"

engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
