import { useEffect, useState } from "react";
import {
  getStudents,
  getEnrichedSubjects,
  createSubject,
  deleteSubject,
} from "../api/client";
import { Plus, Trash2, BookOpen, X } from "lucide-react";
import "./MySubjects.css";

export default function MySubjects() {
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    loadSubjects();
  }, [selectedId]);

  const loadSubjects = () => {
    setLoading(true);
    setError("");
    getEnrichedSubjects(selectedId)
      .then((res) => setSubjects(res.data))
      .catch(() => setError("Failed to load subjects"))
      .finally(() => setLoading(false));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await createSubject(newName.trim(), selectedId);
      setNewName("");
      setShowForm(false);
      loadSubjects();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to add subject");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This will also delete its topics.`)) return;
    try {
      await deleteSubject(id);
      loadSubjects();
    } catch {
      setError("Failed to delete subject");
    }
  };

  const subjectColors = [
    "#2563eb",
    "#8b5cf6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
  ];

  return (
    <div className="subjects-page">
      <div className="subjects-header">
        <div>
          <h1 className="subjects-title">My Subjects</h1>
          <p className="subjects-subtitle">
            Manage the subjects you're studying.
          </p>
        </div>

        <div className="subjects-actions">
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

          <button
            className="btn-add"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "Cancel" : "Add Subject"}
          </button>
        </div>
      </div>

      {error && <div className="subjects-error">{error}</div>}

      {showForm && (
        <form className="add-form" onSubmit={handleAdd}>
          <input
            autoFocus
            type="text"
            placeholder="Subject name (e.g., Operating Systems)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" disabled={submitting || !newName.trim()}>
            {submitting ? "Adding..." : "Add"}
          </button>
        </form>
      )}

      {loading && <p className="subjects-muted">Loading...</p>}

      {!loading && subjects.length === 0 && (
        <div className="subjects-empty">
          <BookOpen size={40} />
          <p>No subjects yet.</p>
          <p className="subjects-empty-hint">
            Click "Add Subject" to get started.
          </p>
        </div>
      )}

      {!loading && subjects.length > 0 && (
        <div className="subjects-grid">
          {subjects.map((s, idx) => {
            const color = subjectColors[idx % subjectColors.length];
            return (
              <div className="subject-card" key={s.id}>
                <div className="subject-card-header">
                  <div
                    className="subject-icon"
                    style={{ background: `${color}20`, color }}
                  >
                    <BookOpen size={18} />
                  </div>
                  <button
                    className="icon-delete"
                    onClick={() => handleDelete(s.id, s.name)}
                    title="Delete subject"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <h3 className="subject-name">{s.name}</h3>
                <div className="subject-meta">
                  <span>{s.topic_count} topics</span>
                  <span className="subject-score" style={{ color }}>
                    {s.avg_score}%
                  </span>
                </div>

                <div className="subject-bar">
                  <div
                    className="subject-bar-fill"
                    style={{ width: `${s.avg_score}%`, background: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}