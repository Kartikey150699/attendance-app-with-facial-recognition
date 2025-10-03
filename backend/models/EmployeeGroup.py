from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from utils.db import Base

class EmployeeGroup(Base):
    __tablename__ = "employee_groups"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), ForeignKey("users.employee_id"), nullable=False)
    group_id = Column(Integer, ForeignKey("shift_groups.id"), nullable=False)

    __table_args__ = (
        UniqueConstraint("employee_id", "group_id", name="uq_employee_group"),
    )