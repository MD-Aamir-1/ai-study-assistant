import { useEffect, useState } from "react";
import { getStudents, getStudentConcepts } from "../api/client";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import "./KnowledgeGaps.css";

export default function KnowledgeGaps() {
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getStudents()
      .then((res) => {
        setStudents(res.data);
        if (res.data.length > 0) setSelectedId(res.data[0].id);
      })
      .catch(() => setError("Could not load students."));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    getStudentConcepts(selectedId)
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load concept data"))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const trendIcon = (t) => {
    if (t === "improving") return <TrendingUp size={12} />;
    if (t === "declining") return <TrendingDown size={12} />;
    return <Minus size={12} />;
  };

  const scoreClass = (score) => {
    if (score >= 75) return "gap-good";
    if (score >= 50) return "gap-mid";
    return "gap-weak";
  };

  // Flatten concepts, attach topic info
  const allConcepts = (data?.topics || []).flatMap((t) =>
    t.concepts.map((c) => ({
      ...c,
      topic_id: t.topic_id,
      topic_name: t.topic_name,
      subject_name: t.subject_name,
    }))
  );

  const filtered = allConcepts.filter((c) => {
    if (filter === "all") return true;
    if (filter === "weak") return c.score < 50;
    if (filter === "strong") return c.score >= 75;
    if (filter === "improving") return c.trend === "improving";
    if (filter === "declining") return c.trend === "declining";
    return true;
  });

  const sorted = [...filtered].sort((a, b) => a.score - b.score);

  // Summary stats
  const total = allConcepts.length;
  const weak = allConcepts.filter((c) => c.score < 50).length;
  const strong = allConcepts.filter((c) => c.score >= 75).length;
  const improving = allConcepts.filter((c) => c.trend === "improving").length;

  return (
    <div className="gaps-page">
      <div className="gaps-header">
        <div>
          <h1 className="gaps-title">Knowledge Gaps</h1>
          <p className="gaps-subtitle">
            Concept-level analysis of what you know and what you don't.
          </p>
        </div>

        <div className="gaps-controls">
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

          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Concepts</option>
            <option value="weak">🔴 Weak (&lt; 50%)</option>
            <option value="strong">🟢 Strong (≥ 75%)</option>
            <option value="improving">📈 Improving</option>
            <option value="declining">📉 Declining</option>
          </select>
        </div>
      </div>

      {error && <div className="gaps-error">{error}</div>}
      {loading && <p className="gaps-muted">Loading...</p>}

      {data && total === 0 && (
        <div className="gaps-empty">
          <Target size={40} />
          <p>No concept data yet.</p>
          <p className="gaps-empty-hint">
            Take a test to start tracking your concept mastery.
          </p>
        </div>
      )}

      {data && total > 0 && (
        <>
          {/* SUMMARY */}
          <div className="gaps-stats">
            <div className="gap-stat">
              <div className="gap-stat-icon icon-blue">
                <BookOpen size={16} />
              </div>
              <div>
                <div className="gap-stat-label">Total Concepts</div>
                <div className="gap-stat-value">{total}</div>
              </div>
            </div>

            <div className="gap-stat">
              <div className="gap-stat-icon icon-green">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div className="gap-stat-label">Strong</div>
                <div className="gap-stat-value">{strong}</div>
              </div>
            </div>

            <div className="gap-stat">
              <div className="gap-stat-icon icon-orange">
                <TrendingUp size={16} />
              </div>
              <div>
                <div className="gap-stat-label">Improving</div>
                <div className="gap-stat-value">{improving}</div>
              </div>
            </div>

            <div className="gap-stat">
              <div className="gap-stat-icon icon-red">
                <AlertTriangle size={16} />
              </div>
              <div>
                <div className="gap-stat-label">Weak</div>
                <div className="gap-stat-value">{weak}</div>
              </div>
            </div>
          </div>

          {/* LIST */}
          {sorted.length === 0 ? (
            <p className="gaps-muted">
              No concepts match this filter.
            </p>
          ) : (
            <div className="gap-list">
              {sorted.map((c) => (
                <div
                  key={`${c.topic_id}-${c.concept_id}`}
                  className="gap-item"
                >
                  <div className="gap-item-left">
                    <div className={`gap-score ${scoreClass(c.score)}`}>
                      {Math.round(c.score)}%
                    </div>
                    <div>
                      <div className="gap-name">{c.concept_name}</div>
                      <div className="gap-topic">
                        {c.subject_name} → {c.topic_name}
                      </div>
                    </div>
                  </div>

                  <div className="gap-item-right">
                    <span
                      className={`gap-trend trend-${c.trend}`}
                      title={`Trend: ${c.trend}`}
                    >
                      {trendIcon(c.trend)}
                      {c.trend}
                    </span>
                    <div className="gap-meta">
                      {c.correct}/{c.attempts} correct
                    </div>
                    <div className="gap-confidence">
                      <div className="gap-confidence-bar">
                        <div
                          className="gap-confidence-fill"
                          style={{ width: `${c.confidence * 100}%` }}
                        />
                      </div>
                      <span className="gap-confidence-label">
                        {Math.round(c.confidence * 100)}% confident
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}