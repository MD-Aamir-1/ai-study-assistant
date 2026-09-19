import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  searchTopic,
  getSearchHistory,
  deleteHistoryEntry,
  clearHistory,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  Search as SearchIcon,
  Sparkles,
  Lightbulb,
  AlertTriangle,
  Loader2,
  History,
  X,
  Trash2,
  ChevronDown,
  BookOpen,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import "./Search.css";

// Broad learning fields
const FIELDS = [
  "AI",
  "Machine Learning",
  "Deep Learning",
  "Data Science",
  "Data Analytics",
  "Web Development",
  "Python",
  "Java",
  "JavaScript",
  "DSA",
  "Cloud Computing",
  "Cybersecurity",
  "DevOps",
  "Blockchain",
  "SQL",
  "Operating Systems",
  "Computer Networks",
  "NLP",
  "Computer Vision",
  "IoT",
  "UX Design",
  "Mobile App Development",
  "Game Development",
  "AR VR",
];

// Featured / popular fields get a slightly stronger style
const POPULAR = new Set([
  "AI",
  "Machine Learning",
  "Data Science",
  "Python",
  "Web Development",
  "DSA",
]);

const VISIBLE_COUNT = 12;

export default function Search() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fieldsExpanded, setFieldsExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const autoTriggered = useRef(false);
  const searchRef = useRef(null);

  // ---------- Load history ----------
  useEffect(() => {
    if (!user?.student_id) return;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.student_id]);

  // ---------- Auto-search from ?q= ----------
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoTriggered.current) {
      autoTriggered.current = true;
      setQuery(q);
      setTimeout(() => performSearch(q), 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ---------- Close suggestion dropdown on outside click ----------
  useEffect(() => {
    const onClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const loadHistory = async () => {
    try {
      const res = await getSearchHistory(user.student_id, 15);
      setHistory(res.data.history || []);
    } catch {
      setHistory([]);
    }
  };

  const performSearch = async (topicName) => {
    const name = (topicName ?? query).trim();
    if (!name || !user?.student_id || loading) return;

    setLoading(true);
    setError("");
    setShowSuggestions(false);

    try {
      const res = await searchTopic(name, user.student_id, "medium");
      navigate(`/topic/${res.data.topic_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Search failed. Try again.");
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    performSearch();
  };

  const handleFieldClick = (field) => {
    const topicName = `${field} Tutorial`;
    setQuery(topicName);
    setShowSuggestions(false);
    performSearch(topicName);
  };

  const handleDeleteEntry = async (e, entryId) => {
    e.stopPropagation();
    try {
      await deleteHistoryEntry(entryId, user.student_id);
      setHistory((prev) => prev.filter((h) => h.id !== entryId));
    } catch {
      // silent
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear all search history?")) return;
    try {
      await clearHistory(user.student_id);
      setHistory([]);
      setHistoryOpen(false);
    } catch {
      // silent
    }
  };

  const openHistoryItem = (item) => {
    navigate(`/topic/${item.topic_id}`);
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return `${diff}m ago`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  // ==================================================
  // AUTOCOMPLETE: filter FIELDS by query
  // ==================================================
  const autocompleteMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const matches = FIELDS.filter((f) => f.toLowerCase().includes(q));
    // Exclude exact match (already typed)
    const filtered = matches.filter((f) => f.toLowerCase() !== q);
    return filtered.slice(0, 6);
  }, [query]);

  // Highlighted chips: names that match current query
  const matchingChips = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return new Set();
    return new Set(
      FIELDS.filter((f) => f.toLowerCase().includes(q))
    );
  }, [query]);

  const visibleFields = fieldsExpanded ? FIELDS : FIELDS.slice(0, VISIBLE_COUNT);
  const hasMore = FIELDS.length > VISIBLE_COUNT;
  const totalFields = FIELDS.length;

  return (
    <div className="search-page">
      <div className="search-hero">
        <div className="search-hero-icon">
          <Sparkles size={28} />
        </div>
        <h1 className="search-hero-title">Learn Anything, Conceptually</h1>
        <p className="search-hero-subtitle">
          Type any topic. Get comprehensive, structured content and a
          concept-level test tailored to how you actually understand it.
        </p>
      </div>

      <div className="search-box-wrap" ref={searchRef}>
        <form className="search-box" onSubmit={handleSubmit}>
          <SearchIcon size={20} className="search-box-icon" />
          <input
            type="text"
            placeholder="Search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            autoFocus
            disabled={loading}
          />
          <button
            type="submit"
            className="search-box-btn"
            disabled={loading || !query.trim()}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="spin" /> Searching...
              </>
            ) : (
              "Search"
            )}
          </button>
        </form>

        {/* ---------- AUTOCOMPLETE DROPDOWN ---------- */}
        {showSuggestions && autocompleteMatches.length > 0 && (
          <div className="autocomplete-panel">
            {autocompleteMatches.map((f) => (
              <button
                key={f}
                type="button"
                className="autocomplete-item"
                onClick={() => {
                  setQuery(f);
                  performSearch(f);
                }}
              >
                <SearchIcon size={14} />
                <span className="autocomplete-text">{f}</span>
                <ArrowRight size={14} className="autocomplete-arrow" />
              </button>
            ))}
          </div>
        )}

        {history.length > 0 && !showSuggestions && (
          <div className="history-row">
            <button
              type="button"
              className="history-toggle"
              onClick={() => setHistoryOpen((o) => !o)}
            >
              <History size={14} />
              {historyOpen ? "Hide" : "Show"} recent searches ({history.length})
            </button>
          </div>
        )}

        {historyOpen && history.length > 0 && !showSuggestions && (
          <div className="history-panel">
            <div className="history-header">
              <span className="history-title">Recent Searches</span>
              <button
                type="button"
                className="history-clear"
                onClick={handleClearAll}
              >
                <Trash2 size={12} /> Clear all
              </button>
            </div>
            <div className="history-list">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="history-item"
                  onClick={() => openHistoryItem(h)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") openHistoryItem(h);
                  }}
                >
                  <History size={14} className="history-item-icon" />
                  <div className="history-item-body">
                    <div className="history-item-name">{h.topic_name}</div>
                    <div className="history-item-meta">
                      {h.subject_name} · {formatTime(h.searched_at)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="history-item-delete"
                    onClick={(e) => handleDeleteEntry(e, h.id)}
                    title="Remove from history"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="search-error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ---------- POPULAR FIELDS ---------- */}
      <div className="search-suggestions">
        <div className="suggestions-header">
          <div className="suggestions-title">
            <Lightbulb size={16} /> Try one of these
          </div>
          <div className="suggestions-count">
            {visibleFields.length} of {totalFields}
          </div>
        </div>

        <div className="suggestions-grid">
          {visibleFields.map((f) => {
            const isPopular = POPULAR.has(f);
            const isMatch = matchingChips.has(f);
            return (
              <button
                key={f}
                type="button"
                className={`suggestion-chip ${isPopular ? "chip-popular" : ""} ${
                  isMatch ? "chip-match" : ""
                }`}
                onClick={() => handleFieldClick(f)}
                disabled={loading}
              >
                {isPopular && <TrendingUp size={13} className="chip-icon" />}
                <span className="chip-label">{f}</span>
              </button>
            );
          })}
        </div>

        {hasMore && (
          <div className="suggestions-toggle-row">
            <button
              type="button"
              className="suggestions-toggle"
              onClick={() => setFieldsExpanded((v) => !v)}
            >
              <ChevronDown
                size={14}
                className={`suggestions-chevron ${
                  fieldsExpanded ? "flipped" : ""
                }`}
              />
              <span>{fieldsExpanded ? "Show less" : "Show all fields"}</span>
            </button>
          </div>
        )}
      </div>

      <div className="search-info-cards">
        <div className="info-card">
          <div className="info-card-icon icon-blue">
            <Sparkles size={18} />
          </div>
          <h3>AI-Generated Content</h3>
          <p>
            Comprehensive coverage: definition, intuition, examples,
            applications, common mistakes, and more.
          </p>
        </div>

        <div className="info-card">
          <div className="info-card-icon icon-purple">
            <SearchIcon size={18} />
          </div>
          <h3>Concept Extraction</h3>
          <p>
            Every topic is broken into 6–9 testable concepts — so progress is
            measured at the concept level.
          </p>
        </div>

        <div className="info-card">
          <div className="info-card-icon icon-green">
            <BookOpen size={18} />
          </div>
          <h3>Conceptual Testing</h3>
          <p>
            Take a test after studying. We pinpoint exactly which concepts you
            understand and which need revision.
          </p>
        </div>
      </div>
    </div>
  );
}