import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDashboardAnalytics,
  getRecommendationsList,
  searchTopic,
  getTopicFull,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCachedFetch } from "../hooks/useCachedFetch";
import {
  Target,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import "./Dashboard.css";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ---------- Cached fetches (instant load + manual refresh) ----------
  const {
    data: analyticsData,
    loading,
    error,
    refreshing,
    refresh,
  } = useCachedFetch(
    user?.student_id ? `dash_analytics_${user.student_id}` : "dash_analytics_none",
    async () => {
      if (!user?.student_id) return null;
      const res = await getDashboardAnalytics(user.student_id);
      return res.data;
    }
  );

  const { data: recsData } = useCachedFetch(
    user?.student_id ? `dash_recs_${user.student_id}` : "dash_recs_none",
    async () => {
      if (!user?.student_id) return [];
      const res = await getRecommendationsList(user.student_id);
      return (res.data.recommendations || []).slice(0, 3);
    }
  );

  const recs = recsData || [];

  const refreshAll = () => {
    refresh();
  };

  const prefetchRec = (rec) => {
    if (!user?.student_id) return;
    searchTopic(rec.concept_name, user.student_id, "medium").catch(() => {});
  };

  const handleOpenRec = async (rec) => {
    if (!user?.student_id) return;
    try {
      const res = await searchTopic(rec.concept_name, user.student_id, "medium");
      getTopicFull(res.data.topic_id).catch(() => {});
      navigate(`/topic/${res.data.topic_id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const data = analyticsData;

  return (
    <div className="dashboard">
      <div className="dash-greeting-row">
        <div>
          <h1 className="dash-title">
            Good Morning, {user?.name || "Student"} 👋
          </h1>
          <p className="dash-subtitle">Keep going. You're doing great.</p>
        </div>

        <button
          type="button"
          className="dash-refresh-btn"
          onClick={refreshAll}
          disabled={refreshing}
          title="Refresh dashboard"
        >
          <RefreshCw size={15} className={refreshing ? "spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div className="dash-error">{error}</div>}

      {loading && !data && <p className="dash-muted">Loading dashboard...</p>}

      {data && (
        <>
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
                      <span className="dash-rec-min">{r.suggested_minutes}m</span>
                      <span className="dash-rec-activity">{r.activity_type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Your Performance</h2>
            </div>

            {(!data.subject_performance ||
              data.subject_performance.length === 0) ? (
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