import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
});

// ==================================================
// STUDENTS
// ==================================================
export const getStudents = () => API.get("/students");
export const getStudent = (id) => API.get(`/students/${id}`);
export const updateStudent = (id, updates) => API.put(`/students/${id}`, updates);
export const deleteStudent = (id) => API.delete(`/students/${id}`);
export const exportStudentData = (id) => API.get(`/students/${id}/export`);

// ==================================================
// RECOMMENDATIONS & STUDY PLAN
// ==================================================
export const getRecommendations = (id) => API.get(`/recommendations/${id}`);
export const generateStudyPlan = (id, minutes = 120) =>
  API.post(`/generate-study-plan/${id}?daily_minutes=${minutes}`);
export const getStudyPlan = (id) => API.get(`/students/${id}/study-plan`);
export const completeStudyPlanItem = (planId) =>
  API.put(`/study-plan/${planId}/complete`);

// ==================================================
// SUBJECTS
// ==================================================
export const getEnrichedSubjects = (studentId) =>
  API.get(`/students/${studentId}/subjects/enriched`);
export const createSubject = (name, studentId) =>
  API.post("/subjects", { name, student_id: studentId });
export const deleteSubject = (subjectId) => API.delete(`/subjects/${subjectId}`);

// ==================================================
// TOPICS
// ==================================================
export const getEnrichedTopics = (studentId) =>
  API.get(`/students/${studentId}/topics/enriched`);
export const createTopic = (name, difficulty, subjectId) =>
  API.post("/topics", { name, difficulty, subject_id: subjectId });
export const deleteTopic = (topicId) => API.delete(`/topics/${topicId}`);

// ==================================================
// QUIZ (legacy — kept for compatibility)
// ==================================================
export const getTopicQuestions = (topicId) =>
  API.get(`/topics/${topicId}/questions`);
export const submitQuiz = (payload) => API.post("/quiz/submit", payload);

// ==================================================
// QUIZ (dynamic AI-generated)
// ==================================================
export const generateQuiz = (topicId, numQuestions = 5) =>
  API.post("/quiz/generate", { topic_id: topicId, num_questions: numQuestions });
export const submitDynamicQuiz = (payload) =>
  API.post("/quiz/submit-dynamic", payload);

// ==================================================
// AI TUTOR
// ==================================================
export const askAITutor = (studentId, question) =>
  API.post("/ai/ask", { student_id: studentId, question });

// ==================================================
// ML PREDICTIONS
// ==================================================
export const getMLPredictions = (id) => API.get(`/ml/predict/${id}`);

// ==================================================
// DASHBOARD & PROGRESS ANALYTICS
// ==================================================
export const getDashboardAnalytics = (id) =>
  API.get(`/analytics/dashboard/${id}`);
export const getProgressAnalytics = (id) =>
  API.get(`/analytics/progress/${id}`);

// ==================================================
// PHASE B — SEARCH, CONTENT & CONCEPTS
// ==================================================
export const searchTopic = (topicName, studentId, difficulty = "medium") =>
  API.post("/topics/search-or-create", {
    topic_name: topicName,
    student_id: studentId,
    difficulty,
  });

export const getTopicFull = (topicId) => API.get(`/topics/${topicId}/full`);
export const getTopicContent = (topicId) =>
  API.get(`/topics/${topicId}/content`);
export const getTopicConcepts = (topicId) =>
  API.get(`/topics/${topicId}/concepts`);
export const regenerateContent = (topicId) =>
  API.post(`/topics/${topicId}/generate-content?force=true`);
export const generateTest = (topicId, numQuestions = 8) =>
  API.post("/tests/generate", { topic_id: topicId, num_questions: numQuestions });

export const submitTest = (studentId, answers, sessionId = null) =>
  API.post("/tests/submit", {
    student_id: studentId,
    answers,
    session_id: sessionId,
  });

export const getStudentConcepts = (studentId) =>
  API.get(`/students/${studentId}/concepts`);

export const generateRecommendations = (studentId, force = false) =>
  API.post(`/students/${studentId}/generate-recommendations?force=${force}`);

export const getRecommendationsList = (studentId) =>
  API.get(`/students/${studentId}/recommendations`);

export const completeRecommendation = (recId, studentId) =>
  API.put(`/recommendations/${recId}/complete?student_id=${studentId}`);

export default API;
