import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
});

// ---------- AUTH ----------
export const loginOrRegister = (email, name = null, course = null) =>
  API.post("/auth/login", { email, name, course });

// ---------- STUDENTS ----------
export const updateStudent = (id, updates) => API.put(`/students/${id}`, updates);
export const deleteStudent = (id) => API.delete(`/students/${id}`);
export const exportStudentData = (id) => API.get(`/students/${id}/export`);

// ---------- DASHBOARD ----------
export const getDashboardAnalytics = (id) =>
  API.get(`/analytics/dashboard/${id}`);

// ---------- SEARCH & TOPIC ----------
export const searchTopic = (topicName, studentId, difficulty = "medium") =>
  API.post("/topics/search-or-create", {
    topic_name: topicName,
    student_id: studentId,
    difficulty,
  });

export const getTopicFull = (topicId) => API.get(`/topics/${topicId}/full`);
export const regenerateContent = (topicId) =>
  API.post(`/topics/${topicId}/generate-content?force=true`);

// ---------- TESTS ----------
export const generateTest = (topicId, numQuestions = 8) =>
  API.post("/tests/generate", { topic_id: topicId, num_questions: numQuestions });

export const submitTest = (studentId, answers, sessionId = null) =>
  API.post("/tests/submit", {
    student_id: studentId,
    answers,
    session_id: sessionId,
  });

// ---------- TOPICS (for dropdowns) ----------
export const getEnrichedTopics = (studentId) =>
  API.get(`/students/${studentId}/topics/enriched`);

// ---------- CONCEPT STATS ----------
export const getStudentConcepts = (studentId) =>
  API.get(`/students/${studentId}/concepts`);

// ---------- RECOMMENDATIONS ----------
export const getRecommendationsList = (studentId) =>
  API.get(`/students/${studentId}/recommendations`);

export const generateRecommendations = (studentId, force = false) =>
  API.post(`/students/${studentId}/generate-recommendations?force=${force}`);

export const completeRecommendation = (recId, studentId) =>
  API.put(`/recommendations/${recId}/complete?student_id=${studentId}`);

// ---------- AI TUTOR ----------
export const askAITutor = (studentId, question) =>
  API.post("/ai/ask", { student_id: studentId, question });

export default API;