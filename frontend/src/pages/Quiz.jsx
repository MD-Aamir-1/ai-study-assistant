import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getEnrichedTopics,
  generateTest,
  submitTest,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  Clock, SkipForward, ArrowRight, Check, Sparkles, RefreshCw,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import "./Quiz.css";

export default function Quiz() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!user?.student_id) return;
    getEnrichedTopics(user.student_id)
      .then((res) => {
        const list = res.data || [];
        setTopics(list);
        const urlTopic = Number(searchParams.get("topic"));
        const fromUrl = list.find((t) => t.id === urlTopic);
        const pick = fromUrl || list[0];
        if (pick) setSelectedTopic(pick.id);
        setResult(null);
        setAnswers({});
        setQuestions([]);
        setCurrentIndex(0);
        setSeconds(0);
      })
      .catch(() => setError("Failed to load topics"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.student_id]);

  useEffect(() => {
    if (!selectedTopic) return;
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTopic]);

  useEffect(() => {
    if (questions.length === 0 || result) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [questions.length, result]);

  const handleTopicChange = (newId) => {
    setSelectedTopic(newId);
    setSearchParams({ topic: newId });
  };

  const handleGenerate = async () => {
    if (!selectedTopic) return;
    setGenerating(true);
    setError("");
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setResult(null);
    setSeconds(0);
    try {
      const res = await generateTest(selectedTopic, 6);
      setQuestions(res.data.questions);
    } catch (err) {
      setError(err.response?.data?.detail || "Test generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleAnswer = (qid, option) =>
    setAnswers((prev) => ({ ...prev, [qid]: option }));

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex((i) => i + 1);
    else handleSubmit();
  };

  const handleSkip = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex((i) => i + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length === 0) {
      setError("Answer at least one question.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await submitTest(user.student_id, answers);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit test");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setResult(null);
    setCurrentIndex(0);
    setSeconds(0);
  };

  const currentTopic = topics.find((t) => t.id === selectedTopic);
  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const trendIcon = (trend) => {
    if (trend === "improving") return <TrendingUp size={12} />;
    if (trend === "declining") return <TrendingDown size={12} />;
    return <Minus size={12} />;
  };

  const conceptColor = (score) => {
    if (score >= 75) return "concept-good";
    if (score >= 50) return "concept-mid";
    return "concept-weak";
  };

  return (
    <div className="quiz-page">
      {error && <div className="quiz-error">{error}</div>}

      <div className="quiz-header">
        <div>
          <h1 className="quiz-title">
            {currentTopic ? `${currentTopic.name} Test` : "Conceptual Test"}
          </h1>
          <p className="quiz-subtitle">
            Concept-aware questions — find out exactly what you understand.
          </p>
        </div>

        <div className="quiz-controls">
          <select
            value={selectedTopic || ""}
            onChange={(e) => handleTopicChange(Number(e.target.value))}
          >
            {topics.length === 0 && <option value="">No topics yet</option>}
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.subject_name} → {t.name}
                {t.score > 0 ? ` (${t.score}%)` : ""}
              </option>
            ))}
          </select>

          <button
            className="btn-regenerate"
            onClick={handleGenerate}
            disabled={generating || !selectedTopic}
          >
            <RefreshCw size={14} className={generating ? "spin" : ""} />
            {generating ? "Generating..." : "New Questions"}
          </button>
        </div>
      </div>

      {generating && (
        <div className="quiz-generating">
          <div className="ai-loading">
            <Sparkles size={20} />
            <span>Generating concept-aware questions...</span>
          </div>
        </div>
      )}

      {!generating && !result && questions.length > 0 && currentQuestion && (
        <div className="quiz-body">
          <div className="quiz-main">
            <div className="quiz-progress-row">
              <div className="quiz-progress-text">
                Question <b>{currentIndex + 1}</b> of <b>{questions.length}</b>
              </div>
              <div className="quiz-timer">
                <Clock size={14} />
                {formatTime(seconds)}
              </div>
            </div>

            <div className="quiz-progress-bar">
              <div className="quiz-progress-fill" style={{ width: `${progress}%` }} />
            </div>

            <div className="quiz-question-card">
              <div className="ai-badge">
                <Sparkles size={12} />
                {currentQuestion.question_type || "conceptual"} ·{" "}
                {currentQuestion.difficulty}
              </div>
              <h2 className="quiz-q-text">
                {currentIndex + 1}. {currentQuestion.question}
              </h2>
              <div className="quiz-options">
                {["A", "B", "C", "D"].map((opt) => {
                  const key = `option_${opt.toLowerCase()}`;
                  const selected = answers[currentQuestion.id] === opt;
                  return (
                    <label key={opt} className={`quiz-option ${selected ? "selected" : ""}`}>
                      <span className="quiz-opt-radio">
                        {selected && <span className="quiz-opt-radio-inner" />}
                      </span>
                      <input
                        type="radio"
                        name={`q-${currentQuestion.id}`}
                        value={opt}
                        checked={selected}
                        onChange={() => handleAnswer(currentQuestion.id, opt)}
                      />
                      <span className="quiz-opt-text">{currentQuestion[key]}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="quiz-nav">
              <button
                className="btn-skip"
                onClick={handlePrev}
                disabled={currentIndex === 0}
              >
                ← Previous
              </button>
              <div className="quiz-nav-right">
                <button className="btn-skip" onClick={handleSkip}>
                  <SkipForward size={14} /> Skip
                </button>
                {currentIndex < questions.length - 1 ? (
                  <button className="btn-primary" onClick={handleNext}>
                    Next <ArrowRight size={14} />
                  </button>
                ) : (
                  <button className="btn-primary" onClick={handleNext} disabled={submitting}>
                    <Check size={14} />
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                )}
              </div>
            </div>
          </div>

          <aside className="quiz-info">
            <h3 className="quiz-info-title">Test Info</h3>
            <div className="quiz-info-item">
              <span>Topic</span><b>{currentTopic?.name}</b>
            </div>
            <div className="quiz-info-item">
              <span>Subject</span><b>{currentTopic?.subject_name}</b>
            </div>
            <div className="quiz-info-item">
              <span>Difficulty</span>
              <b style={{ textTransform: "capitalize" }}>{currentTopic?.difficulty}</b>
            </div>
            <div className="quiz-info-item">
              <span>Total Questions</span><b>{questions.length}</b>
            </div>
            <div className="quiz-info-item">
              <span>Answered</span><b>{Object.keys(answers).length}</b>
            </div>
            {currentQuestion.concepts?.length > 0 && (
              <div className="quiz-info-concepts">
                <div className="quiz-info-subtitle">This question tests</div>
                {currentQuestion.concepts.map((c) => (
                  <span key={c.id} className="quiz-concept-chip">{c.name}</span>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}

      {!generating && !result && questions.length === 0 && !error && (
        <p className="quiz-empty">
          {topics.length === 0
            ? "Search for a topic first to unlock testing."
            : "Select a topic to generate concept-aware questions."}
        </p>
      )}

      {result && (
        <div className="quiz-result-box">
          <div className="result-header">
            <div>
              <h2>🎯 Test Results</h2>
              <p className="result-subtitle">
                {result.correct} out of {result.total} correct
              </p>
            </div>
            <div className="result-score-big">
              <span>{result.score_percent}%</span>
            </div>
          </div>

          {result.concepts && result.concepts.length > 0 && (
            <div className="result-concepts">
              <h3 className="result-section-title">🧠 Concept Breakdown</h3>
              <p className="result-section-sub">
                Sorted weakest first — this is where you need the most work.
              </p>
              {result.concepts.map((c) => (
                <div key={c.concept_id} className="concept-result">
                  <div className="concept-result-header">
                    <span className="concept-result-name">{c.concept_name}</span>
                    <div className="concept-result-right">
                      <span className={`concept-trend trend-${c.trend}`}>
                        {trendIcon(c.trend)}{c.trend}
                      </span>
                      <span className={`concept-score-badge ${conceptColor(c.session_score)}`}>
                        {c.session_score}%
                      </span>
                    </div>
                  </div>
                  <div className="concept-result-bar">
                    <div
                      className={`concept-result-fill ${conceptColor(c.session_score)}`}
                      style={{ width: `${c.session_score}%` }}
                    />
                  </div>
                  <div className="concept-result-meta">
                    This session: <b>{c.session_correct}/{c.session_total}</b>
                    {" · "}Overall: <b>{c.overall_score}%</b> (
                    {c.overall_attempts} attempts · confidence {Math.round(c.confidence * 100)}%)
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="result-questions">
            <h3 className="result-section-title">📝 Question Review</h3>
            {result.details.map((d) => (
              <div key={d.question_id} className={`quiz-detail ${d.is_correct ? "ok" : "bad"}`}>
                <div className="quiz-detail-q">{d.question}</div>
                <div className="quiz-detail-line">
                  Your answer: <b>{d.your_answer || "—"}</b> · Correct: <b>{d.correct_answer}</b>
                </div>
                {d.explanation && <div className="quiz-detail-expl">💡 {d.explanation}</div>}
                {d.concepts?.length > 0 && (
                  <div className="quiz-detail-concepts">
                    {d.concepts.map((cn, i) => (
                      <span key={i} className="quiz-concept-chip">{cn}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="quiz-result-actions">
            <button onClick={handleRetry} className="btn-primary">Review Answers</button>
            <button onClick={handleGenerate} className="btn-secondary">
              <RefreshCw size={14} /> Generate New Test
            </button>
          </div>
        </div>
      )}
    </div>
  );
}