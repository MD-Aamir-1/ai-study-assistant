import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getChatModels,
  listConversations,
  createConversation,
  getConversation,
  updateConversation,
  deleteConversation,
  sendMessageFeedback,
  deleteMessage,
  streamChatMessage,
} from "../api/client";
import ChatMessageView from "../components/ChatMessageView";
import useVoiceInput from "../hooks/useVoiceInput";
import useVoiceOutput from "../hooks/useVoiceOutput";
import {
  Plus,
  Search,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
  Pin,
  Send,
  Square,
  Sparkles,
  ChevronDown,
  Menu,
  X,
  Loader2,
  Code2,
  FileText,
  Globe,
  Lightbulb,
  ListChecks,
  PenTool,
  Mic,
  MicOff,
} from "lucide-react";
import "./AITutor.css";

const DEFAULT_MODEL = "nova-balanced";

const SUGGESTIONS = [
  { icon: Lightbulb, label: "Explain a concept", prompt: "Explain quantum computing in simple terms." },
  { icon: Code2, label: "Write some code", prompt: "Write a Python function that reverses a string." },
  { icon: FileText, label: "Draft something", prompt: "Write a professional email asking for a meeting." },
  { icon: Globe, label: "Research a topic", prompt: "What are the latest trends in AI for 2025?" },
  { icon: ListChecks, label: "Create a plan", prompt: "Give me a 7-day plan to learn Python." },
  { icon: PenTool, label: "Brainstorm ideas", prompt: "Give me 10 side project ideas for a CS student." },
];

