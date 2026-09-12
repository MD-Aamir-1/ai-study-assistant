import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getRecommendationsList,
  generateRecommendations,
  completeRecommendation,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  Sparkles, RefreshCw, Clock, BookOpen, HelpCircle,
  Eye, PenTool, Check, TrendingUp, TrendingDown, Minus, Lightbulb,
} from "lucide-react";
import "./Recommendations.css";

export default function Recommendations() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.student_id) return;
    loadRecs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.student_id]);

  const loadRecs = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getRecommendationsList(user.student_id);
      setData(res.data);
    } catch {
      setError("Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError("");
    try {
      await generateRecommendations(user.student_id, true);
      await loadRecs();
    } catch (err) {
      setError(err.response?.data?.detail || "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  };

  const handleComplete = async (recId) => {
    try {
      await completeRecommendation(recId, user.student_id);
      await loadRecs();
    } catch {
      setError("Could not mark complete");
    }
  };

  const activityIcon = (type) => {
    if (type === "read") return <BookOpen size={14} />;
    if (type === "practice") return <PenTool size={14} />;
    if (type === "quiz") return <HelpCircle size={14} />;
    if (type === "revise") return <Eye size={14} />;
    return <Sparkles size={14} />;
  };

  const trendIcon = (t) => {
    if (t === "improving") return <TrendingUp size={11} />;
    if (t === "declining") return <TrendingDown size={11} />;
    return <Minus size={11} />;
  };

  const priorityClass = (p) => {
    if (p >= 75) return "prio-critical";
    if (p >= 55) return "prio-high";
    if (p >= 35) return "prio-medium";
    return "prio-low";
  };

  const priorityLabel = (p) => {
    if (p >= 75) return "Critical";
    if (p >= 55) return "High";
    if (p >= 35) return "Medium";
    return "Low";
  };

  return (
    <div className="recs-page">
      <div className="recs-header">
        <div>
          <h1 className="recs-title">Your Recommendations</h1>
          <p className="recs-subtitle">What to study next, why, and for how long.</p>
        </div>
        <div className="recs-controls">
          <button
            className="btn-regenerate"
            onClick={handleRegenerate}
            disabled={regenerating || loading}
          >
            <RefreshCw size={14} className={regenerating ? "spin" : ""} />
            {regenerating ? "Recalculating..." : "Recalculate"}
          </button>
        </div>
      </div>

      {error && <div className="recs-error">{error}</div>}
      {loading && <p className="recs-muted">Loading recommendations...</p>}

      {data && data.total === 0 && (
        <div className="recs-empty">
          <Lightbulb size={40} />
          <p>No recommendations yet.</p>
          <p className="recs-empty-hint">
            Take a test on any topic to get personalized suggestions.
          </p>
        </div>
      )}

      {data && data.total > 0 && (
        <>
          <div className="recs-summary">
            <div className="recs-summary-item">
              <Sparkles size={16} />
              <div>
                <div className="recs-summary-label">Recommended items</div>
                <div className="recs-summary-value">{data.total}</div>
              </div>
            </div>
            <div className="recs-summary-item">
              <Clock size={16} />
              <div>
                <div className="recs-summary-label">Total suggested time</div>
                <div className="recs-summary-value">{data.total_minutes} min</div>
              </div>
            </div>
          </div>

          <div className="recs-list">
            {data.recommendations.map((r, idx) => (
              <div key={r.id} className="rec-card">
                <div className="rec-card-top">
                  <div className="rec-rank">#{idx + 1}</div>
                  <span className={`prio-badge ${priorityClass(r.priority)}`}>
                    {priorityLabel(r.priority)} · {Math.round(r.priority)}
                  </span>
                </div>
                <h3 className="rec-concept">{r.concept_name}</h3>
                <div className="rec-topic">{r.subject_name} → {r.topic_name}</div>
                <div className="rec-scores">
                  <div className="rec-score-item">
                    <div className="rec-score-label">Score</div>
                    <div className="rec-score-value">{Math.round(r.score)}%</div>
                  </div>
                  <div className="rec-score-item">
                    <div className="rec-score-label">Trend</div>
                    <div className={`rec-trend trend-${r.trend}`}>
                      {trendIcon(r.trend)} {r.trend}
                    </div>
                  </div>
                  <div className="rec-score-item">
                    <div className="rec-score-label">Importance</div>
                    <div className="rec-score-value">{r.importance}/5</div>
                  </div>
                </div>
                <div className="rec-reason">💡 {r.reason}</div>
                <div className="rec-activity">
                  <span className="rec-activity-chip">
                    {activityIcon(r.activity_type)}{r.activity_type}
                  </span>
                  <span className="rec-activity-chip">
                    <Clock size={14} /> {r.suggested_minutes} min
                  </span>
                </div>
                <div className="rec-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => navigate(`/topic/${r.topic_id}`)}
                  >
                    Study Topic
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => handleComplete(r.id)}
                  >
                    <Check size={14} /> Mark Done
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}