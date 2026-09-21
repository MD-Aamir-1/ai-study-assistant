import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSearchHistory,
  getEnrichedTopics,
  generateFlashcards,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  Sparkles,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Check,
  Layers,
} from "lucide-react";
import "./Flashcards.css";

const CARDS_PER_SET = 10;

export default function Flashcards() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [enriched, setEnriched] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(true);

  const [activeTopic, setActiveTopic] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [known, setKnown] = useState(new Set());
  const [review, setReview] = useState(new Set());
  const [done, setDone] = useState(false);

  // ---------- Load topics ----------
  useEffect(() => {
    if (!user?.student_id) return;
    (async () => {
      try {
        const [h, t] = await Promise.all([
          getSearchHistory(user.student_id, 30),
          getEnrichedTopics(user.student_id),
        ]);
        setHistory(h.data.history || []);
        setEnriched(t.data || []);
      } catch {
        // silent
      } finally {
        setLoadingTopics(false);
      }
    })();
  }, [user?.student_id]);

  const enrichedMap = new Map(enriched.map((t) => [t.id, t]));

  const learnedTopics = history
    .map((h) => {
      const t = enrichedMap.get(h.topic_id);
      return {
        id: h.topic_id,
        name: h.topic_name,
        subject_name: h.subject_name,
        score: t?.score || 0,
        attempts: t?.attempts || 0,
      };
    })
    .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i);

  // ---------- Card navigation (useCallback to keep references stable) ----------
  const goToIndex = useCallback((newIndex) => {
    setCurrentIndex(newIndex);
    setFlipped(false);
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => {
      if (i < cards.length - 1) {
        return i + 1;
      }
      // Reached the end
      setDone(true);
      return i;
    });
    setFlipped(false);
  }, [cards.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : i));
    setFlipped(false);
  }, []);

  // ---------- Mark known/review ----------
  const markKnown = useCallback(() => {
    if (currentIndex >= cards.length) return;
    setKnown((prev) => {
      const next = new Set(prev);
      next.add(currentIndex);
      return next;
    });
    setReview((prev) => {
      const next = new Set(prev);
      next.delete(currentIndex);
      return next;
    });
    goNext();
  }, [currentIndex, cards.length, goNext]);

  const markReview = useCallback(() => {
    if (currentIndex >= cards.length) return;
    setReview((prev) => {
      const next = new Set(prev);
      next.add(currentIndex);
      return next;
    });
    setKnown((prev) => {
      const next = new Set(prev);
      next.delete(currentIndex);
      return next;
    });
    goNext();
  }, [currentIndex, cards.length, goNext]);

  const toggleFlip = useCallback(() => {
    setFlipped((f) => !f);
  }, []);

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    const handler = (e) => {
      if (!activeTopic || done) return;
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case " ":
        case "Enter":
          e.preventDefault();
          toggleFlip();
          break;
        case "ArrowRight":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "k":
        case "K":
          e.preventDefault();
          markKnown();
          break;
        case "r":
        case "R":
          e.preventDefault();
          markReview();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTopic, done, toggleFlip, goNext, goPrev, markKnown, markReview]);

  // ---------- Actions ----------
  const startSet = async (topic) => {
    setActiveTopic(topic);
    setGenerating(true);
    setError("");
    setCards([]);
    setCurrentIndex(0);
    setFlipped(false);
    setKnown(new Set());
    setReview(new Set());
    setDone(false);

    try {
      const res = await generateFlashcards(topic.id, CARDS_PER_SET, false);
      setCards(res.data.cards || []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Failed to generate flashcards. Try again."
      );
    } finally {
      setGenerating(false);
    }
  };

  const regenerate = async () => {
    if (!activeTopic) return;
    setGenerating(true);
    setError("");
    setCards([]);
    setCurrentIndex(0);
    setFlipped(false);
    setKnown(new Set());
    setReview(new Set());
    setDone(false);

    try {
      const res = await generateFlashcards(activeTopic.id, CARDS_PER_SET, true);
      setCards(res.data.cards || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Regeneration failed.");
    } finally {
      setGenerating(false);
    }
  };

  const backToTopics = () => {
    setActiveTopic(null);
    setCards([]);
    setCurrentIndex(0);
    setFlipped(false);
    setKnown(new Set());
    setReview(new Set());
    setDone(false);
    setError("");
  };

  // ==================================================
  // RENDER: Topic picker
  // ==================================================
  if (!activeTopic) {
    return (
      <div className="flash-page">
        <div className="flash-header">
          <div>
            <h1 className="flash-title">Flashcards</h1>
            <p className="flash-subtitle">
              Revise key facts with AI-generated flip cards.
            </p>
          </div>
        </div>

        {loadingTopics && learnedTopics.length === 0 && (
          <p className="flash-muted">Loading your topics...</p>
        )}

        {!loadingTopics && learnedTopics.length === 0 && (
          <div className="flash-empty-state">
            <Layers size={48} />
            <h2>No learned topics yet</h2>
            <p>Search for a topic first, then come back to make flashcards.</p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate("/search")}
            >
              <Sparkles size={14} /> Search a Topic
            </button>
          </div>
        )}

        {learnedTopics.length > 0 && (
          <>
            <div className="flash-grid-header">
              <h2 className="flash-grid-title">
                Your Topics ({learnedTopics.length})
              </h2>
            </div>

            <div className="flash-topics-grid">
              {learnedTopics.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="flash-topic-card"
                  onClick={() => startSet(t)}
                >
                  <span className="ftc-subject">{t.subject_name}</span>
                  <div className="ftc-name">{t.name}</div>
                  <div className="ftc-action">
                    <Layers size={14} />
                    <span>Generate flashcards</span>
                    <ArrowRight size={14} />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ==================================================
  // RENDER: Generating
  // ==================================================
  if (generating) {
    return (
      <div className="flash-page">
        <button type="button" className="btn-back" onClick={backToTopics}>
          <ArrowLeft size={14} /> Back to Topics
        </button>
        <div className="flash-generating">
          <div className="flash-generating-spinner">
            <Sparkles size={24} />
          </div>
          <h2>Generating flashcards...</h2>
          <p>Creating 10 cards from the concepts in "{activeTopic.name}".</p>
          <p className="flash-generating-hint">This takes about 5-10 seconds.</p>
        </div>
      </div>
    );
  }

  // ==================================================
  // RENDER: Summary
  // ==================================================
  if (done) {
    const total = cards.length;
    const knownCount = known.size;
    const reviewCount = review.size;

    return (
      <div className="flash-page">
        <button type="button" className="btn-back" onClick={backToTopics}>
          <ArrowLeft size={14} /> Back to Topics
        </button>

        <div className="flash-summary">
          <div className="flash-summary-header">
            <h2>Set Complete 🎉</h2>
            <p>
              You went through {total} flashcards from {activeTopic.name}.
            </p>
          </div>

          <div className="flash-summary-stats">
            <div className="fss-card fss-known">
              <Check size={18} />
              <div className="fss-count">{knownCount}</div>
              <div className="fss-label">Got it</div>
            </div>

            <div className="fss-card fss-review">
              <RotateCw size={18} />
              <div className="fss-count">{reviewCount}</div>
              <div className="fss-label">Review again</div>
            </div>
          </div>

          <div className="flash-summary-actions">
            <button type="button" className="btn-secondary" onClick={regenerate}>
              <RefreshCw size={14} /> New Cards
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={backToTopics}
            >
              <ArrowLeft size={14} /> Back to Topics
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================================================
  // RENDER: Flashcard view
  // ==================================================
  const card = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <div className="flash-page">
      <div className="flash-view-header">
        <button type="button" className="btn-back" onClick={backToTopics}>
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flash-view-meta">
          <span className="flash-view-topic">{activeTopic.name}</span>
          <span className="flash-view-count">
            {currentIndex + 1} / {cards.length}
          </span>
        </div>
      </div>

      {error && <div className="flash-error">{error}</div>}

      <div className="flash-progress-bar">
        <div
          className="flash-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div
        className={`flash-card-wrap ${flipped ? "flipped" : ""}`}
        onClick={toggleFlip}
        role="button"
        tabIndex={0}
      >
        <div className="flash-card-inner">
          <div className="flash-card flash-card-front">
            <div className="flash-card-side">Question</div>
            <div className="flash-card-text">{card?.front}</div>
            <div className="flash-card-hint">
              <RotateCw size={12} /> Click or press Space to flip
            </div>
          </div>

          <div className="flash-card flash-card-back">
            <div className="flash-card-side">Answer</div>
            <div className="flash-card-text">{card?.back}</div>
            {card?.concept_name && (
              <div className="flash-card-concept">{card.concept_name}</div>
            )}
          </div>
        </div>
      </div>

      <div className="flash-controls">
        <button
          type="button"
          className="flash-nav"
          onClick={goPrev}
          disabled={currentIndex === 0}
          title="Previous (←)"
        >
          <ArrowLeft size={16} /> Previous
        </button>

        <div className="flash-controls-mid">
          <button
            type="button"
            className="flash-btn-review"
            onClick={markReview}
            title="Review again (R)"
          >
            <RotateCw size={16} /> Review again
          </button>
          <button
            type="button"
            className="flash-btn-known"
            onClick={markKnown}
            title="Got it (K)"
          >
            <Check size={16} /> Got it
          </button>
        </div>

        <button
          type="button"
          className="flash-nav"
          onClick={goNext}
          title="Next (→)"
        >
          Next <ArrowRight size={16} />
        </button>
      </div>

      <div className="flash-shortcuts">
        <span>
          <kbd>Space</kbd> flip
        </span>
        <span>
          <kbd>←</kbd> / <kbd>→</kbd> navigate
        </span>
        <span>
          <kbd>K</kbd> known
        </span>
        <span>
          <kbd>R</kbd> review
        </span>
      </div>
    </div>
  );
}