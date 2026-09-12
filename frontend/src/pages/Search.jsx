import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStudents, searchTopic } from "../api/client";
import { Search as SearchIcon, Sparkles, BookOpen, Lightbulb } from "lucide-react";
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
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getStudents()
      .then((res) => {
        setStudents(res.data);
        if (res.data.length > 0) setSelectedId(res.data[0].id);
      })
      .catch(() => setError("Could not load students."));
  }, []);

  const handleSearch = async (topicName) => {
    const name = (topicName ?? query).trim();
    if (!name || !selectedId) return;

    setLoading(true);
    setError("");

    try {
      const res = await searchTopic(name, selectedId, difficulty);
      navigate(`/topic/${res.data.topic_id}`);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Search failed. Check the backend and try again."
      );
      setLoading(false);
    }
  };

  return (
    <div className="search-page">
      {/* ---------- HERO ---------- */}
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

      {/* ---------- SEARCH BOX ---------- */}
      <div className="search-box-wrap">
        <div className="search-box">
          <SearchIcon size={20} className="search-box-icon" />
          <input
            type="text"
            placeholder="e.g., Support Vector Machine, Overfitting, Dynamic Programming..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            autoFocus
          />
          <button
            className="search-box-btn"
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="search-options">
          <label>
            <span>Student:</span>
            <select
              value={selectedId || ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.course})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Difficulty:</span>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
        </div>
      </div>

      {error && <div className="search-error">{error}</div>}

      {/* ---------- SUGGESTIONS ---------- */}
      <div className="search-suggestions">
        <div className="suggestions-title">
          <Lightbulb size={16} />
          Try one of these
        </div>
        <div className="suggestions-grid">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="suggestion-chip"
              onClick={() => {
                setQuery(s);
                handleSearch(s);
              }}
              disabled={loading}
            >
              <BookOpen size={14} />
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- INFO CARDS ---------- */}
      <div className="search-info-cards">
        <div className="info-card">
          <div className="info-card-icon icon-blue">
            <Sparkles size={18} />
          </div>
          <h3>AI-Generated Content</h3>
          <p>
            Comprehensive coverage: definition, intuition, examples,
            applications, advantages, common mistakes, and more.
          </p>
        </div>

        <div className="info-card">
          <div className="info-card-icon icon-purple">
            <SearchIcon size={18} />
          </div>
          <h3>Concept Extraction</h3>
          <p>
            Every topic is broken into 6–9 testable concepts — so progress is
            measured at the concept level, not just the topic level.
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