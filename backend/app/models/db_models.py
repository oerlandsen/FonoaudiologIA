"""SQLAlchemy ORM models for database tables."""
from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Exercise(Base):
    """Exercise model."""
    
    __tablename__ = "exercises"
    
    id = Column(Integer, primary_key=True, index=True)
    stage_id = Column(Integer, nullable=False, index=True)
    exercise_id = Column(Integer, unique=True, nullable=False, index=True)
    exercise_content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationship
    transcriptions = relationship("Transcription", back_populates="exercise")


class Transcription(Base):
    """Transcription model."""
    
    __tablename__ = "transcriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    stage_id = Column(Integer, nullable=False, index=True)
    transcription = Column(Text, nullable=False)
    length = Column(Float, nullable=False)  # Length in seconds
    exercise_id = Column(Integer, ForeignKey("exercises.exercise_id"), nullable=False, index=True)
    session_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationship
    exercise = relationship("Exercise", back_populates="transcriptions")


class Metric(Base):
    """Metric model."""
    
    __tablename__ = "metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    stage_id = Column(Integer, nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    value = Column(Float, nullable=False)
    score = Column(Float, nullable=False)  # Score as percentage (0-100)
    session_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

