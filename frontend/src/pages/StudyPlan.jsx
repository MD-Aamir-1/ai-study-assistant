import { useEffect, useState } from "react";
import {
  getStudents,
  generateStudyPlan,
  getStudyPlan,
  completeStudyPlanItem,
} from "../api/client";
import "./StudyPlan.css";

export default function StudyPlan() {
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [plan, setPlan] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [minutes, setMinutes] = useState(120);

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
    loadPlan();
  }, [selectedId]);

  const loadPlan = () => {
    setLoading(true);
    getStudyPlan(selectedId)
      .then((res) => setPlan(res.data))
      .catch(() => setError("Failed to load plan"))
      .finally(() => setLoading(false));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      await generateStudyPlan(selectedId, minutes);
      loadPlan();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to generate plan");
      setLoading(false);
    }
  };

  const handleComplete = async (planId) => {
    try {
      await completeStudyPlanItem(planId);
      loadPlan();
    } catch {
      setError("Failed to mark as complete");
    }
  };

  const completed = plan.filter((p) => p.completed).length;
  const totalMinutes = plan.reduce((sum, p) => sum + p.duration_minutes, 0);
  const doneMinutes = plan
    .filter((p) => p.completed)
    .reduce((sum, p) => sum + p.duration_minutes, 0);
  const progress = totalMinutes
    ? Math.round((doneMinutes / totalMinutes) * 100)
    : 0;

  return (
    <div className="plan-page">
      {error && <div className="plan-error">{error}</div>}

      <div className="plan-header">
        <div>
          <h1 className="plan-title">Your Personalized Study Plan</h1>
          <p className="plan-subtitle">
            A plan created just for you based on your performance.
          </p>
        </div>

        <div className="plan-controls">
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

          <input
            type="number"
            min="30"
            max="600"
            step="30"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="minutes-input"
          />

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Generating..." : "⚡ Generate Plan"}
          </button>
        </div>
      </div>

      <div className="plan-stats">
        <div className="plan-stat-card">
          <div className="plan-stat-label">Total Plans</div>
          <div className="plan-stat-value">{plan.length}</div>
        </div>
        <div className="plan-stat-card">
          <div className="plan-stat-label">Completed</div>
          <div className="plan-stat-value">
            {completed}/{plan.length}
          </div>
        </div>
        <div className="plan-stat-card">
          <div className="plan-stat-label">Total Time</div>
          <div className="plan-stat-value">{totalMinutes} min</div>
        </div>
        <div className="plan-stat-card">
          <div className="plan-stat-label">Progress</div>
          <div className="plan-stat-value">{progress}%</div>
        </div>
      </div>

      <h2 className="plan-section-title">📋 Your Plan</h2>

      {plan.length === 0 ? (
        <p className="plan-empty">
          No plan yet. Click "Generate Plan" to create one.
        </p>
      ) : (
        <div className="plan-list">
          {plan.map((p) => (
            <div
              key={p.id}
              className={`plan-item ${p.completed ? "done" : ""}`}
            >
              <div className="plan-item-left">
                <div className="plan-topic">Topic #{p.topic_id}</div>
                <div className="plan-meta">
                  {p.duration_minutes} min • {p.date}
                </div>
              </div>
              <button
                className="btn-complete"
                onClick={() => handleComplete(p.id)}
                disabled={p.completed}
              >
                {p.completed ? "✅ Done" : "Mark Complete"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}