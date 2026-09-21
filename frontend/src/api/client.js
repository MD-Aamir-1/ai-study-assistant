import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// ==================================================
// AUTH
// ==================================================
export const loginOrRegister = (payload) =>
  api.post("/auth/login", payload);

// ==================================================
// STUDENTS
// ==================================================
export const createStudent = (payload) => api.post("/students", payload);
export const getStudents = () => api.get("/students");
export const getStudent = (id) => api.get(`/students/${id}`);
export const updateStudent = (id, payload) => api.put(`/students/${id}`, payload);
export const deleteStudent = (id) => api.delete(`/students/${id}`);
export const exportStudentData = (id) => api.get(`/students/${id}/export`);
export const getProfileStats = (id) => api.get(`/students/${id}/profile-stats`);

// ==================================================
// SUBJECTS
// ==================================================
export const createSubject = (payload) => api.post("/subjects", payload);
export const getSubjects = () => api.get("/subjects");
export const getStudentSubjects = (studentId) =>
  api.get(`/students/${studentId}/subjects`);
export const deleteSubject = (id) => api.delete(`/subjects/${id}`);

// ==================================================
// TOPICS
// ==================================================
export const createTopic = (payload) => api.post("/topics", payload);
export const getTopics = () => api.get("/topics");
export const getSubjectTopics = (subjectId) =>
  api.get(`/subjects/${subjectId}/topics`);
export const deleteTopic = (id) => api.delete(`/topics/${id}`);
export const getEnrichedTopics = (studentId) =>
  api.get(`/students/${studentId}/topics/enriched`);

// ==================================================
// PERFORMANCE
// ==================================================
export const createPerformance = (payload) => api.post("/performance", payload);
export const getStudentPerformance = (studentId) =>
  api.get(`/students/${studentId}/performance`);
export const updatePerformance = (id, score, attempts = 1) =>
  api.put(`/performance/${id}?score=${score}&attempts=${attempts}`);

// ==================================================
// STUDY PLAN
// ==================================================
export const createStudyPlan = (payload) => api.post("/study-plan", payload);
export const getStudentStudyPlan = (studentId) =>
  api.get(`/students/${studentId}/study-plan`);
export const completeStudyPlan = (id) =>
  api.put(`/study-plan/${id}/complete`);

// ==================================================
// LEGACY QUIZ
// ==================================================
export const createQuizQuestion = (payload) =>
  api.post("/quiz/questions", payload);
export const getTopicQuestions = (topicId) =>
  api.get(`/topics/${topicId}/questions`);
export const bulkCreateQuestions = (questions) =>
  api.post("/quiz/questions/bulk", { questions });
export const createQuizResult = (payload) => api.post("/quiz/results", payload);
export const getStudentQuizResults = (studentId) =>
  api.get(`/students/${studentId}/quiz-results`);

// ==================================================
// ANALYTICS
// ==================================================
export const getDashboardAnalytics = (studentId) =>
  api.get(`/analytics/dashboard/${studentId}`);
export const getAnalyticsTimeline = (studentId, days = 30) =>
  api.get(`/analytics/timeline/${studentId}?days=${days}`);

// ==================================================
// ML PREDICTION
// ==================================================
export const getMlPredictions = (studentId) =>
  api.get(`/ml/predict/${studentId}`);

// ==================================================
// AI TUTOR (legacy)
// ==================================================
export const askAiTutor = (payload) => api.post("/ai/ask", payload);
export const learnFromText = (payload) => api.post("/ai/learn-from-text", payload);

// ==================================================
// TOPIC SEARCH + CONTENT
// ==================================================
export const searchOrCreateTopic = (payload) =>
  api.post("/topics/search-or-create", payload);
export const generateTopicContent = (topicId, force = false) =>
  api.post(`/topics/${topicId}/generate-content?force=${force}`);
export const getTopicContent = (topicId) =>
  api.get(`/topics/${topicId}/content`);
export const extractTopicConcepts = (topicId, force = false) =>
  api.post(`/topics/${topicId}/extract-concepts?force=${force}`);
export const listTopicConcepts = (topicId) =>
  api.get(`/topics/${topicId}/concepts`);
export const getTopicFull = (topicId) => api.get(`/topics/${topicId}/full`);

// ==================================================
// CONCEPT DEEP-DIVE
// ==================================================
export const getConceptContent = (conceptId, force = false) =>
  api.post(`/concepts/${conceptId}/content?force=${force}`);

// ==================================================
// TESTS
// ==================================================
export const generateTest = (payload) => api.post("/tests/generate", payload);
export const submitTest = (payload) => api.post("/tests/submit", payload);
export const getStudentConcepts = (studentId) =>
  api.get(`/students/${studentId}/concepts`);

// ==================================================
// RECOMMENDATIONS
// ==================================================
export const generateRecommendations = (studentId, force = false) =>
  api.post(`/students/${studentId}/generate-recommendations?force=${force}`);
export const listRecommendations = (studentId) =>
  api.get(`/students/${studentId}/recommendations`);
export const completeRecommendation = (recId, studentId) =>
  api.put(`/recommendations/${recId}/complete?student_id=${studentId}`);

