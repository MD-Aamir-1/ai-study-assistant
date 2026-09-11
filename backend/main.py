from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict
from datetime import date

from database import engine, Base, SessionLocal
import models
import schemas
from recommendation import get_recommendations, generate_study_plan


# ---------- Create all database tables ----------
Base.metadata.create_all(bind=engine)


# ---------- FastAPI app ----------
app = FastAPI(title="AI Study Assistant")


# ---------- CORS (allow React frontend) ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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
# QUIZ QUESTIONS
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
# QUIZ SUBMISSION (auto-grade + auto-update performance)
# ==================================================
class QuizSubmission(BaseModel):
    student_id: int
    topic_id: int
    answers: Dict[int, str]  # { question_id: "A" / "B" / "C" / "D" }


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
            "is_correct": is_correct,
        })

    total = len(questions)
    score_percent = round((correct_count / total) * 100, 2)

    quiz_result = models.QuizResult(
        student_id=submission.student_id,
        topic_id=submission.topic_id,
        score=score_percent,
        total_questions=total,
        date=str(date.today()),
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
        "message": "Quiz submitted and performance updated",
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
# BULK CREATE QUIZ QUESTIONS
# ==================================================
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
# ML RISK PREDICTION
# ==================================================
from ml_predictor import predict_risk


@app.get("/ml/predict/{student_id}")
def ml_predict(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Get all subjects → topics for this student
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

    # Sort by highest risk first
    predictions.sort(key=lambda x: x["risk_probability"], reverse=True)

    at_risk_count = sum(1 for p in predictions if p["at_risk"])

    return {
        "student_id": student_id,
        "student_name": student.name,
        "total_topics": len(predictions),
        "at_risk_topics": at_risk_count,
        "predictions": predictions,
    }