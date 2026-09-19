import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDashboardAnalytics,
  getRecommendationsList,
  searchTopic,
  getTopicFull,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  Target,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import "./Dashboard.css";

const CACHE_KEY = "dashboard_cache_v1";
const RECS_CACHE_KEY = "dashboard_recs_cache_v1";
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingRecId, setOpeningRecId] = useState(null);

  // ==================================================
  // Instant load from cache, then silent refresh
  // ==================================================
  useEffect(() => {
    if (!user?.student_id) return;

    // ---- Step 1: Instant from cache ----
    let hasCache = false;
    try {
      const cachedData = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      const cachedRecs = JSON.parse(
        localStorage.getItem(RECS_CACHE_KEY) || "null"
      );

      if (cachedData && cachedData.student_id === user.student_id) {
        setData(cachedData.data);
        hasCache = true;
        setLoading(false); // ← Show content immediately
      }

      if (cachedRecs && cachedRecs.student_id === user.student_id) {
        setRecs(cachedRecs.data || []);
      }
    } catch {
      // ignore cache errors
    }

    // ---- Step 2: Refresh in background ----
    refreshAll(!hasCache); // pass true = show spinner on first ever load

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.student_id]);

  const refreshAll = async (showLoading = false) => {
    if (!user?.student_id) return;

    if (showLoading) setLoading(true);
    setError("");

    // Fetch both in parallel — much faster than sequential
    const [analyticsResult, recsResult] = await Promise.allSettled([
      getDashboardAnalytics(user.student_id),
      getRecommendationsList(user.student_id),
    ]);

    if (analyticsResult.status === "fulfilled") {
      setData(analyticsResult.value.data);
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            student_id: user.student_id,
            data: analyticsResult.value.data,
            fetchedAt: Date.now(),
          })
        );
      } catch {
        // ignore storage errors
      }
    } else if (!data) {
      setError("Failed to load dashboard data");
    }

    if (recsResult.status === "fulfilled") {
      const topRecs = recsResult.value.data.recommendations.slice(0, 3);
      setRecs(topRecs);
      try {
        localStorage.setItem(
          RECS_CACHE_KEY,
          JSON.stringify({
            student_id: user.student_id,
            data: topRecs,
            fetchedAt: Date.now(),
          })
        );
      } catch {
        // ignore storage errors
      }
    }

    setLoading(false);
  };

  // ==================================================
  // Recommendation click handler
  // ==================================================
  const prefetchRec = (rec) => {
    if (!user?.student_id) return;
    searchTopic(rec.concept_name, user.student_id, "medium").catch(() => {});
  };

  const handleOpenRec = async (rec) => {
    if (!user?.student_id || openingRecId) return;
    setOpeningRecId(rec.id);
    try {
      const res = await searchTopic(rec.concept_name, user.student_id, "medium");
      getTopicFull(res.data.topic_id).catch(() => {});
      navigate(`/topic/${res.data.topic_id}`);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
          "Could not open this topic. Please try again."
      );
      setOpeningRecId(null);
    }
  };

  return (
    <div className="dashboard">
      {error && <div className="dash-error">{error}</div>}

      {/* ---------- GREETING ---------- */}
      <div className="dash-greeting-row">
        <div>
          <h1 className="dash-title">
            Good Morning, {user?.name || "Student"} 👋
          </h1>
          <p className="dash-subtitle">Keep going. You're doing great.</p>
        </div>
      </div>

      {/* Show spinner ONLY on first ever load (no cache) */}
      {loading && !data && <p className="dash-muted">Loading dashboard...</p>}

      {data && (
        <>
          {/* ---------- STAT CARDS ---------- */}
          <div className="dash-stats">
            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Concepts Tested</span>
                <span className="stat-icon stat-icon-blue">
                  <Target size={16} />
                </span>
              </div>
              <div className="stat-row">
                <div className="progress-ring">
                  <svg width="56" height="56" viewBox="0 0 56 56">
                    <circle
                      cx="28"
                      cy="28"
                      r="22"
                      fill="none"
                      stroke="var(--border)"
                      strokeWidth="5"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r="22"
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${
                        data.total_concepts > 0
                          ? (data.concepts_tested / data.total_concepts) * 138.2
                          : 0
                      } 138.2`}
                      transform="rotate(-90 28 28)"
                    />
                  </svg>
                  <div className="progress-ring-text">
                    {data.total_concepts > 0
                      ? Math.round(
                          (data.concepts_tested / data.total_concepts) * 100
                        )
                      : 0}
                    %
                  </div>
                </div>
                <div className="stat-info">
                  <div className="stat-info-strong">
                    {data.concepts_tested} of {data.total_concepts}
                  </div>
                  <div className="stat-info-muted">concepts tested</div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Average Score</span>
                <span className="stat-icon stat-icon-green">
                  <TrendingUp size={16} />
                </span>
              </div>
              <div className="stat-value">{data.avg_score}%</div>
              <div className="stat-info-muted">
                across {data.concepts_tested} concept
                {data.concepts_tested === 1 ? "" : "s"}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Strong Concepts</span>
                <span className="stat-icon stat-icon-green">
                  <CheckCircle2 size={16} />
                </span>
              </div>
              <div className="stat-value stat-ok">
                {data.strong_concepts}
              </div>
              <div className="stat-info-muted">scoring ≥ 75%</div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Weak Concepts</span>
                <span className="stat-icon stat-icon-orange">
                  <AlertTriangle size={16} />
                </span>
              </div>
              <div className="stat-value stat-risk">
                {data.weak_concepts}
              </div>
              <div className="stat-info-muted">need attention</div>
            </div>
          </div>

          {/* ---------- RECOMMENDED FOR YOU ---------- */}
          {recs.length > 0 && (
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">🎯 Recommended for You</h2>
                <a href="/recommendations" className="panel-link">
                  View All →
                </a>
              </div>
              <div className="dash-recs">
                {recs.map((r, i) => (
                  <div
                    key={r.id}
                    className="dash-rec-item dash-rec-clickable"
                    onClick={() => handleOpenRec(r)}
                    onMouseEnter={() => prefetchRec(r)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleOpenRec(r);
                      }
                    }}
                  >
                    <div className="dash-rec-rank">{i + 1}</div>
                    <div className="dash-rec-body">
                      <div className="dash-rec-name">{r.concept_name}</div>
                      <div className="dash-rec-reason">{r.reason}</div>
                    </div>
                    <div className="dash-rec-meta">
                      {openingRecId === r.id ? (
                        <span className="dash-rec-opening">Opening...</span>
                      ) : (
                        <>
                          <span className="dash-rec-min">
                            {r.suggested_minutes}m
                          </span>
                          <span className="dash-rec-activity">
                            {r.activity_type}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---------- YOUR PERFORMANCE ---------- */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Your Performance</h2>
            </div>

            {data.subject_performance.length === 0 ? (
              <p className="dash-muted">No subjects yet.</p>
            ) : (
              <div className="perf-list">
                {data.subject_performance.map((s) => (
                  <div key={s.subject_name} className="perf-item">
                    <div className="perf-item-header">
                      <span className="perf-name">{s.subject_name}</span>
                      <span className="perf-score">{s.avg_score}%</span>
                    </div>
                    <div className="perf-bar">
                      <div
                        className="perf-fill"
                        style={{ width: `${s.avg_score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---------- AI RECOMMENDATION ---------- */}
          <div className="ai-reco-card">
            <div className="ai-reco-icon">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="ai-reco-label">AI Recommendation</div>
              <div className="ai-reco-text">{data.ai_recommendation}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}