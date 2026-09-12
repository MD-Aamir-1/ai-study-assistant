import { useEffect, useState } from "react";
import { getStudents, getDashboardAnalytics } from "../api/client";
import {
  BookOpen,
  Clock,
  Flame,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Circle,
} from "lucide-react";
import "./Dashboard.css";

export default function Dashboard() {
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getStudents()
      .then((res) => {
        setStudents(res.data);
        if (res.data.length > 0) setSelectedId(res.data[0].id);
      })
      .catch(() => setError("Could not load students. Is the backend running?"));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    getDashboardAnalytics(selectedId)
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load dashboard data"))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const formatMinutes = (m) => {
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min > 0 ? `${h}h ${min}m` : `${h}h`;
  };

  return (
    <div className="dashboard">
      {error && <div className="dash-error">{error}</div>}

      {/* ---------- GREETING ---------- */}
      <div className="dash-greeting-row">
        <div>
          <h1 className="dash-title">
            Good Morning, {data?.student_name || "Student"} 👋
          </h1>
          <p className="dash-subtitle">Keep going. You're doing great.</p>
        </div>
        <div className="dash-student-picker">
          <label>Student:</label>
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
        </div>
      </div>

      {loading && <p className="dash-muted">Loading dashboard...</p>}

      {data && (
        <>
          {/* ---------- STAT CARDS ---------- */}
          <div className="dash-stats">
            {/* Study Progress */}
            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Study Progress</span>
                <span className="stat-icon stat-icon-blue">
                  <TrendingUp size={16} />
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
                        (data.study_progress.percentage / 100) * 138.2
                      } 138.2`}
                      transform="rotate(-90 28 28)"
                    />
                  </svg>
                  <div className="progress-ring-text">
                    {Math.round(data.study_progress.percentage)}%
                  </div>
                </div>
                <div className="stat-info">
                  <div className="stat-info-strong">
                    {data.study_progress.completed} of {data.study_progress.total}
                  </div>
                  <div className="stat-info-muted">tasks completed</div>
                </div>
              </div>
            </div>

            {/* Study Time */}
            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Study Time Today</span>
                <span className="stat-icon stat-icon-green">
                  <Clock size={16} />
                </span>
              </div>
              <div className="stat-value">
                {formatMinutes(data.study_time_today_minutes)}
              </div>
              <div className="stat-info-muted">completed so far</div>
            </div>

            {/* Total Subjects */}
            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Total Subjects</span>
                <span className="stat-icon stat-icon-purple">
                  <BookOpen size={16} />
                </span>
              </div>
              <div className="stat-value">{data.total_subjects}</div>
              <div className="stat-info-muted">across your courses</div>
            </div>

            {/* Streak */}
            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Current Streak</span>
                <span className="stat-icon stat-icon-orange">
                  <Flame size={16} />
                </span>
              </div>
              <div className="stat-value">{data.streak_days} Days</div>
              <div className="stat-info-muted">
                {data.streak_days > 0 ? "Keep it up!" : "Start one today"}
              </div>
            </div>
          </div>

          {/* ---------- TWO COLUMN ---------- */}
          <div className="dash-columns">
            {/* Today's Study Plan */}
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Today's Study Plan</h2>
                <a href="/study-plan" className="panel-link">
                  View Full Plan →
                </a>
              </div>

              {data.today_plan.length === 0 ? (
                <p className="dash-muted">
                  No plan yet for today. Go to Study Plan and generate one.
                </p>
              ) : (
                <ul className="plan-list-dash">
                  {data.today_plan.map((p) => (
                    <li
                      key={p.plan_id}
                      className={`plan-row ${p.completed ? "done" : ""}`}
                    >
                      <div className="plan-row-left">
                        {p.completed ? (
                          <CheckCircle2 size={18} className="check-icon" />
                        ) : (
                          <Circle size={18} className="circle-icon" />
                        )}
                        <div>
                          <div className="plan-row-title">
                            {p.subject_name} → {p.topic_name}
                          </div>
                          <div className="plan-row-meta">
                            {p.duration_minutes} min · {p.difficulty}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`pill ${
                          p.completed ? "pill-done" : "pill-pending"
                        }`}
                      >
                        {p.completed ? "Done" : "Pending"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Performance */}
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Your Performance</h2>
                <a href="/progress" className="panel-link">
                  View Details →
                </a>
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