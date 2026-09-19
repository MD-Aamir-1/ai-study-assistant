import { useEffect, useRef, useState } from "react";
import { askAITutor } from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./AITutor.css";

const HISTORY_LIMIT = 6; // last 3 user-assistant exchanges

export default function AITutor() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || !user?.student_id || loading) return;

    // Build history BEFORE adding the current user message
    const history = messages
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.content }));

    setError("");
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);

    try {
      const res = await askAITutor(user.student_id, q, history);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.data.answer,
        },
      ]);
    } catch (err) {
      setError(
        err.response?.data?.detail || "AI Tutor failed. Check the backend logs."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError("");
  };

  return (
    <div className="tutor-page">
      <div className="tutor-header">
        <div>
          <h1 className="tutor-title">🤖 AI Tutor</h1>
          <p className="tutor-subtitle">
            Ask anything. I remember our conversation.
          </p>
        </div>
        {messages.length > 0 && (
          <button className="tutor-clear-btn" onClick={clearChat}>
            Clear chat
          </button>
        )}
      </div>

      {error && <div className="tutor-error">{error}</div>}

      <div className="chat-window">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            <div className="bubble-label">
              {m.role === "user" ? "You" : "🤖 AI Tutor"}
            </div>
            <div className="bubble-content">{m.content}</div>
          </div>
        ))}

        {loading && (
          <div className="bubble assistant">
            <div className="bubble-label">🤖 AI Tutor</div>
            <div className="bubble-content typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="input-bar">
        <textarea
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}