# ==================================================
# AI STUDY ASSISTANT - MAIN APP
# ==================================================
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Optional
from datetime import date as date_cls, timedelta
import json

from database import engine, Base, SessionLocal
import models
import schemas

# Services
from services.content_service import get_or_create_content, invalidate_content
from services.concept_service import get_or_create_concepts
from services.question_service import generate_test, submit_test
from recommendation import get_recommendations, generate_study_plan
from ai_tutor import ask_tutor, generate_quiz_questions
from ml_predictor import predict_risk


# ==================================================
# APP SETUP
# ==================================================
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Study Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================================================
# DB DEPENDENCY
# ==================================================
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
        existing = db.query(models.Student).filter(
            models.Student.email == updates.email
        ).first()
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

    subjects = db.query(models.Subject).filter(
        models.Subject.student_id == student_id
    ).all()
    for subject in subjects:
        db.query(models.Topic).filter(
            models.Topic.subject_id == subject.id
        ).delete()
    db.query(models.Subject).filter(models.Subject.student_id == student_id).delete()
    db.query(models.Performance).filter(
        models.Performance.student_id == student_id
    ).delete()
    db.query(models.StudyPlan).filter(
        models.StudyPlan.student_id == student_id
    ).delete()
    db.query(models.QuizResult).filter(
        models.QuizResult.student_id == student_id
    ).delete()

    db.delete(student)
    db.commit()
    return {"message": "Student and all related data deleted", "id": student_id}


