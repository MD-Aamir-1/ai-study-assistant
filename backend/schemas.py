from pydantic import BaseModel

# ---------- STUDENT ----------
class StudentCreate(BaseModel):
    name: str
    email: str
    course: str

class StudentResponse(BaseModel):
    id: int
    name: str
    email: str
    course: str
    class Config:
        from_attributes = True


# ---------- SUBJECT ----------
class SubjectCreate(BaseModel):
    name: str
    student_id: int

class SubjectResponse(BaseModel):
    id: int
    name: str
    student_id: int
    class Config:
        from_attributes = True


# ---------- TOPIC ----------
class TopicCreate(BaseModel):
    name: str
    difficulty: str = "medium"
    subject_id: int

class TopicResponse(BaseModel):
    id: int
    name: str
    difficulty: str
    subject_id: int
    class Config:
        from_attributes = True


# ---------- PERFORMANCE ----------
class PerformanceCreate(BaseModel):
    student_id: int
    topic_id: int
    score: float = 0.0
    attempts: int = 0

class PerformanceResponse(BaseModel):
    id: int
    student_id: int
    topic_id: int
    score: float
    attempts: int
    class Config:
        from_attributes = True


# ---------- STUDY PLAN ----------
class StudyPlanCreate(BaseModel):
    student_id: int
    topic_id: int
    date: str
    duration_minutes: int = 30
    completed: bool = False

class StudyPlanResponse(BaseModel):
    id: int
    student_id: int
    topic_id: int
    date: str
    duration_minutes: int
    completed: bool
    class Config:
        from_attributes = True


# ---------- QUIZ QUESTION ----------
class QuizQuestionCreate(BaseModel):
    topic_id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str

class QuizQuestionResponse(BaseModel):
    id: int
    topic_id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    class Config:
        from_attributes = True


# ---------- QUIZ RESULT ----------
class QuizResultCreate(BaseModel):
    student_id: int
    topic_id: int
    score: float = 0.0
    total_questions: int = 0
    date: str

class QuizResultResponse(BaseModel):
    id: int
    student_id: int
    topic_id: int
    score: float
    total_questions: int
    date: str
    class Config:
        from_attributes = True