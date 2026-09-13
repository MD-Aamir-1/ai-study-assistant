import { useEffect, useState } from "react";
import {
  X,
  Sparkles,
  RefreshCw,
  Target,
  Layers,
  Lightbulb,
  Wrench,
  AlertTriangle,
  Link2,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import { getConceptContent } from "../api/client";
import "./ConceptModal.css";

export default function ConceptModal({ concept, onClose }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!concept) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept?.id]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getConceptContent(concept.id);
      setContent(res.data.content);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not generate concept content. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const res = await getConceptContent(concept.id, true);
      setContent(res.data.content);
    } catch {
      setError("Regeneration failed.");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="concept-modal-backdrop" onClick={onClose}>
      <div
        className="concept-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* HEADER */}
        <div className="concept-modal-header">
          <div className="concept-modal-title-wrap">
            <div className="concept-modal-icon">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="concept-modal-label">Concept Deep-Dive</div>
              <h2 className="concept-modal-title">{concept.name}</h2>
            </div>
          </div>

          <button className="concept-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="concept-modal-body">
          {loading && (
            <div className="concept-modal-loading">
              <div className="loading-spinner">
                <Sparkles size={24} />
              </div>
              <p>Generating deep-dive explanation...</p>
              <p className="concept-modal-hint">This takes ~10–15 seconds the first time.</p>
            </div>
          )}

          {error && !loading && (
            <div className="concept-modal-error">
              <AlertTriangle size={16} /> {error}
              <button className="btn-secondary" onClick={load}>Retry</button>
            </div>
          )}

          {!loading && !error && content && (
            <>
              {/* Summary */}
              <section className="cm-section">
                <div className="cm-section-head">
                  <Sparkles size={15} />
                  <h3>Summary</h3>
                </div>
                <p className="cm-text cm-summary">{content.summary}</p>
              </section>

              {/* Why it matters */}
              <section className="cm-section">
                <div className="cm-section-head">
                  <Target size={15} />
                  <h3>Why It Matters</h3>
                </div>
                <p className="cm-text">{content.why_it_matters}</p>
              </section>

              {/* Deep explanation */}
              <section className="cm-section">
                <div className="cm-section-head">
                  <BookOpen size={15} />
                  <h3>Deep Explanation</h3>
                </div>
                <p className="cm-text">{content.deep_explanation}</p>
              </section>

              {/* How it works */}
              {content.how_it_works?.length > 0 && (
                <section className="cm-section">
                  <div className="cm-section-head">
                    <Layers size={15} />
                    <h3>How It Works</h3>
                  </div>
                  <ol className="cm-steps">
                    {content.how_it_works.map((s, i) => (
                      <li key={i}>
                        <span className="cm-step-num">{i + 1}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Intuition */}
              {content.intuition && (
                <section className="cm-section">
                  <div className="cm-section-head">
                    <Lightbulb size={15} />
                    <h3>Intuition</h3>
                  </div>
                  <p className="cm-text cm-intuition">{content.intuition}</p>
                </section>
              )}

              {/* Concrete example */}
              {content.concrete_example && (
                <section className="cm-section">
                  <div className="cm-section-head">
                    <Wrench size={15} />
                    <h3>Concrete Example</h3>
                  </div>
                  <p className="cm-text cm-example">{content.concrete_example}</p>
                </section>
              )}

              {/* Common pitfalls */}
              {content.common_pitfalls?.length > 0 && (
                <section className="cm-section">
                  <div className="cm-section-head">
                    <AlertTriangle size={15} />
                    <h3>Common Pitfalls</h3>
                  </div>
                  <ul className="cm-list cm-pitfalls">
                    {content.common_pitfalls.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Connections */}
              {content.connections?.length > 0 && (
                <section className="cm-section">
                  <div className="cm-section-head">
                    <Link2 size={15} />
                    <h3>Related Concepts</h3>
                  </div>
                  <div className="cm-chips">
                    {content.connections.map((c, i) => (
                      <span key={i} className="cm-chip">{c}</span>
                    ))}
                  </div>
                </section>
              )}

              {/* Quick check */}
              {content.quick_check && (
                <section className="cm-section cm-quick-check">
                  <div className="cm-section-head">
                    <HelpCircle size={15} />
                    <h3>Quick Check</h3>
                  </div>
                  <p className="cm-text">{content.quick_check}</p>
                </section>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        {!loading && !error && content && (
          <div className="concept-modal-footer">
            <button className="btn-secondary" onClick={onClose}>
              Close
            </button>
            <button className="btn-primary" onClick={regenerate} disabled={regenerating}>
              <RefreshCw size={14} className={regenerating ? "spin" : ""} />
              {regenerating ? "Regenerating..." : "Regenerate"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}