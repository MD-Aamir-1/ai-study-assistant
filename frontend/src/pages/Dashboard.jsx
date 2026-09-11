import { useEffect, useState } from "react";
import { getStudents, getRecommendations, getMLPredictions } from "../api/client";
import "./Dashboard.css";

export default function Dashboard() {
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [recs, setRecs] = useState(null);
  const [mlRisks, setMlRisks] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load students on mount
  useEffect(() => {
    getStudents()
      .then((res) => {
        setStudents(res.data);
        if (res.data.length > 0) setSelectedId(res.data[0].id);
      })
      .catch(() => setError("Could not load students. Is the backend running?"));
  }, []);

  // Load recommendations when selected student changes
  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    getRecommendations(selectedId)
      .then((res) => setRecs(res.data))
      .catch(() => setError("Failed to load recommendations"))
      .finally(() => setLoading(false));
  }, [selectedId]);

  // Load ML predictions when selected student changes
  useEffect(() => {
    if (!selectedId) return;
    getMLPredictions(selectedId)
      .then((res) => {
        const map = {};
        res.data.predictions.forEach((p) => {
          map[p.topic_id] = p;
        });
        setMlRisks(map);
      })
      .catch(() => setMlRisks({}));
  }, [selectedId]);

  return (
    <div className="page">
      {error && <div className="error">{error}</div>}

      <div className="row">
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

      {loading && <p>Loading recommendations...</p>}

      {recs && (
        <>
          <h2 className="section-title">Hello, {recs.student_name} 👋</h2>
          <p className="subtitle">
            We found <b>{recs.total_topics}</b> topics across your subjects.
          </p>

          <h3 className="section-title">🔥 Today's Priorities</h3>
          <div className="grid">
            {recs.recommendations.slice(0, 6).map((r, idx) => (
              <div key={r.topic_id} className="card">
                <div className="card-header">
                  <span className="rank">#{idx + 1}</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {mlRisks[r.topic_id] && (
                      <span
                        className={
                          mlRisks[r.topic_id].at_risk
                            ? "badge badge-risk"
                            : "badge badge-ok"
                        }
                        title={`ML confidence: ${mlRisks[r.topic_id].confidence} (${Math.round(
                          mlRisks[r.topic_id].risk_probability * 100
                        )}% risk)`}
                      >
                        {mlRisks[r.topic_id].at_risk ? "🔴 At Risk" : "🟢 On Track"}
                      </span>
                    )}
                    <span className="tag">{r.subject_name}</span>
                  </div>
                </div>
                <h4>{r.topic_name}</h4>
                <div className="meta">
                  <span>Difficulty: <b>{r.difficulty}</b></span>
                  <span>Score: <b>{r.score}%</b></span>
                  <span>Attempts: <b>{r.attempts}</b></span>
                </div>
                <div className="bar">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.min(r.priority, 100)}%` }}
                  />
                </div>
                <p className="reason">💡 {r.reason}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}