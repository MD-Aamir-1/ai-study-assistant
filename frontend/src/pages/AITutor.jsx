import { useEffect, useRef, useState } from "react";
import { askAITutor } from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./AITutor.css";

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
    if (!q || !user?.student_id) return;

    setError("");
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);

    try {
      const res = await askAITutor(user.student_id, q);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.data.answer,
          context: res.data.context_concepts,
        },
      ]);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "AI Tutor failed. Check the backend logs."
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

  const examplePrompts = [
    "Explain overfitting in simple terms",
    "Give me an example of DBMS normalization",
    "Quiz me on classification",
  ];

  return (
    <div className="tutor-page">
      <div className="tutor-header">
        <div>
          <h1 className="tutor-title">🤖 AI Tutor</h1>
          <p className="tutor-subtitle">
            Ask anything about your studies. The tutor knows your weak concepts.
          </p>
        </div>
      </div>

      {error && <div className="tutor-error">{error}</div>}

      <div className="chat-window">
        {messages.length === 0 && (
          <div className="empty-chat">
            <p className="empty-title">
              Ask anything about your studies. The tutor knows your weak concepts.
            </p>
            <div className="prompts">
              {examplePrompts.map((p) => (
                <button
                  key={p}
                  className="prompt-chip"
                  onClick={() => setInput(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            <div className="bubble-label">
              {m.role === "user" ? "You" : "🤖 AI Tutor"}
            </div>
            <div className="bubble-content">{m.content}</div>
            {m.role === "assistant" && m.context?.length > 0 && (
              <div className="context-note">
                🧠 Aware of your weak concepts: {m.context.join(", ")}
              </div>
            )}
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