export default function AITutor() {
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTimer, setSearchTimer] = useState(null);
  const [menuConvId, setMenuConvId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const abortRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // ---------- Voice input ----------
  const voiceInput = useVoiceInput({
    onResult: (text) => {
      // Append recognized text to the current input
      setInput((prev) => (prev ? `${prev} ${text}` : text));
      // Focus the textarea so user can hit Enter
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
  });

  // ---------- Voice output ----------
  const voiceOutput = useVoiceOutput();

  // ---------- Load models ----------
  useEffect(() => {
    getChatModels()
      .then((res) => setModels(res.data.models || []))
      .catch(() => {});
  }, []);

  // ---------- Load conversations ----------
  useEffect(() => {
    if (!user?.student_id) return;
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.student_id]);

  const loadConversations = async (q = "") => {
    setLoading(true);
    try {
      const res = await listConversations(user.student_id, q);
      setConversations(res.data.conversations || []);
    } catch {
      setError("Could not load conversations.");
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!user?.student_id) return;
    if (searchTimer) clearTimeout(searchTimer);
    const t = setTimeout(() => loadConversations(searchQuery), 350);
    setSearchTimer(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // ---------- Load a conversation ----------
  const openConversation = async (convId) => {
    setActiveConvId(convId);
    setSidebarOpen(false);
    setError("");
    // Stop any ongoing speech
    voiceOutput.stop();
    try {
      const res = await getConversation(convId, user.student_id);
      setMessages(res.data.messages || []);
      setSelectedModel(res.data.model || DEFAULT_MODEL);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, title: res.data.title } : c
        )
      );
    } catch {
      setError("Could not load this conversation.");
    }
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setInput("");
    setError("");
    setSidebarOpen(false);
    voiceOutput.stop();
  };

  const ensureConversation = async () => {
    if (activeConvId) return activeConvId;
    const res = await createConversation(user.student_id, "New chat", selectedModel);
    setActiveConvId(res.data.id);
    setConversations((prev) => [
      {
        id: res.data.id,
        title: res.data.title,
        model: res.data.model,
        pinned: false,
        preview: "",
        updated_at: res.data.created_at,
      },
      ...prev,
    ]);
    return res.data.id;
  };

  // ---------- Send message ----------
  const sendMessage = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || streaming) return;

    setError("");
    setInput("");
    voiceOutput.stop();

    const tempUserId = `temp-${Date.now()}`;
    const tempAssistantId = `temp-a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content: text, feedback: "" },
      { id: tempAssistantId, role: "assistant", content: "", feedback: "" },
    ]);

    setStreaming(true);

    let convId;
    try {
      convId = await ensureConversation();
    } catch {
      setError("Could not create conversation.");
      setStreaming(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    let streamedText = "";

    try {
      await streamChatMessage(
        convId,
        user.student_id,
        text,
        selectedModel,
        {
          user_message_id: (data) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempUserId ? { ...m, id: data.id } : m
              )
            );
          },
          title: (data) => {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === convId ? { ...c, title: data.title } : c
              )
            );
          },
          delta: (data) => {
            streamedText += data.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? { ...m, content: streamedText }
                  : m
              )
            );
            messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
          },
          done: (data) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? { ...m, id: data.message_id || m.id }
                  : m
              )
            );
          },
          error: (data) => {
            setError(data.message || "Streaming failed.");
          },
        },
        controller.signal
      );
    } catch (err) {
      if (err.name !== "AbortError") {
        setError("Connection lost while streaming.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      loadConversations(searchQuery);
    }
  };

  const stopStreaming = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStreaming(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  // ---------- Regenerate ----------
  const handleRegenerate = async (assistantMsgId) => {
    if (streaming) return;
    const idx = messages.findIndex((m) => m.id === assistantMsgId);
    if (idx < 1) return;
    let userIdx = -1;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userIdx = i;
        break;
      }
    }
    if (userIdx === -1) return;
    const userText = messages[userIdx].content;
    const newMessages = messages.slice(0, idx);
    setMessages(newMessages);
    await sendMessage(userText);
  };

  // ---------- Edit & resend ----------
  const handleEditMessage = async (msgId, newContent) => {
    if (streaming) return;
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx === -1) return;
    const newMessages = messages.slice(0, idx);
    setMessages(newMessages);
    await sendMessage(newContent);
  };

  // ---------- Feedback ----------
  const handleFeedback = async (msgId, feedback) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedback } : m))
    );
    try {
      await sendMessageFeedback(msgId, user.student_id, feedback);
    } catch {
      // silent
    }
  };

  // ---------- Delete message ----------
  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await deleteMessage(msgId, user.student_id);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch {
      setError("Could not delete message.");
    }
  };

  // ---------- Rename conversation ----------
  const startRename = (conv) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title);
    setMenuConvId(null);
  };

  const submitRename = async (convId) => {
    const newTitle = renameValue.trim();
    setRenamingId(null);
    if (!newTitle) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, title: newTitle } : c))
    );
    try {
      await updateConversation(convId, user.student_id, { title: newTitle });
    } catch {
      setError("Could not rename.");
    }
  };

  // ---------- Toggle pin ----------
  const togglePin = async (conv) => {
    const newVal = !conv.pinned;
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, pinned: newVal } : c))
    );
    setMenuConvId(null);
    try {
      await updateConversation(conv.id, user.student_id, { pinned: newVal });
      loadConversations(searchQuery);
    } catch {
      setError("Could not pin.");
    }
  };

  // ---------- Delete conversation ----------
  const handleDeleteConversation = async (conv) => {
    setMenuConvId(null);
    if (!window.confirm(`Delete "${conv.title}"? This cannot be undone.`)) return;
    try {
      await deleteConversation(conv.id, user.student_id);
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      if (activeConvId === conv.id) {
        setActiveConvId(null);
        setMessages([]);
      }
    } catch {
      setError("Could not delete conversation.");
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handler = () => setMenuConvId(null);
    if (menuConvId) {
      document.addEventListener("click", handler);
      return () => document.removeEventListener("click", handler);
    }
  }, [menuConvId]);

  const currentModel = models.find((m) => m.id === selectedModel);

  // ==================================================
  // RENDER
  // ==================================================
  return (
    <div className="nova-layout">
      {/* SIDEBAR */}
      <aside className={`nova-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="nova-sidebar-head">
          <div className="nova-brand">
            <div className="nova-brand-mark">N</div>
            <span className="nova-brand-text">NovaAI</span>
          </div>
          <button
            type="button"
            className="nova-icon-btn nova-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <button type="button" className="nova-new-chat" onClick={startNewChat}>
          <Plus size={16} />
          <span>New chat</span>
        </button>

        <div className="nova-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="nova-conv-list">
          {loading && conversations.length === 0 && (
            <div className="nova-conv-empty">
              <Loader2 size={16} className="spin" />
            </div>
          )}

          {!loading && conversations.length === 0 && (
            <div className="nova-conv-empty-text">
              {searchQuery ? "No matches" : "No conversations yet"}
            </div>
          )}

          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`nova-conv-item ${
                conv.id === activeConvId ? "active" : ""
              }`}
              onClick={() => openConversation(conv.id)}
            >
              {renamingId === conv.id ? (
                <input
                  type="text"
                  className="nova-rename-input"
                  value={renameValue}
                  autoFocus
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => submitRename(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitRename(conv.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <MessageSquare size={14} className="nova-conv-icon" />
                  <div className="nova-conv-body">
                    <div className="nova-conv-title">
                      {conv.pinned && <Pin size={11} className="pin-icon" />}
                      {conv.title}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="nova-conv-menu-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuConvId(menuConvId === conv.id ? null : conv.id);
                    }}
                    aria-label="Conversation options"
                  >
                    <MoreHorizontal size={14} />
                  </button>

                  {menuConvId === conv.id && (
                    <div
                      className="nova-conv-menu"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button type="button" onClick={() => startRename(conv)}>
                        <Pencil size={12} /> Rename
                      </button>
                      <button type="button" onClick={() => togglePin(conv)}>
                        <Pin size={12} /> {conv.pinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDeleteConversation(conv)}
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <div className="nova-sidebar-foot">
          <div className="nova-user">
            <div className="nova-user-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="You" />
              ) : (
                <span>{user?.name?.charAt(0)?.toUpperCase() || "U"}</span>
              )}
            </div>
            <div className="nova-user-meta">
              <div className="nova-user-name">{user?.name || "You"}</div>
              <div className="nova-user-sub">Free plan</div>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="nova-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* MAIN */}
      <main className="nova-main">
        <header className="nova-topbar">
          <button
            type="button"
            className="nova-icon-btn nova-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>

          <div className="nova-model-selector">
            <Sparkles size={14} />
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="nova-chev" />
          </div>

          <div className="nova-topbar-actions">
            <button
              type="button"
              className="nova-icon-btn"
              onClick={startNewChat}
              title="New chat"
            >
              <Plus size={16} />
            </button>
          </div>
        </header>

        <div className="nova-content">
          {error && (
            <div className="nova-error">
              <span>{error}</span>
              <button type="button" onClick={() => setError("")}>
                <X size={14} />
              </button>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="nova-welcome">
              <div className="nova-welcome-mark">N</div>
              <h1 className="nova-welcome-title">How can I help you?</h1>
              <p className="nova-welcome-sub">
                {currentModel?.description || "Ask anything."}
              </p>

              <div className="nova-suggestions">
                {SUGGESTIONS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      className="nova-sugg"
                      onClick={() => sendMessage(s.prompt)}
                    >
                      <Icon size={16} />
                      <div className="nova-sugg-body">
                        <div className="nova-sugg-label">{s.label}</div>
                        <div className="nova-sugg-prompt">{s.prompt}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="nova-messages">
              {messages.map((m) => (
                <ChatMessageView
                  key={m.id}
                  message={m}
                  isStreaming={
                    streaming && m.id === messages[messages.length - 1]?.id
                  }
                  onRegenerate={handleRegenerate}
                  onEdit={handleEditMessage}
                  onFeedback={handleFeedback}
                  onDelete={handleDeleteMessage}
                  onSpeak={voiceOutput.supported ? voiceOutput.speak : undefined}
                  isSpeaking={voiceOutput.speakingId === m.id}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="nova-composer-wrap">
          <div className="nova-composer">
            {voiceInput.supported && (
              <button
                type="button"
                className={`nova-mic-btn ${voiceInput.listening ? "listening" : ""}`}
                onClick={voiceInput.toggle}
                title={voiceInput.listening ? "Stop listening" : "Speak"}
                disabled={streaming}
              >
                {voiceInput.listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                voiceInput.listening
                  ? "Listening..."
                  : "Message NovaAI..."
              }
              rows={1}
              disabled={streaming}
            />

            {streaming ? (
              <button
                type="button"
                className="nova-send-btn nova-stop-btn"
                onClick={stopStreaming}
                title="Stop generating"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                className="nova-send-btn"
                onClick={() => sendMessage()}
                disabled={!input.trim()}
                title="Send"
              >
                <Send size={16} />
              </button>
            )}
          </div>

          {voiceInput.listening && voiceInput.interim && (
            <div className="nova-voice-preview">
              <Mic size={12} /> {voiceInput.interim}
            </div>
          )}

          {voiceInput.error && (
            <p className="nova-composer-hint nova-composer-hint-error">
              {voiceInput.error}
            </p>
          )}

          <p className="nova-composer-hint">
            NovaAI can make mistakes. Check important information.
          </p>
        </div>
      </main>
    </div>
  );
}