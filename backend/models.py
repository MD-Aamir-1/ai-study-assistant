from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    course = Column(String, nullable=False)

    subjects = relationship("Subject", back_populates="student", cascade="all, delete-orphan")
    performances = relationship("Performance", back_populates="student")
    study_plans = relationship("StudyPlan", back_populates="student")
    quiz_results = relationship("QuizResult", back_populates="student")


class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)

    student = relationship("Student", back_populates="subjects")
    topics = relationship("Topic", back_populates="subject", cascade="all, delete-orphan")


class Topic(Base):
    __tablename__ = "topics"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    difficulty = Column(String, default="medium")  # easy, medium, hard
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)

    subject = relationship("Subject", back_populates="topics")
    performances = relationship("Performance", back_populates="topic")
    study_plans = relationship("StudyPlan", back_populates="topic")
    quiz_questions = relationship("QuizQuestion", back_populates="topic")
    quiz_results = relationship("QuizResult", back_populates="topic")


class Performance(Base):
    __tablename__ = "performances"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)
    score = Column(Float, default=0.0)      # 0 to 100
    attempts = Column(Integer, default=0)

    student = relationship("Student", back_populates="performances")
    topic = relationship("Topic", back_populates="performances")


class StudyPlan(Base):
    __tablename__ = "study_plans"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)
    date = Column(String, nullable=False)   # "YYYY-MM-DD"
    duration_minutes = Column(Integer, default=30)
    completed = Column(Boolean, default=False)

    student = relationship("Student", back_populates="study_plans")
    topic = relationship("Topic", back_populates="study_plans")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)
    question = Column(String, nullable=False)
    option_a = Column(String, nullable=False)
    option_b = Column(String, nullable=False)
    option_c = Column(String, nullable=False)
    option_d = Column(String, nullable=False)
    correct_option = Column(String, nullable=False)   # "A", "B", "C", "D"

    topic = relationship("Topic", back_populates="quiz_questions")


class QuizResult(Base):
    __tablename__ = "quiz_results"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)
    score = Column(Float, default=0.0)
    total_questions = Column(Integer, default=0)
    date = Column(String, nullable=False)

    student = relationship("Student", back_populates="quiz_results")
    topic = relationship("Topic", back_populates="quiz_results")