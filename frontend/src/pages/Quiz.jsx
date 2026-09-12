import { useEffect, useState, useRef } from "react";
import {
  getStudents,
  getRecommendations,
  generateQuiz,
  submitDynamicQuiz,
} from "../api/client";
import { Clock, SkipForward, ArrowRight, Check, Sparkles, RefreshCw } from "lucide-react";
import "./Quiz.css";

export default function Quiz() {
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
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

  // Load students
  useEffect(() => {
    getStudents()
      .then((res) => {
        setStudents(res.data);
        if (res.data.length > 0) setSelectedId(res.data[0].id);
      })
      .catch(() => setError("Could not load students."));
  }, []);

  // Load topics
  useEffect(() => {
    if (!selectedId) return;
    getRecommendations(selectedId)
      .then((res) => {
        setTopics(res.data.recommendations);
        setResult(null);
        setAnswers({});
        setQuestions([]);
        setCurrentIndex(0);
        if (res.data.recommendations.length > 0) {
          setSelectedTopic(res.data.recommendations[0].topic_id);
        }
      })
      .catch(() => setError("Failed to load topics"));
  }, [selectedId]);

  // Auto-generate when topic changes
  useEffect(() => {
    if (!selectedTopic) return;
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTopic]);

  // Timer
  useEffect(() => {
    if (questions.length === 0 || result) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [questions.length, result]);

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
      const res = await generateQuiz(selectedTopic, 5);
      setQuestions(res.data.questions);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Quiz generation failed. Try again in a moment."
      );
    } finally {
      setGenerating(false);
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleAnswer = (qid, option) => {
    setAnswers((prev) => ({ ...prev, [qid]: option }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSkip = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
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
      const res = await submitDynamicQuiz({
        student_id: selectedId,
        topic_id: selectedTopic,
        questions,
        answers,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit quiz");
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

  const currentTopic = topics.find((t) => t.topic_id === selectedTopic);
  const currentQuestion = questions[currentIndex];
  const progress =
    questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  return (
    <div className="quiz-page">
      {error && <div className="quiz-error">{error}</div>}

      {/* HEADER */}
      <div className="quiz-header">
        <div>
          <h1 className="quiz-title">
            {currentTopic ? `${currentTopic.topic_name} Quiz` : "Quiz"}
          </h1>
          <p className="quiz-subtitle">
            AI-generated conceptual questions — fresh every time.
          </p>
        </div>

        <div className="quiz-controls">
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
            value={selectedTopic || ""}
            onChange={(e) => setSelectedTopic(Number(e.target.value))}
          >
            {topics.map((t) => (
              <option key={t.topic_id} value={t.topic_id}>
                {t.subject_name} → {t.topic_name} ({t.score}%)
              </option>
            ))}
          </select>

          <button
            className="btn-regenerate"
            onClick={handleGenerate}
            disabled={generating || !selectedTopic}
            title="Generate fresh questions"
          >
            <RefreshCw size={14} className={generating ? "spin" : ""} />
            {generating ? "Generating..." : "New Questions"}
          </button>
        </div>
      </div>

      {/* GENERATING STATE */}
      {generating && (
        <div className="quiz-generating">
          <div className="ai-loading">
            <Sparkles size={20} />
            <span>Generating conceptual questions with AI...</span>
          </div>
        </div>
      )}

      {/* QUIZ BODY */}
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
              <div
                className="quiz-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="quiz-question-card">
              <div className="ai-badge">
                <Sparkles size={12} />
                AI-Generated Conceptual Question
              </div>

              <h2 className="quiz-q-text">
                {currentIndex + 1}. {currentQuestion.question}
              </h2>

              <div className="quiz-options">
                {["A", "B", "C", "D"].map((opt) => {
                  const key = `option_${opt.toLowerCase()}`;
                  const selected = answers[currentQuestion.id] === opt;
                  return (
                    <label
                      key={opt}
                      className={`quiz-option ${selected ? "selected" : ""}`}
                    >
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
                      <span className="quiz-opt-text">
                        {currentQuestion[key]}
                      </span>
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
                  <SkipForward size={14} />
                  Skip
                </button>

                {currentIndex < questions.length - 1 ? (
                  <button className="btn-primary" onClick={handleNext}>
                    Next
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={handleNext}
                    disabled={submitting}
                  >
                    <Check size={14} />
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* INFO PANEL */}
          <aside className="quiz-info">
            <h3 className="quiz-info-title">Quiz Info</h3>
            <div className="quiz-info-item">
              <span>Topic</span>
              <b>{currentTopic?.topic_name}</b>
            </div>
            <div className="quiz-info-item">
              <span>Subject</span>
              <b>{currentTopic?.subject_name}</b>
            </div>
            <div className="quiz-info-item">
              <span>Difficulty</span>
              <b style={{ textTransform: "capitalize" }}>
                {currentTopic?.difficulty}
              </b>
            </div>
            <div className="quiz-info-item">
              <span>Total Questions</span>
              <b>{questions.length}</b>
            </div>
            <div className="quiz-info-item">
              <span>Answered</span>
              <b>{Object.keys(answers).length}</b>
            </div>
            <div className="quiz-info-item">
              <span>Your Score</span>
              <b>{currentTopic?.score}%</b>
            </div>

            <div className="quiz-info-note">
              <Sparkles size={13} />
              Questions are generated fresh by AI each time to test
              conceptual understanding.
            </div>
          </aside>
        </div>
      )}

      {/* EMPTY STATE */}
      {!generating && !result && questions.length === 0 && !error && (
        <p className="quiz-empty">
          Select a topic to generate AI-powered conceptual questions.
        </p>
      )}

      {/* RESULT */}
      {result && (
        <div className="quiz-result-box">
          <h2>🎯 Result</h2>
          <div className="quiz-result-score">{result.score_percent}%</div>
          <p>
            You got <b>{result.correct}</b> out of <b>{result.total}</b>{" "}
            correct.
          </p>
          <p className="quiz-perf-note">
            Performance updated: score →{" "}
            <b>{result.updated_performance.new_score}%</b> (attempts:{" "}
            {result.updated_performance.attempts})
          </p>

          <h3>Details</h3>
          <div className="quiz-details">
            {result.details.map((d) => (
              <div
                key={d.question_id}
                className={`quiz-detail ${d.is_correct ? "ok" : "bad"}`}
              >
                <div>{d.question}</div>
                <div className="quiz-detail-line">
                  Your answer: <b>{d.your_answer || "—"}</b> · Correct:{" "}
                  <b>{d.correct_answer}</b>
                </div>
              </div>
            ))}
          </div>

          <div className="quiz-result-actions">
            <button onClick={handleRetry} className="btn-primary">
              Review Answers
            </button>
            <button onClick={handleGenerate} className="btn-secondary">
              <RefreshCw size={14} />
              Generate New Questions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}