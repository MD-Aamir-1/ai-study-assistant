import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getTopicFull, regenerateContent } from "../api/client";
import Markdown from "../components/Markdown";
import MermaidDiagram from "../components/MermaidDiagram";
import ConceptModal from "../components/ConceptModal";
import RelatedTopics from "../components/RelatedTopics";
import ClickableTypes, { hasValidTypes } from "../components/ClickableTypes";
import { exportAnswerAsPdf } from "../utils/pdfExport";
import "../components/Markdown.css";
import {
  Sparkles,
  RefreshCw,
  ArrowLeft,
  Layers,
  BookOpen,
  Lightbulb,
  Target,
  Wrench,
  AlertTriangle,
  Link2,
  Play,
  Copy,
  Check,
  Download,
  Zap,
} from "lucide-react";
import "./TopicView.css";

export default function TopicView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [activeConcept, setActiveConcept] = useState(null);

  const [copiedAll, setCopiedAll] = useState(false);
  const [exporting, setExporting] = useState(false);

  const contentRef = useRef(null);

  useEffect(() => {
    loadTopic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadTopic = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getTopicFull(id);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load topic");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (
      !window.confirm(
        "Regenerate content? This creates a fresh version (~8 sec)."
      )
    )
      return;
    setRegenerating(true);
    try {
      await regenerateContent(id);
      await loadTopic();
    } catch {
      setError("Regeneration failed.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyAll = async () => {
    if (!contentRef.current) return;
    try {
      await navigator.clipboard.writeText(contentRef.current.innerText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const handleExportPdf = async () => {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      await exportAnswerAsPdf({
  title: data?.topic?.name || "Study Material",
  subtitle: "",
  sourceElement: contentRef.current,
  filename: `${
    data?.topic?.name?.replace(/\s+/g, "-").toLowerCase() || "topic"
  }.pdf`,
});
    } catch (err) {
      console.error(err);
      setError("PDF export failed.");
    } finally {
      setExporting(false);
    }
  };

  // ---------- LOADING ----------
  if (loading) {
    return (
      <div className="topic-loading">
        <div className="loading-spinner">
          <Sparkles size={28} />
        </div>
        <h2>Preparing your lesson...</h2>
        <p>This usually takes 5–15 seconds.</p>
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    );
  }

    if (error) {
    return (
      <div className="topic-error-wrap">
        <div className="topic-error">{error}</div>
        <div className="topic-error-actions">
          <button
            className="btn-primary"
            onClick={() => {
              setError("");
              loadTopic();
            }}
          >
            <RefreshCw size={14} />
            Try Again
          </button>
          <button
            className="btn-secondary"
            onClick={() => navigate("/search")}
          >
            Back to Search
          </button>
          <button
            className="btn-secondary"
            onClick={() => navigate("/")}
          >
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { topic, content, concepts } = data;

  return (
    <div className="topic-view" ref={contentRef}>
      {/* ---------- HEADER ---------- */}
      <div className="topic-header" data-html2canvas-ignore="true">
        <Link to="/search" className="topic-back">
          <ArrowLeft size={16} /> Back to Search
        </Link>

        <div className="topic-title-row">
          <div>
            <div className="topic-subject-tag">{topic.subject_name}</div>
            <h1 className="topic-title">{topic.name}</h1>
            {content.tagline && (
              <p className="topic-tagline">{content.tagline}</p>
            )}
            <div className="topic-meta">
              <span className={`diff-pill diff-${topic.difficulty}`}>
                {topic.difficulty}
              </span>
              <span className="topic-meta-item">
                {concepts.length} concepts
              </span>
            </div>
          </div>

          <div className="topic-actions" data-html2canvas-ignore="true">
            <button
              className="btn-secondary"
              onClick={handleCopyAll}
              title="Copy all"
            >
              {copiedAll ? (
                <>
                  <Check size={14} /> Copied!
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy
                </>
              )}
            </button>
            <button
              className="btn-secondary"
              onClick={handleExportPdf}
              disabled={exporting}
            >
              {exporting ? (
                <>
                  <RefreshCw size={14} className="spin" /> Preparing...
                </>
              ) : (
                <>
                  <Download size={14} /> PDF
                </>
              )}
            </button>
            <button
              className="btn-secondary"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              <RefreshCw size={14} className={regenerating ? "spin" : ""} />
              {regenerating ? "Regenerating..." : "Regenerate"}
            </button>
            <button
              className="btn-primary"
              onClick={() => navigate(`/quiz?topic=${id}`)}
            >
              <Play size={14} />
              Take Test
            </button>
          </div>
        </div>
      </div>

      {/* ---------- CONCEPT CHIPS (hidden in PDF) ---------- */}
      {concepts.length > 0 && (
        <section
          className="topic-concepts-strip"
          data-html2canvas-ignore="true"
        >
          <div className="strip-title">
            <Layers size={16} />
            Concepts in this topic
          </div>
          <div className="concept-chips">
            {concepts.map((c) => (
              <button
                key={c.id}
                type="button"
                className="concept-chip concept-chip-clickable"
                onClick={() => setActiveConcept(c)}
                title={`Click to learn more about ${c.name}`}
              >
                <span className="concept-chip-name">{c.name}</span>
                <span
                  className={`concept-chip-imp imp-${c.importance}`}
                  title={`Importance: ${c.importance}/5`}
                >
                  {c.importance}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------- 1. INTRO ---------- */}
      {content.intro_md && (
        <Section icon={BookOpen} title="Introduction" accent="blue">
          <Markdown>{content.intro_md}</Markdown>
        </Section>
      )}

      {/* ---------- 2. REAL-WORLD EXAMPLE ---------- */}
      {content.real_world_example_md && (
        <Section icon={Lightbulb} title="Real-World Example" accent="yellow">
          <div className="topic-highlight-block">
            <Markdown>{content.real_world_example_md}</Markdown>
          </div>
        </Section>
      )}

      {/* ---------- 3. WHY IT'S NEEDED ---------- */}
      {content.why_needed_md && (
        <Section
          icon={Target}
          title={`Why ${topic.name} Matters`}
          accent="purple"
        >
          <Markdown>{content.why_needed_md}</Markdown>
        </Section>
      )}

      {/* ---------- 4. HOW IT WORKS ---------- */}
      {content.how_it_works_md && (
        <Section icon={Zap} title="How It Works" accent="orange">
          <Markdown>{content.how_it_works_md}</Markdown>
        </Section>
      )}

      {/* ---------- 5. DIAGRAM ---------- */}
      {content.diagram_mermaid && content.diagram_mermaid.trim() && (
        <Section icon={Layers} title="Diagram" accent="purple">
          <MermaidDiagram code={content.diagram_mermaid} />
          {content.diagram_caption && (
            <p className="diagram-caption">{content.diagram_caption}</p>
          )}
        </Section>
      )}

      {/* ---------- 6. TYPES (clickable names) ---------- */}
      {hasValidTypes(content.types_md) && (
        <Section icon={Layers} title="Types & Variants" accent="blue">
          <ClickableTypes markdown={content.types_md} />
        </Section>
      )}

      {/* ---------- 7. APPLICATIONS ---------- */}
      {content.applications_md && (
        <Section icon={Target} title="Applications" accent="green">
          <Markdown>{content.applications_md}</Markdown>
        </Section>
      )}

      {/* ---------- 8. CHALLENGES ---------- */}
      {content.challenges_md && (
        <Section icon={AlertTriangle} title="Challenges" accent="red">
          <Markdown>{content.challenges_md}</Markdown>
        </Section>
      )}

      {/* ---------- 9. BEST PRACTICES ---------- */}
      {content.best_practices_md && (
        <Section icon={Wrench} title="Best Practices" accent="green">
          <Markdown>{content.best_practices_md}</Markdown>
        </Section>
      )}

      {/* ---------- 10. RELATED TOPICS (clickable) ---------- */}
      {content.related_topics_md && (
        <Section icon={Link2} title="Related Topics to Explore" accent="purple">
          <p className="rt-hint" data-html2canvas-ignore="true">
            Click any topic to open a full learning page on it.
          </p>
          <RelatedTopics markdown={content.related_topics_md} />
        </Section>
      )}

      {/* ---------- BOTTOM CTA ---------- */}
      <div className="topic-cta" data-html2canvas-ignore="true">
        <div>
          <h3>Ready to test your understanding?</h3>
          <p>
            Take a short test to see what stuck and what needs another look.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => navigate(`/quiz?topic=${id}`)}
        >
          <Play size={16} />
          Start Test
        </button>
      </div>

      {/* ---------- CONCEPT MODAL ---------- */}
      {activeConcept && (
        <ConceptModal
          concept={activeConcept}
          onClose={() => setActiveConcept(null)}
        />
      )}
    </div>
  );
}

/* ---------- Reusable Section ---------- */
function Section({ icon: Icon, title, accent, children }) {
  return (
    <section className="topic-section">
      <div className="section-heading">
        <div className={`section-heading-icon accent-${accent}`}>
          <Icon size={16} />
        </div>
        <h2 className="section-heading-text">{title}</h2>
      </div>
      <div className="section-body">{children}</div>
    </section>
  );
}