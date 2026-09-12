import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
});

// ---------------- Students ----------------
export const getStudents = () => API.get("/students");
export const getStudent = (id) => API.get(`/students/${id}`);

// ---------------- Recommendations ----------------
export const getRecommendations = (id) => API.get(`/recommendations/${id}`);

// ---------------- Study Plan ----------------
export const generateStudyPlan = (id, minutes = 120) =>
  API.post(`/generate-study-plan/${id}?daily_minutes=${minutes}`);
export const getStudyPlan = (id) => API.get(`/students/${id}/study-plan`);
export const completeStudyPlanItem = (planId) =>
  API.put(`/study-plan/${planId}/complete`);

// ---------------- Quiz ----------------
export const getTopicQuestions = (topicId) =>
  API.get(`/topics/${topicId}/questions`);
export const submitQuiz = (payload) => API.post("/quiz/submit", payload);

// ---------------- ML Predictions ----------------
export const getMLPredictions = (id) => API.get(`/ml/predict/${id}`);

export default API;
export const askAITutor = (studentId, question) =>
  API.post("/ai/ask", { student_id: studentId, question });
export const getDashboardAnalytics = (id) => API.get(`/analytics/dashboard/${id}`);
export const getEnrichedSubjects = (studentId) =>
  API.get(`/students/${studentId}/subjects/enriched`);

export const getEnrichedTopics = (studentId) =>
  API.get(`/students/${studentId}/topics/enriched`);

export const createSubject = (name, studentId) =>
  API.post("/subjects", { name, student_id: studentId });

export const createTopic = (name, difficulty, subjectId) =>
  API.post("/topics", { name, difficulty, subject_id: subjectId });

export const deleteSubject = (subjectId) => API.delete(`/subjects/${subjectId}`);
export const deleteTopic = (topicId) => API.delete(`/topics/${topicId}`);
export const getProgressAnalytics = (id) => API.get(`/analytics/progress/${id}`);
export const updateStudent = (id, updates) => API.put(`/students/${id}`, updates);
export const deleteStudent = (id) => API.delete(`/students/${id}`);
export const exportStudentData = (id) => API.get(`/students/${id}/export`);
export const generateQuiz = (topicId, numQuestions = 5) =>
  API.post("/quiz/generate", { topic_id: topicId, num_questions: numQuestions });

export const submitDynamicQuiz = (payload) =>
  API.post("/quiz/submit-dynamic", payload);