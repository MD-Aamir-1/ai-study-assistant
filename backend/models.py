from sqlalchemy import (
    Column, Integer, String, Float, Boolean, ForeignKey, Text, DateTime
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


# ==================================================
# EXISTING MODELS
# ==================================================

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
    question_attempts = relationship("QuestionAttempt", back_populates="student")
    concept_stats = relationship("ConceptStat", back_populates="student")
    recommendations = relationship("Recommendation", back_populates="student")


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
    difficulty = Column(String, default="medium")
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)

    subject = relationship("Subject", back_populates="topics")
    performances = relationship("Performance", back_populates="topic")
    study_plans = relationship("StudyPlan", back_populates="topic")
    quiz_questions = relationship("QuizQuestion", back_populates="topic")
    quiz_results = relationship("QuizResult", back_populates="topic")

    # Concept-level relationships
    concepts = relationship("Concept", back_populates="topic", cascade="all, delete-orphan")
    learning_content = relationship(
        "LearningContent", back_populates="topic", uselist=False, cascade="all, delete-orphan"
    )
    questions = relationship("Question", back_populates="topic", cascade="all, delete-orphan")


class Performance(Base):
    __tablename__ = "performances"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)
    score = Column(Float, default=0.0)
    attempts = Column(Integer, default=0)

    student = relationship("Student", back_populates="performances")
    topic = relationship("Topic", back_populates="performances")


class StudyPlan(Base):
    __tablename__ = "study_plans"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)
    date = Column(String, nullable=False)
    duration_minutes = Column(Integer, default=30)
    completed = Column(Boolean, default=False)

    student = relationship("Student", back_populates="study_plans")
    topic = relationship("Topic", back_populates="study_plans")


class QuizQuestion(Base):
    """Legacy table — kept for backward compatibility. New questions use `Question`."""
    __tablename__ = "quiz_questions"
    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)
    question = Column(String, nullable=False)
    option_a = Column(String, nullable=False)
    option_b = Column(String, nullable=False)
    option_c = Column(String, nullable=False)
    option_d = Column(String, nullable=False)
    correct_option = Column(String, nullable=False)

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


# ==================================================
# CONCEPT-LEVEL MODELS
# ==================================================

class Concept(Base):
    """A single concept within a topic. E.g., 'Kernel Functions' inside 'SVM'."""
    __tablename__ = "concepts"
    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    importance = Column(Integer, default=3)   # 1=low, 5=critical
    order_index = Column(Integer, default=0)  # display order
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    topic = relationship("Topic", back_populates="concepts")
    question_links = relationship(
        "QuestionConcept", back_populates="concept", cascade="all, delete-orphan"
    )
    stats = relationship(
        "ConceptStat", back_populates="concept", cascade="all, delete-orphan"
    )
    recommendations = relationship(
        "Recommendation", back_populates="concept", cascade="all, delete-orphan"
    )
    content = relationship(
        "ConceptContent", back_populates="concept", uselist=False,
        cascade="all, delete-orphan"
    )


class LearningContent(Base):
    """Cached, structured content for a topic. One row per topic (unique)."""
    __tablename__ = "learning_contents"
    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(
        Integer, ForeignKey("topics.id"), nullable=False, unique=True, index=True
    )
    content_json = Column(Text, nullable=False)  # JSON-encoded structured content
    sources = Column(Text, default="[]")         # JSON list of source dicts
    model_version = Column(String, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    topic = relationship("Topic", back_populates="learning_content")


class ConceptContent(Base):
    """Cached deep-dive content for a single concept."""
    __tablename__ = "concept_contents"
    id = Column(Integer, primary_key=True, index=True)
    concept_id = Column(
        Integer, ForeignKey("concepts.id"), nullable=False, unique=True, index=True
    )
    content_json = Column(Text, nullable=False)
    model_version = Column(String, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    concept = relationship("Concept", back_populates="content")


class Question(Base):
    """Concept-aware question (new system)."""
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    option_a = Column(Text, nullable=False)
    option_b = Column(Text, nullable=False)
    option_c = Column(Text, nullable=False)
    option_d = Column(Text, nullable=False)
    correct_option = Column(String(1), nullable=False)  # "A"|"B"|"C"|"D"
    explanation = Column(Text, default="")
    difficulty = Column(String, default="medium")
    question_type = Column(String, default="conceptual")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    topic = relationship("Topic", back_populates="questions")
    concept_links = relationship(
        "QuestionConcept", back_populates="question", cascade="all, delete-orphan"
    )
    attempts = relationship(
        "QuestionAttempt", back_populates="question", cascade="all, delete-orphan"
    )


class QuestionConcept(Base):
    """Maps a question to one or more concepts (M2M)."""
    __tablename__ = "question_concepts"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    concept_id = Column(Integer, ForeignKey("concepts.id"), nullable=False, index=True)
    weight = Column(Float, default=1.0)

    question = relationship("Question", back_populates="concept_links")
    concept = relationship("Concept", back_populates="question_links")


class QuestionAttempt(Base):
    """One row per question attempt by a student."""
    __tablename__ = "question_attempts"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    selected_option = Column(String(1), nullable=True)
    is_correct = Column(Boolean, default=False)
    time_spent_secs = Column(Integer, default=0)
    session_id = Column(String, index=True)
    attempted_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student", back_populates="question_attempts")
    question = relationship("Question", back_populates="attempts")


class ConceptStat(Base):
    """Materialized per-student, per-concept performance snapshot."""
    __tablename__ = "concept_stats"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    concept_id = Column(Integer, ForeignKey("concepts.id"), nullable=False, index=True)
    attempts = Column(Integer, default=0)
    correct = Column(Integer, default=0)
    score = Column(Float, default=0.0)
    confidence = Column(Float, default=0.0)
    trend = Column(String, default="stable")
    last_updated = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    student = relationship("Student", back_populates="concept_stats")
    concept = relationship("Concept", back_populates="stats")


class Recommendation(Base):
    """Personalized study recommendation generated by the engine."""
    __tablename__ = "recommendations"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    concept_id = Column(Integer, ForeignKey("concepts.id"), nullable=False, index=True)
    priority = Column(Float, default=0.0)
    reason = Column(Text, default="")
    suggested_minutes = Column(Integer, default=30)
    activity_type = Column(String, default="read")
    status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student", back_populates="recommendations")
    concept = relationship("Concept", back_populates="recommendations")