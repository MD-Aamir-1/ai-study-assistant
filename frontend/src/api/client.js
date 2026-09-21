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

// ---------- CONCEPT DEEP-DIVE ----------
export const getConceptContent = (conceptId, force = false) =>
  API.post(`/concepts/${conceptId}/content?force=${force}`);

// ---------- RECOMMENDATIONS ----------
export const getRecommendationsList = (studentId) =>
  API.get(`/students/${studentId}/recommendations`);

export const generateRecommendations = (studentId, force = false) =>
  API.post(`/students/${studentId}/generate-recommendations?force=${force}`);

export const completeRecommendation = (recId, studentId) =>
  API.put(`/recommendations/${recId}/complete?student_id=${studentId}`);

// ---------- AI TUTOR ----------
export const askAITutor = (studentId, question, history = []) =>
  API.post("/ai/ask", {
    student_id: studentId,
    question,
    history,
  });

// ---------- FILE UPLOAD & LEARN ----------
export const extractFile = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return API.post("/files/extract", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const learnFromText = (text, instruction, studentId = null) =>
  API.post("/ai/learn-from-text", {
    text,
    instruction,
    student_id: studentId,
  });

// ---------- NOTIFICATIONS ----------
export const getNotifications = (studentId) =>
  API.get(`/notifications/${studentId}`);

// ---------- SEARCH HISTORY ----------
export const getSearchHistory = (studentId, limit = 20) =>
  API.get(`/students/${studentId}/search-history?limit=${limit}`);

export const deleteHistoryEntry = (entryId, studentId) =>
  API.delete(`/search-history/${entryId}?student_id=${studentId}`);

export const clearHistory = (studentId) =>
  API.delete(`/students/${studentId}/search-history`);
export const getProfileStats = (studentId) =>
  API.get(`/students/${studentId}/profile-stats`);
// ---------- FLASHCARDS ----------
export const generateFlashcards = (topicId, numCards = 10, force = false) =>
  API.post("/flashcards/generate", {
    topic_id: topicId,
    num_cards: numCards,
    force,
  });
// ---------- ANALYTICS ----------
export const getAnalyticsTimeline = (studentId, days = 30) =>
  API.get(`/analytics/timeline/${studentId}?days=${days}`);
// ---------- NOVAAI CHAT ----------
export const getChatModels = () => API.get("/chat/models");

export const listConversations = (studentId, q = "") =>
  API.get(`/chat/conversations?student_id=${studentId}&q=${encodeURIComponent(q)}`);

export const createConversation = (studentId, title = "New chat", model = "nova-balanced") =>
  API.post("/chat/conversations", { student_id: studentId, title, model });

export const getConversation = (convId, studentId) =>
  API.get(`/chat/conversations/${convId}?student_id=${studentId}`);

export const updateConversation = (convId, studentId, updates) =>
  API.patch(`/chat/conversations/${convId}?student_id=${studentId}`, updates);

export const deleteConversation = (convId, studentId) =>
  API.delete(`/chat/conversations/${convId}?student_id=${studentId}`);

export const sendMessageFeedback = (msgId, studentId, feedback) =>
  API.patch(`/chat/messages/${msgId}/feedback`, {
    student_id: studentId,
    feedback,
  });

export const deleteMessage = (msgId, studentId) =>
  API.delete(`/chat/messages/${msgId}?student_id=${studentId}`);

/** Stream a chat message via fetch + SSE. Returns an abort controller. */
export const streamChatMessage = (
  convId,
  studentId,
  content,
  model,
  handlers,
  signal
) => {
  const API_BASE =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  return fetch(`${API_BASE}/chat/conversations/${convId}/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      student_id: studentId,
      content,
      model,
    }),
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop();

      for (const part of parts) {
        if (!part.startsWith("data: ")) continue;
        const data = part.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          handlers?.[json.type]?.(json);
        } catch {
          // ignore malformed chunk
        }
      }
    }
  });
};
// ---------- RAG / ATTACHMENTS ----------
export const uploadChatAttachment = (convId, studentId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return API.post(
    `/chat/conversations/${convId}/attachments?student_id=${studentId}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
};

export const listChatAttachments = (convId, studentId) =>
  API.get(`/chat/conversations/${convId}/attachments?student_id=${studentId}`);

export const deleteChatAttachment = (attachmentId, studentId) =>
  API.delete(`/chat/attachments/${attachmentId}?student_id=${studentId}`);
export default API;