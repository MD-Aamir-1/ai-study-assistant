import { useEffect, useState } from "react";
import { getStudents, getProgressAnalytics } from "../api/client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, Clock, CheckCircle2, Flame } from "lucide-react";
import "./Progress.css";

export default function Progress() {
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
      .catch(() => setError("Could not load students."));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    getProgressAnalytics(selectedId)
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load progress"))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const pieData = data
    ? [
        { name: "Correct", value: data.quiz_accuracy.correct, color: "#10b981" },
        { name: "Wrong", value: data.quiz_accuracy.wrong, color: "#ef4444" },
      ]
    : [];

  const pieTotal = data
    ? data.quiz_accuracy.correct + data.quiz_accuracy.wrong
    : 0;
  const accuracyPct =
    pieTotal > 0 ? Math.round((data.quiz_accuracy.correct / pieTotal) * 100) : 0;

  return (
    <div className="progress-page">
      <div className="progress-header">
        <div>
          <h1 className="progress-title">Your Progress & Analytics</h1>
          <p className="progress-subtitle">
            Track your performance and identify areas for improvement.
          </p>
        </div>
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

      {error && <div className="progress-error">{error}</div>}
      {loading && <p className="progress-muted">Loading...</p>}

      {data && (
        <>
          {/* ---------- STAT CARDS ---------- */}
          <div className="progress-stats">
            <div className="prog-stat-card">
              <div className="prog-stat-icon icon-blue">
                <TrendingUp size={16} />
              </div>
              <div>
                <div className="prog-stat-label">Average Score</div>
                <div className="prog-stat-value">
                  {data.overall.avg_score}%
                </div>
              </div>
            </div>

            <div className="prog-stat-card">
              <div className="prog-stat-icon icon-green">
                <Clock size={16} />
              </div>
              <div>
                <div className="prog-stat-label">Study Hours</div>
                <div className="prog-stat-value">
                  {data.overall.study_hours}h
                </div>
              </div>
            </div>

            <div className="prog-stat-card">
              <div className="prog-stat-icon icon-purple">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div className="prog-stat-label">Tasks Completed</div>
                <div className="prog-stat-value">
                  {data.overall.tasks_completed}/{data.overall.total_tasks}
                </div>
              </div>
            </div>

            <div className="prog-stat-card">
              <div className="prog-stat-icon icon-orange">
                <Flame size={16} />
              </div>
              <div>
                <div className="prog-stat-label">Streak</div>
                <div className="prog-stat-value">
                  {data.overall.streak_days} Days
                </div>
              </div>
            </div>
          </div>

          {/* ---------- TWO COLUMN: TREND + SUBJECTS ---------- */}
          <div className="progress-columns">
            {/* Performance Trend */}
            <div className="prog-panel">
              <h2 className="prog-panel-title">Performance Trend</h2>
              <p className="prog-panel-sub">
                Your average quiz score over time
              </p>

              {data.score_trend.length < 2 ? (
                <div className="prog-empty">
                  Not enough quiz data yet. Take at least 2 quizzes
                  on different days to see a trend.
                </div>
              ) : (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={data.score_trend}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="week"
                        stroke="var(--text-muted)"
                        fontSize={11}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke="var(--text-muted)"
                        fontSize={11}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          color: "var(--text)",
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avg_score"
                        stroke="var(--primary)"
                        strokeWidth={3}
                        dot={{ r: 5, fill: "var(--primary)" }}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Subject-wise Performance */}
            <div className="prog-panel">
              <h2 className="prog-panel-title">Subject-wise Performance</h2>
              <p className="prog-panel-sub">
                Average score per subject
              </p>

              {data.subject_performance.length === 0 ? (
                <div className="prog-empty">No subjects yet.</div>
              ) : (
                <div className="subject-bars">
                  {data.subject_performance.map((s) => (
                    <div key={s.subject_name} className="subject-bar-row">
                      <div className="subject-bar-header">
                        <span>{s.subject_name}</span>
                        <b>{s.avg_score}%</b>
                      </div>
                      <div className="subject-bar-track">
                        <div
                          className="subject-bar-fill"
                          style={{ width: `${s.avg_score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ---------- TWO COLUMN: WEAKEST + QUIZ PIE ---------- */}
          <div className="progress-columns">
            {/* Weakest Topics */}
            <div className="prog-panel">
              <h2 className="prog-panel-title">Weakest Topics</h2>
              <p className="prog-panel-sub">
                Focus your time on these first
              </p>

              {data.weakest_topics.length === 0 ? (
                <div className="prog-empty">No topics yet.</div>
              ) : (
                <ul className="weak-list">
                  {data.weakest_topics.map((t) => (
                    <li key={t.id} className="weak-item">
                      <div className="weak-dot" />
                      <div className="weak-info">
                        <div className="weak-name">{t.name}</div>
                        <div className="weak-subject">{t.subject_name}</div>
                      </div>
                      <div className="weak-score">{t.score}%</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Quiz Accuracy Pie */}
            <div className="prog-panel">
              <h2 className="prog-panel-title">Quiz Accuracy</h2>
              <p className="prog-panel-sub">
                Correct vs wrong answers
              </p>

              {pieTotal === 0 ? (
                <div className="prog-empty">No quiz attempts yet.</div>
              ) : (
                <div className="pie-wrap">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          color: "var(--text)",
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="pie-legend">
                    <div className="pie-legend-item">
                      <span className="legend-dot dot-green" />
                      Correct ({data.quiz_accuracy.correct})
                    </div>
                    <div className="pie-legend-item">
                      <span className="legend-dot dot-red" />
                      Wrong ({data.quiz_accuracy.wrong})
                    </div>
                    <div className="pie-center-label">
                      <b>{accuracyPct}%</b>
                      <span>accuracy</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}