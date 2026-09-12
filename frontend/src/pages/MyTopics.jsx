import { useEffect, useState } from "react";
import {
  getStudents,
  getEnrichedSubjects,
  getEnrichedTopics,
  createTopic,
  deleteTopic,
} from "../api/client";
import { Plus, Trash2, ListTree, X } from "lucide-react";
import "./MyTopics.css";

export default function MyTopics() {
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [filterSubject, setFilterSubject] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDifficulty, setNewDifficulty] = useState("medium");
  const [newSubject, setNewSubject] = useState("");
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
    loadAll();
  }, [selectedId]);

  const loadAll = () => {
    setLoading(true);
    setError("");
    Promise.all([
      getEnrichedSubjects(selectedId),
      getEnrichedTopics(selectedId),
    ])
      .then(([sRes, tRes]) => {
        setSubjects(sRes.data);
        setTopics(tRes.data);
        if (sRes.data.length > 0 && !newSubject) {
          setNewSubject(String(sRes.data[0].id));
        }
      })
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newSubject) return;
    setSubmitting(true);
    setError("");
    try {
      await createTopic(newName.trim(), newDifficulty, Number(newSubject));
      setNewName("");
      setNewDifficulty("medium");
      setShowForm(false);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to add topic");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete topic "${name}"?`)) return;
    try {
      await deleteTopic(id);
      loadAll();
    } catch {
      setError("Failed to delete topic");
    }
  };

  const difficultyClass = (d) => {
    if (d === "hard") return "diff-hard";
    if (d === "easy") return "diff-easy";
    return "diff-medium";
  };

  const filtered =
    filterSubject === "all"
      ? topics
      : topics.filter((t) => String(t.subject_id) === filterSubject);

  return (
    <div className="topics-page">
      <div className="topics-header">
        <div>
          <h1 className="topics-title">My Topics</h1>
          <p className="topics-subtitle">
            Manage topics under each subject.
          </p>
        </div>

        <div className="topics-actions">
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

          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
          >
            <option value="all">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>

          <button className="btn-add" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "Cancel" : "Add Topic"}
          </button>
        </div>
      </div>

      {error && <div className="topics-error">{error}</div>}

      {showForm && (
        <form className="add-form-topics" onSubmit={handleAdd}>
          <input
            autoFocus
            type="text"
            placeholder="Topic name (e.g., Indexing)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={newDifficulty}
            onChange={(e) => setNewDifficulty(e.target.value)}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <button type="submit" disabled={submitting || !newName.trim()}>
            {submitting ? "Adding..." : "Add"}
          </button>
        </form>
      )}

      {loading && <p className="topics-muted">Loading...</p>}

      {!loading && filtered.length === 0 && (
        <div className="topics-empty">
          <ListTree size={40} />
          <p>No topics yet.</p>
          <p className="topics-empty-hint">
            {subjects.length === 0
              ? "Add a subject first, then add topics."
              : 'Click "Add Topic" to get started.'}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="topics-grid">
          {filtered.map((t) => (
            <div className="topic-card-item" key={t.id}>
              <div className="topic-card-top">
                <span className={`diff-pill ${difficultyClass(t.difficulty)}`}>
                  {t.difficulty}
                </span>
                <button
                  className="icon-delete"
                  onClick={() => handleDelete(t.id, t.name)}
                  title="Delete topic"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <h3 className="topic-card-name">{t.name}</h3>
              <p className="topic-card-subject">{t.subject_name}</p>

              <div className="topic-card-stats">
                <div>
                  <div className="topic-stat-label">Score</div>
                  <div className="topic-stat-value">{t.score}%</div>
                </div>
                <div>
                  <div className="topic-stat-label">Attempts</div>
                  <div className="topic-stat-value">{t.attempts}</div>
                </div>
              </div>

              <div className="topic-card-bar">
                <div
                  className="topic-card-bar-fill"
                  style={{ width: `${t.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}