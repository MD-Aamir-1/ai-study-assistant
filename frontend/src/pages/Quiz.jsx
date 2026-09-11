import { useEffect, useState } from "react";
import {
  getStudents,
  getRecommendations,
  getTopicQuestions,
  submitQuiz,
} from "../api/client";
import "./Quiz.css";

export default function Quiz() {
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load students
  useEffect(() => {
    getStudents()
      .then((res) => {
        setStudents(res.data);
        if (res.data.length > 0) setSelectedId(res.data[0].id);
      })
      .catch(() => setError("Could not load students."));
  }, []);

  // Load topics (from recommendations) when student changes
  useEffect(() => {
    if (!selectedId) return;
    getRecommendations(selectedId)
      .then((res) => {
        setTopics(res.data.recommendations);
        setResult(null);
        setAnswers({});
        setQuestions([]);
        if (res.data.recommendations.length > 0) {
          setSelectedTopic(res.data.recommendations[0].topic_id);
        }
      })
      .catch(() => setError("Failed to load topics"));
  }, [selectedId]);

  // Load questions when topic changes
  useEffect(() => {
    if (!selectedTopic) return;
    setLoading(true);
    setResult(null);
    setAnswers({});
    getTopicQuestions(selectedTopic)
      .then((res) => setQuestions(res.data))
      .catch(() => setError("Failed to load questions"))
      .finally(() => setLoading(false));
  }, [selectedTopic]);

  const handleAnswer = (qid, option) => {
    setAnswers((prev) => ({ ...prev, [qid]: option }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length === 0) {
      setError("Answer at least one question.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await submitQuiz({
        student_id: selectedId,
        topic_id: selectedTopic,
        answers,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit quiz");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setResult(null);
  };

  const currentTopic = topics.find((t) => t.topic_id === selectedTopic);

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

        <label style={{ marginLeft: 20 }}>Topic:</label>
        <select
          value={selectedTopic || ""}
          onChange={(e) => setSelectedTopic(Number(e.target.value))}
        >
          {topics.map((t) => (
            <option key={t.topic_id} value={t.topic_id}>
              {t.subject_name} → {t.topic_name} (score {t.score}%)
            </option>
          ))}
        </select>
      </div>

      {currentTopic && (
        <div className="topic-info">
          <b>{currentTopic.topic_name}</b> · Difficulty: {currentTopic.difficulty} · Current score: {currentTopic.score}%
        </div>
      )}

      {loading && <p>Loading...</p>}

      {!loading && questions.length === 0 && !result && (
        <p className="empty">No questions for this topic yet.</p>
      )}

      {!loading && questions.length > 0 && !result && (
        <>
          <h3 className="section-title">📝 Quiz ({questions.length} questions)</h3>
          <div className="questions">
            {questions.map((q, idx) => (
              <div key={q.id} className="question">
                <div className="q-text">
                  {idx + 1}. {q.question}
                </div>
                <div className="options">
                  {["A", "B", "C", "D"].map((opt) => {
                    const key = `option_${opt.toLowerCase()}`;
                    return (
                      <label
                        key={opt}
                        className={`option ${answers[q.id] === opt ? "selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() => handleAnswer(q.id, opt)}
                        />
                        <span className="opt-letter">{opt}.</span>
                        <span>{q[key]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleSubmit} disabled={loading} className="btn-primary">
            Submit Quiz
          </button>
        </>
      )}

      {result && (
        <div className="result-box">
          <h3>🎯 Result</h3>
          <div className="result-score">
            {result.score_percent}%
          </div>
          <p>
            You got <b>{result.correct}</b> out of <b>{result.total}</b> correct.
          </p>
          <p className="perf-note">
            Performance updated: score → <b>{result.updated_performance.new_score}%</b>{" "}
            (attempts: {result.updated_performance.attempts})
          </p>

          <h4>Details</h4>
          <div className="details">
            {result.details.map((d) => (
              <div key={d.question_id} className={`detail ${d.is_correct ? "ok" : "bad"}`}>
                <div>{d.question}</div>
                <div className="detail-line">
                  Your answer: <b>{d.your_answer || "—"}</b> · Correct: <b>{d.correct_answer}</b>
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleRetry} className="btn-primary">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}