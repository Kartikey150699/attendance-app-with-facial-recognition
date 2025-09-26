from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from utils.db import Base

class Approver(Base):
    __tablename__ = "approvers"

    id = Column(Integer, primary_key=True, index=True)

    # Each approver belongs to a single work application
    work_application_id = Column(Integer, ForeignKey("work_applications.id"), nullable=False)

    # Approver assigned for this application (points to User.employee_id)
    approver_id = Column(String(50), ForeignKey("users.employee_id"), nullable=False)

    # Approval hierarchy level (1 = first approver, 2 = second approver, etc.)
    level = Column(Integer, nullable=False)

    # Status for this approver's decision (default: Pending)
    status = Column(String(20), default="Pending")  
    # Possible values: "Pending", "Approved", "Rejected"

    # Relationships
    approver = relationship("User", foreign_keys=[approver_id])  
    work_application = relationship("WorkApplication", back_populates="approvers")