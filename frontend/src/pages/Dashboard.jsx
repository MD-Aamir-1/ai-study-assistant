import { useEffect, useState } from "react";
import {
  getDashboardAnalytics,
  getRecommendationsList,
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

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.student_id) return;
    setLoading(true);
    setError("");
    getDashboardAnalytics(user.student_id)
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load dashboard data"))
      .finally(() => setLoading(false));
  }, [user?.student_id]);

  useEffect(() => {
    if (!user?.student_id) return;
    getRecommendationsList(user.student_id)
      .then((res) => setRecs(res.data.recommendations.slice(0, 3)))
      .catch(() => setRecs([]));
  }, [user?.student_id]);

  return (
    <div className="dashboard">
      {error && <div className="dash-error">{error}</div>}

      {/* GREETING */}
      <div className="dash-greeting-row">
        <div>
          <h1 className="dash-title">
            Good Morning, {user?.name || "Student"} 👋
          </h1>
          <p className="dash-subtitle">Keep going. You're doing great.</p>
        </div>
      </div>

      {loading && <p className="dash-muted">Loading dashboard...</p>}

      {data && (
        <>
          {/* STAT CARDS */}
          <div className="dash-stats">
            {/* Concepts Tested */}
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

            {/* Average Score */}
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

            {/* Strong Concepts */}
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

            {/* Weak Concepts */}
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

          {/* RECOMMENDED FOR YOU */}
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
                  <div key={r.id} className="dash-rec-item">
                    <div className="dash-rec-rank">{i + 1}</div>
                    <div className="dash-rec-body">
                      <div className="dash-rec-name">{r.concept_name}</div>
                      <div className="dash-rec-reason">{r.reason}</div>
                    </div>
                    <div className="dash-rec-meta">
                      <span className="dash-rec-min">
                        {r.suggested_minutes}m
                      </span>
                      <span className="dash-rec-activity">
                        {r.activity_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* YOUR PERFORMANCE */}
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

          {/* AI RECOMMENDATION */}
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