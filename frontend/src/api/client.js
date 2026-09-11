import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000",
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