// ==================================================
// SEARCH HISTORY
// ==================================================
export const getSearchHistory = (studentId, limit = 30) =>
  api.get(`/students/${studentId}/search-history?limit=${limit}`);
export const deleteSearchHistoryEntry = (entryId, studentId) =>
  api.delete(`/search-history/${entryId}?student_id=${studentId}`);
export const clearSearchHistory = (studentId) =>
  api.delete(`/students/${studentId}/search-history`);

// ==================================================
// FILE EXTRACTION (legacy)
// ==================================================
export const extractFile = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/files/extract", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ==================================================
// NOTIFICATIONS
// ==================================================
export const getNotifications = (studentId) =>
  api.get(`/notifications/${studentId}`);

// ==================================================
// FLASHCARDS
// ==================================================
export const generateFlashcards = (payload) =>
  api.post("/flashcards/generate", payload);

// ==================================================
// NOVAAI CHAT — Models + Conversations
// ==================================================
export const getChatModels = () => api.get("/chat/models");

export const listConversations = (studentId, q = "") =>
  api.get(`/chat/conversations?student_id=${studentId}&q=${encodeURIComponent(q)}`);

export const createConversation = (studentId, title = "New chat", model = "nova-balanced") =>
  api.post("/chat/conversations", { student_id: studentId, title, model });

export const getConversation = (convId, studentId) =>
  api.get(`/chat/conversations/${convId}?student_id=${studentId}`);

export const updateConversation = (convId, studentId, updates) =>
  api.patch(
    `/chat/conversations/${convId}?student_id=${studentId}`,
    updates
  );

export const deleteConversation = (convId, studentId) =>
  api.delete(`/chat/conversations/${convId}?student_id=${studentId}`);

export const sendMessageFeedback = (msgId, studentId, feedback) =>
  api.patch(`/chat/messages/${msgId}/feedback`, {
    student_id: studentId,
    feedback,
  });

export const deleteMessage = (msgId, studentId) =>
  api.delete(`/chat/messages/${msgId}?student_id=${studentId}`);

// ==================================================
// NOVAAI CHAT — Attachments (RAG)
// ==================================================
export const uploadChatAttachment = (convId, studentId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(
    `/chat/conversations/${convId}/attachments?student_id=${studentId}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
};

export const listChatAttachments = (convId, studentId) =>
  api.get(`/chat/conversations/${convId}/attachments?student_id=${studentId}`);

export const deleteChatAttachment = (attachmentId, studentId) =>
  api.delete(`/chat/attachments/${attachmentId}?student_id=${studentId}`);

export const getAttachmentDebug = (attachmentId) =>
  api.get(`/chat/attachments/${attachmentId}/debug`);

// ==================================================
// ALIASES (compat with older import names used across pages)
// ==================================================
export const getRecommendationsList = listRecommendations;

export const searchTopic = (topic_name, student_id, difficulty = "medium") =>
  searchOrCreateTopic({ topic_name, student_id, difficulty });

export const getAnalytics = getDashboardAnalytics;
export const getStudentStats = getProfileStats;
export const clearHistory = clearSearchHistory;
export const deleteHistoryEntry = deleteSearchHistoryEntry;

// Topic regeneration alias (TopicView.jsx uses this name)
export const regenerateContent = (topicId) =>
  generateTopicContent(topicId, true);

// Common topic/concept aliases
export const getTopic = getTopicFull;
export const getConcept = getConceptContent;
export const generateConcept = getConceptContent;
export const listConcepts = listTopicConcepts;
export const extractConcepts = extractTopicConcepts;

// Test aliases
export const startTest = generateTest;
export const finishTest = submitTest;

// Recommendation aliases
export const getRecommendations = listRecommendations;
export const markRecommendationComplete = completeRecommendation;

// Flashcard alias
export const getFlashcards = generateFlashcards;

// ==================================================
// NOVAAI CHAT — Streaming (SSE)
// ==================================================
/**
 * Stream a chat message via Server-Sent Events.
 *
 * @param {number}   convId       Conversation ID
 * @param {number}   studentId    Student ID
 * @param {string}   content      User's message text
 * @param {string}   model        Model ID (e.g. "nova-balanced")
 * @param {object}   handlers     Callbacks: { user_message_id, title, sources, web_sources, delta, done, error }
 * @param {AbortSignal} signal    Optional abort signal
 * @param {object}   options      Optional: { web_search: boolean }
 */
export async function streamChatMessage(
  convId,
  studentId,
  content,
  model,
  handlers = {},
  signal = undefined,
  options = {}
) {
  const response = await fetch(
    `${API_URL}/chat/conversations/${convId}/stream`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        content,
        model,
        web_search: options.web_search || false,
      }),
      signal,
    }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `Stream failed (${response.status}): ${errText || response.statusText}`
    );
  }

  if (!response.body) {
    throw new Error("Response has no body — streaming not supported.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const lines = part.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === "[DONE]") return;

        try {
          const data = JSON.parse(payload);
          const type = data.type;

          if (handlers[type]) {
            handlers[type](data);
          } else if (handlers.onEvent) {
            handlers.onEvent(data);
          }
        } catch (e) {
          // ignore malformed events
        }
      }
    }
  }
}

// ==================================================
// DEFAULT EXPORT
// ==================================================
export default api;