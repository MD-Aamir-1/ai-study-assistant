from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date as date_cls, timedelta
from typing import Optional, Dict

from database import engine, Base, SessionLocal
import models
import schemas

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Study Assistant")

# ---------- CORS ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://*.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- DB Dependency ----------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==================================================
# ROOT
# ==================================================
@app.get("/")
def home():
    return {"message": "AI Study Assistant Backend is Running!"}


# ==================================================
# AUTH — Login / Find-or-Create Student
# ==================================================
class LoginRequest(BaseModel):
    email: str
    name: Optional[str] = None
    course: Optional[str] = None


@app.post("/auth/login")
def login_or_register(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    student = (
        db.query(models.Student)
        .filter(models.Student.email == email)
        .first()
    )

    created = False
    if not student:
        name = (payload.name or email.split("@")[0]).strip()
        course = (payload.course or "General").strip()
        student = models.Student(name=name, email=email, course=course)
        db.add(student)
        db.commit()
        db.refresh(student)
        created = True

    return {
        "student_id": student.id,
        "name": student.name,
        "email": student.email,
        "course": student.course,
        "created": created,
    }


# ==================================================
# STUDENTS
# ==================================================
@app.post("/students", response_model=schemas.StudentResponse)
def create_student(student: schemas.StudentCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Student).filter(models.Student.email == student.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    new_student = models.Student(**student.dict())
    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    return new_student


@app.get("/students", response_model=list[schemas.StudentResponse])
def get_all_students(db: Session = Depends(get_db)):
    return db.query(models.Student).all()


@app.get("/students/{student_id}", response_model=schemas.StudentResponse)
def get_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    course: Optional[str] = None


@app.put("/students/{student_id}", response_model=schemas.StudentResponse)
def update_student(student_id: int, updates: StudentUpdate, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if updates.email and updates.email != student.email:
        existing = db.query(models.Student).filter(models.Student.email == updates.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        student.email = updates.email

    if updates.name:
        student.name = updates.name
    if updates.course:
        student.course = updates.course

    db.commit()
    db.refresh(student)
    return student


@app.delete("/students/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    subjects = db.query(models.Subject).filter(models.Subject.student_id == student_id).all()
    for subject in subjects:
        db.query(models.Topic).filter(models.Topic.subject_id == subject.id).delete()
    db.query(models.Subject).filter(models.Subject.student_id == student_id).delete()
    db.query(models.Performance).filter(models.Performance.student_id == student_id).delete()
    db.query(models.StudyPlan).filter(models.StudyPlan.student_id == student_id).delete()
    db.query(models.QuizResult).filter(models.QuizResult.student_id == student_id).delete()
    db.query(models.QuestionAttempt).filter(models.QuestionAttempt.student_id == student_id).delete()
    db.query(models.ConceptStat).filter(models.ConceptStat.student_id == student_id).delete()
    db.query(models.Recommendation).filter(models.Recommendation.student_id == student_id).delete()

    db.delete(student)
    db.commit()
    return {"message": "Student and all related data deleted", "id": student_id}


@app.get("/students/{student_id}/export")
def export_student_data(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    subjects = db.query(models.Subject).filter(models.Subject.student_id == student_id).all()
    topics = []
    for subject in subjects:
        t = db.query(models.Topic).filter(models.Topic.subject_id == subject.id).all()
        topics.extend(t)

    performances = db.query(models.Performance).filter(models.Performance.student_id == student_id).all()
    plans = db.query(models.StudyPlan).filter(models.StudyPlan.student_id == student_id).all()
    quizzes = db.query(models.QuizResult).filter(models.QuizResult.student_id == student_id).all()

    return {
        "student": {"id": student.id, "name": student.name, "email": student.email, "course": student.course},
        "subjects": [{"id": s.id, "name": s.name} for s in subjects],
        "topics": [{"id": t.id, "name": t.name, "difficulty": t.difficulty, "subject_id": t.subject_id} for t in topics],
        "performances": [{"topic_id": p.topic_id, "score": p.score, "attempts": p.attempts} for p in performances],
        "study_plans": [{"topic_id": p.topic_id, "date": p.date, "duration_minutes": p.duration_minutes, "completed": p.completed} for p in plans],
        "quiz_results": [{"topic_id": q.topic_id, "score": q.score, "total_questions": q.total_questions, "date": q.date} for q in quizzes],
        "exported_at": str(date_cls.today()),
    }


# ==================================================
# SUBJECTS
# ==================================================
@app.post("/subjects", response_model=schemas.SubjectResponse)
def create_subject(subject: schemas.SubjectCreate, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == subject.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    new_subject = models.Subject(**subject.dict())
    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)
    return new_subject


@app.get("/subjects", response_model=list[schemas.SubjectResponse])
def get_all_subjects(db: Session = Depends(get_db)):
    return db.query(models.Subject).all()


@app.get("/students/{student_id}/subjects", response_model=list[schemas.SubjectResponse])
def get_student_subjects(student_id: int, db: Session = Depends(get_db)):
    return db.query(models.Subject).filter(models.Subject.student_id == student_id).all()


@app.delete("/subjects/{subject_id}")
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    db.delete(subject)
    db.commit()
    return {"message": "Subject deleted", "id": subject_id}


# ==================================================
# TOPICS
# ==================================================
@app.post("/topics", response_model=schemas.TopicResponse)
def create_topic(topic: schemas.TopicCreate, db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    new_topic = models.Topic(**topic.dict())
    db.add(new_topic)
    db.commit()
    db.refresh(new_topic)
    return new_topic


@app.get("/topics", response_model=list[schemas.TopicResponse])
def get_all_topics(db: Session = Depends(get_db)):
    return db.query(models.Topic).all()


@app.get("/subjects/{subject_id}/topics", response_model=list[schemas.TopicResponse])
def get_subject_topics(subject_id: int, db: Session = Depends(get_db)):
    return db.query(models.Topic).filter(models.Topic.subject_id == subject_id).all()


@app.delete("/topics/{topic_id}")
def delete_topic(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    db.delete(topic)
    db.commit()
    return {"message": "Topic deleted", "id": topic_id}


@app.get("/students/{student_id}/topics/enriched")
def get_enriched_topics(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    subjects = db.query(models.Subject).filter(models.Subject.student_id == student_id).all()
    result = []
    for subject in subjects:
        topics = db.query(models.Topic).filter(models.Topic.subject_id == subject.id).all()
        for topic in topics:
            perf = db.query(models.Performance).filter(
                models.Performance.student_id == student_id,
                models.Performance.topic_id == topic.id,
            ).first()
            result.append({
                "id": topic.id,
                "name": topic.name,
                "difficulty": topic.difficulty,
                "subject_id": subject.id,
                "subject_name": subject.name,
                "score": perf.score if perf else 0.0,
                "attempts": perf.attempts if perf else 0,
            })
    return result


# ==================================================
# PERFORMANCE
# ==================================================
@app.post("/performance", response_model=schemas.PerformanceResponse)
def create_performance(perf: schemas.PerformanceCreate, db: Session = Depends(get_db)):
    new_perf = models.Performance(**perf.dict())
    db.add(new_perf)
    db.commit()
    db.refresh(new_perf)
    return new_perf


@app.get("/students/{student_id}/performance", response_model=list[schemas.PerformanceResponse])
def get_student_performance(student_id: int, db: Session = Depends(get_db)):
    return db.query(models.Performance).filter(models.Performance.student_id == student_id).all()


@app.put("/performance/{performance_id}", response_model=schemas.PerformanceResponse)
def update_performance(performance_id: int, score: float, attempts: int = 1, db: Session = Depends(get_db)):
    perf = db.query(models.Performance).filter(models.Performance.id == performance_id).first()
    if not perf:
        raise HTTPException(status_code=404, detail="Performance record not found")
    perf.score = score
    perf.attempts = attempts
    db.commit()
    db.refresh(perf)
    return perf


# ==================================================
# STUDY PLAN (legacy, kept for compatibility)
# ==================================================
@app.post("/study-plan", response_model=schemas.StudyPlanResponse)
def create_study_plan(plan: schemas.StudyPlanCreate, db: Session = Depends(get_db)):
    new_plan = models.StudyPlan(**plan.dict())
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)
    return new_plan


@app.get("/students/{student_id}/study-plan", response_model=list[schemas.StudyPlanResponse])
def get_student_study_plan(student_id: int, db: Session = Depends(get_db)):
    return db.query(models.StudyPlan).filter(models.StudyPlan.student_id == student_id).all()


@app.put("/study-plan/{plan_id}/complete", response_model=schemas.StudyPlanResponse)
def complete_study_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(models.StudyPlan).filter(models.StudyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    plan.completed = True
    db.commit()
    db.refresh(plan)
    return plan


# ==================================================
# QUIZ QUESTIONS (legacy, kept for compatibility)
# ==================================================
@app.post("/quiz/questions", response_model=schemas.QuizQuestionResponse)
def create_quiz_question(q: schemas.QuizQuestionCreate, db: Session = Depends(get_db)):
    new_q = models.QuizQuestion(**q.dict())
    db.add(new_q)
    db.commit()
    db.refresh(new_q)
    return new_q


@app.get("/topics/{topic_id}/questions", response_model=list[schemas.QuizQuestionResponse])
def get_topic_questions(topic_id: int, db: Session = Depends(get_db)):
    return db.query(models.QuizQuestion).filter(models.QuizQuestion.topic_id == topic_id).all()


class QuizQuestionBulk(BaseModel):
    questions: list[schemas.QuizQuestionCreate]


@app.post("/quiz/questions/bulk")
def bulk_create_questions(payload: QuizQuestionBulk, db: Session = Depends(get_db)):
    created = []
    for q in payload.questions:
        new_q = models.QuizQuestion(**q.dict())
        db.add(new_q)
        created.append(new_q)
    db.commit()
    for q in created:
        db.refresh(q)
    return {"created": len(created), "question_ids": [q.id for q in created]}


# ==================================================
# QUIZ RESULTS
# ==================================================
@app.post("/quiz/results", response_model=schemas.QuizResultResponse)
def create_quiz_result(r: schemas.QuizResultCreate, db: Session = Depends(get_db)):
    new_r = models.QuizResult(**r.dict())
    db.add(new_r)
    db.commit()
    db.refresh(new_r)
    return new_r


@app.get("/students/{student_id}/quiz-results", response_model=list[schemas.QuizResultResponse])
def get_student_quiz_results(student_id: int, db: Session = Depends(get_db)):
    return db.query(models.QuizResult).filter(models.QuizResult.student_id == student_id).all()


# ==================================================
# DASHBOARD ANALYTICS (concept-based)
# ==================================================
@app.get("/analytics/dashboard/{student_id}")
def dashboard_analytics(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Subjects
    subjects = db.query(models.Subject).filter(models.Subject.student_id == student_id).all()
    total_subjects = len(subjects)

    # Concept stats
    stats = db.query(models.ConceptStat).filter(models.ConceptStat.student_id == student_id).all()
    concepts_tested = len(stats)
    avg_score = round(sum(s.score for s in stats) / concepts_tested, 1) if concepts_tested else 0.0
    strong_concepts = sum(1 for s in stats if s.score >= 75)
    weak_concepts = sum(1 for s in stats if s.score < 50)

    # Total concepts available
    total_concepts = 0
    for subject in subjects:
        topics = db.query(models.Topic).filter(models.Topic.subject_id == subject.id).all()
        for topic in topics:
            total_concepts += db.query(models.Concept).filter(models.Concept.topic_id == topic.id).count()

    # Test sessions + streak from question_attempts
    attempts = db.query(models.QuestionAttempt).filter(
        models.QuestionAttempt.student_id == student_id
    ).all()

    session_ids = {a.session_id for a in attempts if a.session_id}
    test_sessions = len(session_ids)

    attempt_dates = sorted(
        {a.attempted_at.date() for a in attempts if a.attempted_at},
        reverse=True,
    )
    streak = 0
    if attempt_dates:
        today = date_cls.today()
        if attempt_dates[0] >= today - timedelta(days=1):
            cursor = attempt_dates[0]
            for d in attempt_dates:
                if d == cursor:
                    streak += 1
                    cursor = cursor - timedelta(days=1)
                elif d < cursor:
                    break

    # Subject performance from concept stats
    subject_performance = []
    for subject in subjects:
        topic_concept_scores = []
        topics = db.query(models.Topic).filter(models.Topic.subject_id == subject.id).all()
        for topic in topics:
            concepts = db.query(models.Concept).filter(models.Concept.topic_id == topic.id).all()
            for c in concepts:
                stat = db.query(models.ConceptStat).filter(
                    models.ConceptStat.student_id == student_id,
                    models.ConceptStat.concept_id == c.id,
                ).first()
                if stat:
                    topic_concept_scores.append(stat.score)

        avg = (
            round(sum(topic_concept_scores) / len(topic_concept_scores), 1)
            if topic_concept_scores else 0.0
        )
        subject_performance.append({
            "subject_name": subject.name,
            "avg_score": avg,
            "topics_count": len(topics),
        })

    # AI recommendation
    from recommendation import get_recommendations
    recs = get_recommendations(student_id, db)
    top_rec = recs[0] if recs else None
    ai_recommendation = (
        f"Focus on {top_rec['topic_name']} in {top_rec['subject_name']} today. {top_rec['reason']}"
        if top_rec else "Search for a topic to get started."
    )

    return {
        "student_id": student_id,
        "student_name": student.name,
        "concepts_tested": concepts_tested,
        "total_concepts": total_concepts,
        "avg_score": avg_score,
        "strong_concepts": strong_concepts,
        "weak_concepts": weak_concepts,
        "test_sessions": test_sessions,
        "streak_days": streak,
        "total_subjects": total_subjects,
        "subject_performance": subject_performance,
        "ai_recommendation": ai_recommendation,
    }


# ==================================================
# ML RISK PREDICTION
# ==================================================
from ml_predictor import predict_risk


@app.get("/ml/predict/{student_id}")
def ml_predict(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    subjects = db.query(models.Subject).filter(models.Subject.student_id == student_id).all()
    predictions = []
    for subject in subjects:
        topics = db.query(models.Topic).filter(models.Topic.subject_id == subject.id).all()
        for topic in topics:
            perf = db.query(models.Performance).filter(
                models.Performance.student_id == student_id,
                models.Performance.topic_id == topic.id,
            ).first()

            score = perf.score if perf else 0.0
            attempts = perf.attempts if perf else 0
            risk = predict_risk(score, attempts, topic.difficulty)

            predictions.append({
                "topic_id": topic.id,
                "topic_name": topic.name,
                "subject_name": subject.name,
                "difficulty": topic.difficulty,
                "score": score,
                "attempts": attempts,
                "at_risk": risk["at_risk"],
                "risk_probability": risk["probability"],
                "confidence": risk["confidence"],
            })

    predictions.sort(key=lambda x: x["risk_probability"], reverse=True)
    at_risk_count = sum(1 for p in predictions if p["at_risk"])

    return {
        "student_id": student_id,
        "student_name": student.name,
        "total_topics": len(predictions),
        "at_risk_topics": at_risk_count,
        "predictions": predictions,
    }


# ==================================================
# AI TUTOR
# ==================================================
from ai_tutor import ask_tutor


class AIAskRequest(BaseModel):
    student_id: int
    question: str


@app.post("/ai/ask")
def ai_ask(req: AIAskRequest, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Pull concept-level weaknesses (score < 65)
    stats = (
        db.query(models.ConceptStat)
        .filter(models.ConceptStat.student_id == req.student_id)
        .all()
    )

    weak = []
    for s in stats:
        if s.score >= 65:
            continue
        concept = db.query(models.Concept).filter(models.Concept.id == s.concept_id).first()
        if not concept:
            continue
        topic = db.query(models.Topic).filter(models.Topic.id == concept.topic_id).first()
        if not topic:
            continue
        subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()

        weak.append({
            "concept_name": concept.name,
            "topic_name": topic.name,
            "subject_name": subject.name if subject else "General",
            "score": s.score,
            "trend": s.trend,
            "attempts": s.attempts,
        })

    # Sort by lowest score first
    weak.sort(key=lambda x: x["score"])

    try:
        answer = ask_tutor(req.question, weak)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Tutor error: {str(e)}")

    return {
        "student_id": req.student_id,
        "question": req.question,
        "answer": answer,
        "context_concepts": [w["concept_name"] for w in weak],
    }


# ==================================================
# PHASE B — TOPIC SEARCH, CONTENT & CONCEPTS
# ==================================================
import json
from services.content_service import get_or_create_content, invalidate_content
from services.concept_service import get_or_create_concepts


class TopicSearchRequest(BaseModel):
    topic_name: str
    student_id: int
    difficulty: str = "medium"


@app.post("/topics/search-or-create")
def search_or_create_topic(payload: TopicSearchRequest, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    name = payload.topic_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Topic name cannot be empty")

    explored = (
        db.query(models.Subject)
        .filter(
            models.Subject.student_id == payload.student_id,
            models.Subject.name == "Explored Topics",
        )
        .first()
    )
    if not explored:
        explored = models.Subject(name="Explored Topics", student_id=payload.student_id)
        db.add(explored)
        db.commit()
        db.refresh(explored)

    existing = (
        db.query(models.Topic)
        .filter(models.Topic.subject_id == explored.id, models.Topic.name.ilike(name))
        .first()
    )
    if existing:
        return {
            "topic_id": existing.id,
            "topic_name": existing.name,
            "subject_id": explored.id,
            "subject_name": explored.name,
            "difficulty": existing.difficulty,
            "created": False,
        }

    topic = models.Topic(name=name, difficulty=payload.difficulty, subject_id=explored.id)
    db.add(topic)
    db.commit()
    db.refresh(topic)

    return {
        "topic_id": topic.id,
        "topic_name": topic.name,
        "subject_id": explored.id,
        "subject_name": explored.name,
        "difficulty": topic.difficulty,
        "created": True,
    }


@app.post("/topics/{topic_id}/generate-content")
def generate_topic_content(topic_id: int, force: bool = False, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    try:
        if force:
            invalidate_content(topic_id, db)
        content = get_or_create_content(topic_id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Content generation failed: {e}")
    return {"topic_id": topic_id, "topic_name": topic.name, "content": content}


@app.get("/topics/{topic_id}/content")
def get_topic_content(topic_id: int, db: Session = Depends(get_db)):
    record = db.query(models.LearningContent).filter(models.LearningContent.topic_id == topic_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Content not generated yet")
    return {"topic_id": topic_id, "content": json.loads(record.content_json)}


@app.post("/topics/{topic_id}/extract-concepts")
def extract_topic_concepts(topic_id: int, force: bool = False, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    try:
        concepts = get_or_create_concepts(topic_id, db, force=force)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Concept extraction failed: {e}")
    return {
        "topic_id": topic_id,
        "topic_name": topic.name,
        "concepts": [
            {"id": c.id, "name": c.name, "description": c.description, "importance": c.importance, "order_index": c.order_index}
            for c in concepts
        ],
    }


@app.get("/topics/{topic_id}/concepts")
def list_topic_concepts(topic_id: int, db: Session = Depends(get_db)):
    concepts = (
        db.query(models.Concept)
        .filter(models.Concept.topic_id == topic_id)
        .order_by(models.Concept.order_index)
        .all()
    )
    return {
        "topic_id": topic_id,
        "concepts": [
            {"id": c.id, "name": c.name, "description": c.description, "importance": c.importance, "order_index": c.order_index}
            for c in concepts
        ],
    }


@app.get("/topics/{topic_id}/full")
def get_topic_full(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()

    try:
        content = get_or_create_content(topic_id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Content failed: {e}")

    try:
        concepts = get_or_create_concepts(topic_id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Concepts failed: {e}")

    return {
        "topic": {
            "id": topic.id,
            "name": topic.name,
            "difficulty": topic.difficulty,
            "subject_id": topic.subject_id,
            "subject_name": subject.name if subject else "General",
        },
        "content": content,
        "concepts": [
            {"id": c.id, "name": c.name, "description": c.description, "importance": c.importance, "order_index": c.order_index}
            for c in concepts
        ],
    }


# ==================================================
# PHASE C — CONCEPT-AWARE TESTING
# ==================================================
from services.question_service import generate_test, submit_test


class TestGenerateRequest(BaseModel):
    topic_id: int
    num_questions: int = 8


class TestSubmitRequest(BaseModel):
    student_id: int
    answers: Dict[str, Optional[str]]
    session_id: Optional[str] = None


@app.post("/tests/generate")
def generate_test_endpoint(payload: TestGenerateRequest, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.id == payload.topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    num = max(3, min(payload.num_questions, 15))
    try:
        result = generate_test(payload.topic_id, db, num)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test generation failed: {e}")
    return result


@app.post("/tests/submit")
def submit_test_endpoint(payload: TestSubmitRequest, db: Session = Depends(get_db)):
    try:
        result = submit_test(
            student_id=payload.student_id,
            answers=payload.answers,
            db=db,
            session_id=payload.session_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test submission failed: {e}")
    return result


@app.get("/students/{student_id}/concepts")
def get_student_concepts(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    stats = db.query(models.ConceptStat).filter(models.ConceptStat.student_id == student_id).all()

    from collections import defaultdict
    from ml_predictor import predict_risk

    by_topic = defaultdict(list)

    for s in stats:
        concept = db.query(models.Concept).filter(models.Concept.id == s.concept_id).first()
        if not concept:
            continue
        topic = db.query(models.Topic).filter(models.Topic.id == concept.topic_id).first()
        if not topic:
            continue

        # ---------- ML risk prediction for this concept ----------
        try:
            risk = predict_risk(
                score=s.score,
                attempts=s.attempts,
                difficulty=topic.difficulty or "medium",
            )
            at_risk = risk["at_risk"]
            risk_prob = risk["probability"]
            risk_conf = risk["confidence"]
        except Exception:
            # ML not available — graceful fallback
            at_risk = s.score < 50
            risk_prob = 0.5
            risk_conf = "low"

        by_topic[topic.id].append({
            "concept_id": s.concept_id,
            "concept_name": concept.name,
            "description": concept.description,
            "importance": concept.importance,
            "score": s.score,
            "attempts": s.attempts,
            "correct": s.correct,
            "confidence": s.confidence,
            "trend": s.trend,
            # NEW ML fields
            "at_risk": at_risk,
            "risk_probability": risk_prob,
            "risk_confidence": risk_conf,
        })

    topics_data = []
    for tid, concept_list in by_topic.items():
        topic = db.query(models.Topic).filter(models.Topic.id == tid).first()
        subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()
        topics_data.append({
            "topic_id": tid,
            "topic_name": topic.name,
            "subject_name": subject.name if subject else "General",
            "concepts": concept_list,
        })

    return {"student_id": student_id, "topics": topics_data}


# ==================================================
# PHASE D — RECOMMENDATION ENGINE
# ==================================================
from services.recommendation_service import (
    generate_recommendations,
    get_pending_recommendations,
    mark_completed,
)


@app.post("/students/{student_id}/generate-recommendations")
def generate_recs(student_id: int, force: bool = False, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    try:
        recs = generate_recommendations(student_id, db, force=force)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")
    return {
        "student_id": student_id,
        "student_name": student.name,
        "total": len(recs),
        "recommendations": recs,
    }


@app.get("/students/{student_id}/recommendations")
def list_recs(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    recs = get_pending_recommendations(student_id, db)
    total_minutes = sum(r["suggested_minutes"] for r in recs)
    return {
        "student_id": student_id,
        "student_name": student.name,
        "total": len(recs),
        "total_minutes": total_minutes,
        "recommendations": recs,
    }


@app.put("/recommendations/{rec_id}/complete")
def complete_rec(rec_id: int, student_id: int, db: Session = Depends(get_db)):
    try:
        rec = mark_completed(rec_id, student_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"message": "Marked as complete", "id": rec.id, "status": rec.status}
# ==================================================
# CONCEPT DEEP-DIVE CONTENT
# ==================================================
from services.concept_content_service import (
    get_or_create_concept_content,
    invalidate_concept_content,
)


@app.post("/concepts/{concept_id}/content")
def get_concept_content_endpoint(
    concept_id: int, force: bool = False, db: Session = Depends(get_db)
):
    """Generate (or return cached) deep-dive content for a single concept."""
    concept = db.query(models.Concept).filter(models.Concept.id == concept_id).first()
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    try:
        if force:
            invalidate_concept_content(concept_id, db)
        content = get_or_create_concept_content(concept_id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Concept generation failed: {e}")

    topic = db.query(models.Topic).filter(models.Topic.id == concept.topic_id).first()

    return {
        "concept_id": concept_id,
        "concept_name": concept.name,
        "topic_name": topic.name if topic else "—",
        "content": content,
    }