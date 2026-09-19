from sqlalchemy import (
    Column, Integer, String, Float, Boolean, ForeignKey, Text, DateTime
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


# ==================================================
# STUDENT (extended profile)
# ==================================================
class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    course = Column(String, nullable=False)

    # Extended profile fields
    bio = Column(Text, default="")
    interests = Column(Text, default="")
    avatar_url = Column(Text, default="")
    preferred_learning_style = Column(String, default="")
    education_level = Column(String, default="")
    location = Column(String, default="")
    website = Column(String, default="")
    github = Column(String, default="")
    linkedin = Column(String, default="")
    preferred_language = Column(String, default="en")   # ISO code: en, hi, es, fr, etc.

    subjects = relationship(
        "Subject", back_populates="student", cascade="all, delete-orphan"
    )
    performances = relationship("Performance", back_populates="student")
    study_plans = relationship("StudyPlan", back_populates="student")
    quiz_results = relationship("QuizResult", back_populates="student")
    question_attempts = relationship("QuestionAttempt", back_populates="student")
    concept_stats = relationship("ConceptStat", back_populates="student")
    recommendations = relationship("Recommendation", back_populates="student")
    search_history = relationship(
        "SearchHistory",
        cascade="all, delete-orphan",
        order_by="desc(SearchHistory.searched_at)",
    )


# ==================================================
# SUBJECT
# ==================================================
class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)

    student = relationship("Student", back_populates="subjects")
    topics = relationship(
        "Topic", back_populates="subject", cascade="all, delete-orphan"
    )


# ==================================================
# TOPIC
# ==================================================
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

    concepts = relationship(
        "Concept", back_populates="topic", cascade="all, delete-orphan"
    )
    learning_content = relationship(
        "LearningContent",
        back_populates="topic",
        uselist=False,
        cascade="all, delete-orphan",
    )
    questions = relationship(
        "Question", back_populates="topic", cascade="all, delete-orphan"
    )


# ==================================================
# PERFORMANCE (legacy topic-level)
# ==================================================
class Performance(Base):
    __tablename__ = "performances"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)
    score = Column(Float, default=0.0)
    attempts = Column(Integer, default=0)

    student = relationship("Student", back_populates="performances")
    topic = relationship("Topic", back_populates="performances")


# ==================================================
# STUDY PLAN (legacy)
# ==================================================
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


# ==================================================
# QUIZ QUESTION (legacy)
# ==================================================
class QuizQuestion(Base):
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


# ==================================================
# QUIZ RESULT
# ==================================================
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
# CONCEPT
# ==================================================
class Concept(Base):
    __tablename__ = "concepts"
    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    importance = Column(Integer, default=3)
    order_index = Column(Integer, default=0)
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
        "ConceptContent",
        back_populates="concept",
        uselist=False,
        cascade="all, delete-orphan",
    )


# ==================================================
# LEARNING CONTENT
# ==================================================
class LearningContent(Base):
    __tablename__ = "learning_contents"
    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(
        Integer, ForeignKey("topics.id"), nullable=False, unique=True, index=True
    )
    content_json = Column(Text, nullable=False)
    sources = Column(Text, default="[]")
    model_version = Column(String, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    topic = relationship("Topic", back_populates="learning_content")


# ==================================================
# CONCEPT CONTENT (deep-dive)
# ==================================================
class ConceptContent(Base):
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


# ==================================================
# QUESTION (concept-aware)
# ==================================================
class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    option_a = Column(Text, nullable=False)
    option_b = Column(Text, nullable=False)
    option_c = Column(Text, nullable=False)
    option_d = Column(Text, nullable=False)
    correct_option = Column(String(1), nullable=False)
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


# ==================================================
# QUESTION-CONCEPT MAP
# ==================================================
class QuestionConcept(Base):
    __tablename__ = "question_concepts"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(
        Integer, ForeignKey("questions.id"), nullable=False, index=True
    )
    concept_id = Column(
        Integer, ForeignKey("concepts.id"), nullable=False, index=True
    )
    weight = Column(Float, default=1.0)

    question = relationship("Question", back_populates="concept_links")
    concept = relationship("Concept", back_populates="question_links")


# ==================================================
# QUESTION ATTEMPT
# ==================================================
class QuestionAttempt(Base):
    __tablename__ = "question_attempts"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(
        Integer, ForeignKey("students.id"), nullable=False, index=True
    )
    question_id = Column(
        Integer, ForeignKey("questions.id"), nullable=False, index=True
    )
    selected_option = Column(String(1), nullable=True)
    is_correct = Column(Boolean, default=False)
    time_spent_secs = Column(Integer, default=0)
    session_id = Column(String, index=True)
    attempted_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student", back_populates="question_attempts")
    question = relationship("Question", back_populates="attempts")


# ==================================================
# CONCEPT STAT
# ==================================================
class ConceptStat(Base):
    __tablename__ = "concept_stats"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(
        Integer, ForeignKey("students.id"), nullable=False, index=True
    )
    concept_id = Column(
        Integer, ForeignKey("concepts.id"), nullable=False, index=True
    )
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


# ==================================================
# RECOMMENDATION
# ==================================================
class Recommendation(Base):
    __tablename__ = "recommendations"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(
        Integer, ForeignKey("students.id"), nullable=False, index=True
    )
    concept_id = Column(
        Integer, ForeignKey("concepts.id"), nullable=False, index=True
    )
    priority = Column(Float, default=0.0)
    reason = Column(Text, default="")
    suggested_minutes = Column(Integer, default=30)
    activity_type = Column(String, default="read")
    status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student", back_populates="recommendations")
    concept = relationship("Concept", back_populates="recommendations")


# ==================================================
# SEARCH HISTORY
# ==================================================
class SearchHistory(Base):
    __tablename__ = "search_history"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(
        Integer, ForeignKey("students.id"), nullable=False, index=True
    )
    topic_id = Column(
        Integer, ForeignKey("topics.id"), nullable=False, index=True
    )
    query = Column(String, nullable=False)
    searched_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student")
    topic = relationship("Topic")