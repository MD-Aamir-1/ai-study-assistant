import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { searchTopic } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  Search as SearchIcon,
  Sparkles,
  BookOpen,
  Lightbulb,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import "./Search.css";

const SUGGESTIONS = [
  "Support Vector Machine",
  "Overfitting",
  "Normalization in DBMS",
  "Recursion",
  "Dynamic Programming",
  "Gradient Descent",
  "OOP Inheritance",
  "Deadlock in OS",
  "REST API",
  "Big-O Notation",
];

export default function Search() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [debug, setDebug] = useState("");

  const autoTriggered = useRef(false);

  // ---------- URL ?q= auto-search ----------
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoTriggered.current) {
      autoTriggered.current = true;
      setQuery(q);
      setTimeout(() => performSearch(q), 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const performSearch = async (topicName) => {
    const name = (topicName ?? query).trim();

    if (!name) {
      setError("Please type something to search.");
      return;
    }
    if (!user?.student_id) {
      setError("You're not logged in. Please refresh and log in again.");
      return;
    }
    if (loading) return;

    setLoading(true);
    setError("");
    setDebug(`Searching "${name}"...`);

    try {
      const res = await searchTopic(name, user.student_id, "medium");
      setDebug(`Loading content...`);
      navigate(`/topic/${res.data.topic_id}`);
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        err.message ||
        "Search failed. Try again.";
      setError(detail);
      setDebug("");
      setLoading(false);
    }
  };

  /**
   * Single entry point — called by BOTH form submit (Enter) and button click.
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    performSearch();
  };

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

      <div className="search-box-wrap">
        {/* FORM makes both Enter and button trigger onSubmit */}
        <form className="search-box" onSubmit={handleSubmit}>
          <SearchIcon size={20} className="search-box-icon" />
          <input
            type="text"
            placeholder="e.g., Support Vector Machine, Overfitting, Dynamic Programming..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
      </div>

      {error && (
        <div className="search-error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {debug && (
        <div className="search-debug">
          <b>Status:</b> {debug}
        </div>
      )}

      <div className="search-suggestions">
        <div className="suggestions-title">
          <Lightbulb size={16} /> Try one of these
        </div>
        <div className="suggestions-grid">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="suggestion-chip"
              onClick={() => {
                setQuery(s);
                performSearch(s);
              }}
              disabled={loading}
            >
              <BookOpen size={14} /> {s}
            </button>
          ))}
        </div>
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