@app.get("/students/{student_id}/export")
def export_student_data(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    subjects = db.query(models.Subject).filter(
        models.Subject.student_id == student_id
    ).all()

    topics = []
    for subject in subjects:
        t = db.query(models.Topic).filter(models.Topic.subject_id == subject.id).all()
        topics.extend(t)

    performances = db.query(models.Performance).filter(
        models.Performance.student_id == student_id
    ).all()
    plans = db.query(models.StudyPlan).filter(
        models.StudyPlan.student_id == student_id
    ).all()
    quizzes = db.query(models.QuizResult).filter(
        models.QuizResult.student_id == student_id
    ).all()

    return {
        "student": {
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "course": student.course,
        },
        "subjects": [{"id": s.id, "name": s.name} for s in subjects],
        "topics": [
            {"id": t.id, "name": t.name, "difficulty": t.difficulty, "subject_id": t.subject_id}
            for t in topics
        ],
        "performances": [
            {"topic_id": p.topic_id, "score": p.score, "attempts": p.attempts}
            for p in performances
        ],
        "study_plans": [
            {
                "topic_id": p.topic_id,
                "date": p.date,
                "duration_minutes": p.duration_minutes,
                "completed": p.completed,
            }
            for p in plans
        ],
        "quiz_results": [
            {
                "topic_id": q.topic_id,
                "score": q.score,
                "total_questions": q.total_questions,
                "date": q.date,
            }
            for q in quizzes
        ],
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


@app.get("/students/{student_id}/subjects/enriched")
def get_enriched_subjects(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    subjects = db.query(models.Subject).filter(
        models.Subject.student_id == student_id
    ).all()

    result = []
    for subject in subjects:
        topics = db.query(models.Topic).filter(
            models.Topic.subject_id == subject.id
        ).all()

        total_score = 0.0
        for topic in topics:
            perf = db.query(models.Performance).filter(
                models.Performance.student_id == student_id,
                models.Performance.topic_id == topic.id
            ).first()
            total_score += perf.score if perf else 0

        avg = round(total_score / len(topics), 1) if topics else 0

        result.append({
            "id": subject.id,
            "name": subject.name,
            "student_id": subject.student_id,
            "topic_count": len(topics),
            "avg_score": avg,
        })

    return result


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


@app.get("/students/{student_id}/topics/enriched")
def get_enriched_topics(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    subjects = db.query(models.Subject).filter(
        models.Subject.student_id == student_id
    ).all()

    result = []
    for subject in subjects:
        topics = db.query(models.Topic).filter(
            models.Topic.subject_id == subject.id
        ).all()

        for topic in topics:
            perf = db.query(models.Performance).filter(
                models.Performance.student_id == student_id,
                models.Performance.topic_id == topic.id
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


@app.delete("/topics/{topic_id}")
def delete_topic(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    db.delete(topic)
    db.commit()
    return {"message": "Topic deleted", "id": topic_id}


# ==================================================
# PHASE B — TOPIC SEARCH, CONTENT & CONCEPTS
# ==================================================
@app.post("/topics/search-or-create", response_model=schemas.TopicSearchResponse)
def search_or_create_topic(payload: schemas.TopicSearchRequest, db: Session = Depends(get_db)):
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
        .filter(
            models.Topic.subject_id == explored.id,
            models.Topic.name.ilike(name),
        )
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

    topic = models.Topic(
        name=name,
        difficulty=payload.difficulty,
        subject_id=explored.id,
    )
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

    return {
        "topic_id": topic_id,
        "topic_name": topic.name,
        "content": content,
    }


@app.get("/topics/{topic_id}/content")
def get_topic_content(topic_id: int, db: Session = Depends(get_db)):
    record = (
        db.query(models.LearningContent)
        .filter(models.LearningContent.topic_id == topic_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Content not generated yet")

    return {
        "topic_id": topic_id,
        "content": json.loads(record.content_json),
    }


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
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "importance": c.importance,
                "order_index": c.order_index,
            }
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
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "importance": c.importance,
                "order_index": c.order_index,
            }
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
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "importance": c.importance,
                "order_index": c.order_index,
            }
            for c in concepts
        ],
    }


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
# STUDY PLAN
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
# RECOMMENDATION ENGINE
# ==================================================
@app.get("/recommendations/{student_id}")
def recommendations(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    recs = get_recommendations(student_id, db)
    return {
        "student_id": student_id,
        "student_name": student.name,
        "total_topics": len(recs),
        "recommendations": recs,
    }


@app.post("/generate-study-plan/{student_id}")
def auto_generate_study_plan(student_id: int, daily_minutes: int = 120, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    plans = generate_study_plan(student_id, db, daily_minutes)
    if not plans:
        raise HTTPException(status_code=400, detail="No topics found to plan for")

    return {
        "message": f"Study plan generated for {student.name}",
        "date": plans[0].date,
        "total_minutes": sum(p.duration_minutes for p in plans),
        "plans": [
            {
                "plan_id": p.id,
                "topic_id": p.topic_id,
                "duration_minutes": p.duration_minutes,
                "completed": p.completed,
            }
            for p in plans
        ],
    }


# ==================================================
# LEGACY QUIZ (fixed questions)
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


class QuizSubmission(BaseModel):
    student_id: int
    topic_id: int
    answers: Dict[int, str]


@app.post("/quiz/submit")
def submit_quiz(submission: QuizSubmission, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == submission.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    topic = db.query(models.Topic).filter(models.Topic.id == submission.topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    questions = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.topic_id == submission.topic_id
    ).all()
    if not questions:
        raise HTTPException(status_code=400, detail="No questions available for this topic")

    correct_count = 0
    details = []
    for q in questions:
        selected = submission.answers.get(q.id)
        is_correct = (selected == q.correct_option)
        if is_correct:
            correct_count += 1
        details.append({
            "question_id": q.id,
            "question": q.question,
            "your_answer": selected,
            "correct_answer": q.correct_option,
            "is_correct": is_correct
        })

    total = len(questions)
    score_percent = round((correct_count / total) * 100, 2)

    quiz_result = models.QuizResult(
        student_id=submission.student_id,
        topic_id=submission.topic_id,
        score=score_percent,
        total_questions=total,
        date=str(date_cls.today())
    )
    db.add(quiz_result)

    perf = db.query(models.Performance).filter(
        models.Performance.student_id == submission.student_id,
        models.Performance.topic_id == submission.topic_id
    ).first()

    if perf:
        perf.score = round((perf.score + score_percent) / 2, 2)
        perf.attempts += 1
    else:
        perf = models.Performance(
            student_id=submission.student_id,
            topic_id=submission.topic_id,
            score=score_percent,
            attempts=1
        )
        db.add(perf)

    db.commit()
    db.refresh(quiz_result)

    return {
        "message": "Quiz submitted and performance updated",
        "quiz_result_id": quiz_result.id,
        "score_percent": score_percent,
        "correct": correct_count,
        "total": total,
        "updated_performance": {
            "topic_id": submission.topic_id,
            "new_score": perf.score,
            "attempts": perf.attempts
        },
        "details": details
    }


@app.get("/students/{student_id}/quiz-results", response_model=list[schemas.QuizResultResponse])
def get_student_quiz_results(student_id: int, db: Session = Depends(get_db)):
    return db.query(models.QuizResult).filter(models.QuizResult.student_id == student_id).all()


# ==================================================
# DYNAMIC AI-GENERATED QUIZZES (legacy dynamic flow)
# ==================================================
class QuizGenerateRequest(BaseModel):
    topic_id: int
    num_questions: int = 5


@app.post("/quiz/generate")
def generate_quiz(req: QuizGenerateRequest, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.id == req.topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    subject = db.query(models.Subject).filter(
        models.Subject.id == topic.subject_id
    ).first()
    subject_name = subject.name if subject else "General"

    num = max(3, min(req.num_questions, 10))

    try:
        questions = generate_quiz_questions(
            topic.name, subject_name, topic.difficulty, num
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")

    for i, q in enumerate(questions):
        q["id"] = i + 1
        q["topic_id"] = req.topic_id

    return {
        "topic_id": req.topic_id,
        "topic_name": topic.name,
        "subject_name": subject_name,
        "difficulty": topic.difficulty,
        "questions": questions,
    }


class DynamicQuizSubmission(BaseModel):
    student_id: int
    topic_id: int
    questions: list[dict]
    answers: dict


@app.post("/quiz/submit-dynamic")
def submit_dynamic_quiz(submission: DynamicQuizSubmission, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(
        models.Student.id == submission.student_id
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    topic = db.query(models.Topic).filter(models.Topic.id == submission.topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    details = []
    correct_count = 0

    for q in submission.questions:
        qid = str(q.get("id"))
        selected = submission.answers.get(qid)
        if selected is None:
            selected = submission.answers.get(q.get("id"))
        correct = q.get("correct_option")
        is_correct = selected == correct
        if is_correct:
            correct_count += 1
        details.append({
            "question_id": q.get("id"),
            "question": q.get("question"),
            "your_answer": selected,
            "correct_answer": correct,
            "is_correct": is_correct,
        })

    total = len(submission.questions)
    score_percent = round((correct_count / total) * 100, 2) if total else 0.0

    quiz_result = models.QuizResult(
        student_id=submission.student_id,
        topic_id=submission.topic_id,
        score=score_percent,
        total_questions=total,
        date=str(date_cls.today()),
    )
    db.add(quiz_result)

    perf = db.query(models.Performance).filter(
        models.Performance.student_id == submission.student_id,
        models.Performance.topic_id == submission.topic_id,
    ).first()

    if perf:
        perf.score = round((perf.score + score_percent) / 2, 2)
        perf.attempts += 1
    else:
        perf = models.Performance(
            student_id=submission.student_id,
            topic_id=submission.topic_id,
            score=score_percent,
            attempts=1,
        )
        db.add(perf)

    db.commit()
    db.refresh(quiz_result)

    return {
        "message": "Dynamic quiz submitted and performance updated",
        "quiz_result_id": quiz_result.id,
        "score_percent": score_percent,
        "correct": correct_count,
        "total": total,
        "updated_performance": {
            "topic_id": submission.topic_id,
            "new_score": perf.score,
            "attempts": perf.attempts,
        },
        "details": details,
    }


# ==================================================
# PHASE C — CONCEPT-AWARE TESTING
# ==================================================
@app.post("/tests/generate")
def generate_test_endpoint(payload: schemas.TestGenerateRequest, db: Session = Depends(get_db)):
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
def submit_test_endpoint(payload: schemas.TestSubmitRequest, db: Session = Depends(get_db)):
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

    stats = (
        db.query(models.ConceptStat)
        .filter(models.ConceptStat.student_id == student_id)
        .all()
    )

    from collections import defaultdict
    by_topic = defaultdict(list)

    for s in stats:
        concept = db.query(models.Concept).filter(models.Concept.id == s.concept_id).first()
        if not concept:
            continue
        topic = db.query(models.Topic).filter(models.Topic.id == concept.topic_id).first()
        if not topic:
            continue

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

    return {
        "student_id": student_id,
        "topics": topics_data,
    }


# ==================================================
# AI TUTOR
# ==================================================
class AIAskRequest(BaseModel):
    student_id: int
    question: str


@app.post("/ai/ask")
def ai_ask(req: AIAskRequest, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    subjects = db.query(models.Subject).filter(
        models.Subject.student_id == req.student_id
    ).all()

    weak = []
    for subject in subjects:
        topics = db.query(models.Topic).filter(
            models.Topic.subject_id == subject.id
        ).all()
        for topic in topics:
            perf = db.query(models.Performance).filter(
                models.Performance.student_id == req.student_id,
                models.Performance.topic_id == topic.id
            ).first()

            score = perf.score if perf else 0.0
            if score < 60:
                weak.append({
                    "topic_name": topic.name,
                    "subject_name": subject.name,
                    "score": score,
                    "difficulty": topic.difficulty,
                })

    weak.sort(key=lambda x: x["score"])

    try:
        answer = ask_tutor(req.question, weak)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Tutor error: {str(e)}")

    return {
        "student_id": req.student_id,
        "question": req.question,
        "answer": answer,
        "context_topics": [t["topic_name"] for t in weak],
    }


# ==================================================
# ML RISK PREDICTION
# ==================================================
@app.get("/ml/predict/{student_id}")
def ml_predict(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    subjects = db.query(models.Subject).filter(
        models.Subject.student_id == student_id
    ).all()

    predictions = []
    for subject in subjects:
        topics = db.query(models.Topic).filter(
            models.Topic.subject_id == subject.id
        ).all()

        for topic in topics:
            perf = db.query(models.Performance).filter(
                models.Performance.student_id == student_id,
                models.Performance.topic_id == topic.id
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
# DASHBOARD ANALYTICS
# ==================================================
@app.get("/analytics/dashboard/{student_id}")
def dashboard_analytics(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    today = str(date_cls.today())

    subjects = db.query(models.Subject).filter(
        models.Subject.student_id == student_id
    ).all()
    total_subjects = len(subjects)

    all_plans = db.query(models.StudyPlan).filter(
        models.StudyPlan.student_id == student_id
    ).all()

    total_plans = len(all_plans)
    completed_plans = sum(1 for p in all_plans if p.completed)
    study_progress = round(
        (completed_plans / total_plans * 100) if total_plans else 0, 1
    )

    today_plans = [p for p in all_plans if p.date == today]
    study_time_today = sum(p.duration_minutes for p in today_plans if p.completed)

    completed_dates = sorted(
        {p.date for p in all_plans if p.completed}, reverse=True
    )
    streak = 0
    if completed_dates:
        date_set = set(completed_dates)
        start = date_cls.fromisoformat(completed_dates[0])
        if start >= date_cls.today() - timedelta(days=1):
            cursor = start
            while str(cursor) in date_set:
                streak += 1
                cursor = cursor - timedelta(days=1)

    plan_details = []
    for p in today_plans:
        topic = db.query(models.Topic).filter(models.Topic.id == p.topic_id).first()
        if not topic:
            continue
        subject = db.query(models.Subject).filter(
            models.Subject.id == topic.subject_id
        ).first()
        plan_details.append({
            "plan_id": p.id,
            "topic_name": topic.name,
            "subject_name": subject.name if subject else "—",
            "difficulty": topic.difficulty,
            "duration_minutes": p.duration_minutes,
            "completed": p.completed,
        })

    subject_performance = []
    for subject in subjects:
        topics = db.query(models.Topic).filter(
            models.Topic.subject_id == subject.id
        ).all()
        if not topics:
            subject_performance.append({
                "subject_name": subject.name,
                "avg_score": 0,
                "topics_count": 0,
            })
            continue
        total_score = 0.0
        for topic in topics:
            perf = db.query(models.Performance).filter(
                models.Performance.student_id == student_id,
                models.Performance.topic_id == topic.id,
            ).first()
            total_score += perf.score if perf else 0
        avg = round(total_score / len(topics), 1)
        subject_performance.append({
            "subject_name": subject.name,
            "avg_score": avg,
            "topics_count": len(topics),
        })

    recs = get_recommendations(student_id, db)
    top_rec = recs[0] if recs else None
    ai_recommendation = (
        f"Focus on {top_rec['topic_name']} in {top_rec['subject_name']} today. "
        f"{top_rec['reason']}"
        if top_rec
        else "Add some subjects and topics to get started."
    )

    return {
        "student_id": student_id,
        "student_name": student.name,
        "study_progress": {
            "percentage": study_progress,
            "completed": completed_plans,
            "total": total_plans,
        },
        "study_time_today_minutes": study_time_today,
        "total_subjects": total_subjects,
        "streak_days": streak,
        "today_plan": plan_details,
        "subject_performance": subject_performance,
        "ai_recommendation": ai_recommendation,
    }


# ==================================================
# PROGRESS ANALYTICS
# ==================================================
@app.get("/analytics/progress/{student_id}")
def progress_analytics(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    subjects = db.query(models.Subject).filter(
        models.Subject.student_id == student_id
    ).all()

    all_topics = []
    subject_performance = []

    for subject in subjects:
        topics = db.query(models.Topic).filter(
            models.Topic.subject_id == subject.id
        ).all()

        subject_total = 0.0
        for topic in topics:
            perf = db.query(models.Performance).filter(
                models.Performance.student_id == student_id,
                models.Performance.topic_id == topic.id
            ).first()
            score = perf.score if perf else 0.0
            attempts = perf.attempts if perf else 0
            subject_total += score

            all_topics.append({
                "id": topic.id,
                "name": topic.name,
                "subject_name": subject.name,
                "difficulty": topic.difficulty,
                "score": score,
                "attempts": attempts,
            })

        avg = round(subject_total / len(topics), 1) if topics else 0.0
        subject_performance.append({
            "subject_name": subject.name,
            "avg_score": avg,
            "topic_count": len(topics),
        })

    avg_score = (
        round(sum(t["score"] for t in all_topics) / len(all_topics), 1)
        if all_topics else 0.0
    )

    all_plans = db.query(models.StudyPlan).filter(
        models.StudyPlan.student_id == student_id
    ).all()
    completed_plans = sum(1 for p in all_plans if p.completed)
    total_plans = len(all_plans)
    study_hours = round(
        sum(p.duration_minutes for p in all_plans if p.completed) / 60, 1
    )

    completed_dates = sorted(
        {p.date for p in all_plans if p.completed}, reverse=True
    )
    streak = 0
    if completed_dates:
        date_set = set(completed_dates)
        start = date_cls.fromisoformat(completed_dates[0])
        if start >= date_cls.today() - timedelta(days=1):
            cursor = start
            while str(cursor) in date_set:
                streak += 1
                cursor = cursor - timedelta(days=1)

    quiz_results = db.query(models.QuizResult).filter(
        models.QuizResult.student_id == student_id
    ).all()

    trend_map = {}
    for qr in quiz_results:
        try:
            d = date_cls.fromisoformat(qr.date)
        except Exception:
            continue
        week_key = d - timedelta(days=d.weekday())
        key = str(week_key)
        trend_map.setdefault(key, []).append(qr.score)

    score_trend = [
        {"week": k, "avg_score": round(sum(v) / len(v), 1)}
        for k, v in sorted(trend_map.items())
    ][-6:]

    total_questions = sum(qr.total_questions for qr in quiz_results)
    total_correct = sum(
        round((qr.score / 100) * qr.total_questions) for qr in quiz_results
    )
    total_wrong = max(total_questions - total_correct, 0)

    weakest = sorted(all_topics, key=lambda x: x["score"])[:5]

    return {
        "student_id": student_id,
        "student_name": student.name,
        "overall": {
            "avg_score": avg_score,
            "study_hours": study_hours,
            "tasks_completed": completed_plans,
            "total_tasks": total_plans,
            "streak_days": streak,
        },
        "subject_performance": subject_performance,
        "score_trend": score_trend,
        "quiz_accuracy": {
            "correct": total_correct,
            "wrong": total_wrong,
            "total": total_questions,
        },
        "weakest_topics": weakest,
    }
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
    """Recompute recommendations for a student and save them."""
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
    """Fetch pending recommendations for a student."""
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
    """Mark a recommendation as completed."""
    try:
        rec = mark_completed(rec_id, student_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"message": "Marked as complete", "id": rec.id, "status": rec.status}