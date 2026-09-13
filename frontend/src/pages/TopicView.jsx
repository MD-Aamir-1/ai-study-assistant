import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getTopicFull, regenerateContent } from "../api/client";
import Markdown from "../components/Markdown";
import MermaidDiagram from "../components/MermaidDiagram";
import ConceptModal from "../components/ConceptModal";
import "../components/Markdown.css";
import {
  Sparkles,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  Target,
  AlertTriangle,
  Layers,
  BookOpen,
  Zap,
  Wrench,
  XCircle,
  Info,
  Play,
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
    if (!window.confirm("Regenerate content? This may take 20–30 seconds."))
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

  // ---------- LOADING ----------
  if (loading) {
    return (
      <div className="topic-loading">
        <div className="loading-spinner">
          <Sparkles size={28} />
        </div>
        <h2>Generating your learning content...</h2>
        <p>This takes about 15–25 seconds the first time.</p>
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
        <button className="btn-primary" onClick={() => navigate("/search")}>
          Back to Search
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { topic, content, concepts } = data;

  return (
    <div className="topic-view">
      {/* ---------- HEADER ---------- */}
      <div className="topic-header">
        <Link to="/search" className="topic-back">
          <ArrowLeft size={16} /> Back to Search
        </Link>

        <div className="topic-title-row">
          <div>
            <div className="topic-subject-tag">{topic.subject_name}</div>
            <h1 className="topic-title">{topic.name}</h1>
            <div className="topic-meta">
              <span className={`diff-pill diff-${topic.difficulty}`}>
                {topic.difficulty}
              </span>
              <span className="topic-meta-item">{concepts.length} concepts</span>
            </div>
          </div>

          <div className="topic-actions">
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

      {/* ---------- CONCEPT CHIPS ---------- */}
      <section className="topic-concepts-strip">
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

      {/* ---------- DEFINITION ---------- */}
      <Section icon={Info} title="Definition" accent="blue">
        <p className="topic-text">{content.definition}</p>
      </Section>

      {/* ---------- PURPOSE + PROBLEM ---------- */}
      <div className="two-col">
        <Section icon={Target} title="Purpose" accent="purple">
          <p className="topic-text">{content.purpose}</p>
        </Section>
        <Section icon={Wrench} title="Problem It Solves" accent="green">
          <p className="topic-text">{content.problem_solved}</p>
        </Section>
      </div>

      {/* ---------- CORE CONCEPT ---------- */}
      <Section icon={Zap} title="Core Concept" accent="orange">
        <p className="topic-text">{content.core_concept}</p>
      </Section>

      {/* ---------- HOW IT WORKS ---------- */}
      <Section icon={CheckCircle2} title="How It Works" accent="blue">
        <ol className="step-list">
          {(content.how_it_works || []).map((s, i) => (
            <li key={i}>
              <span className="step-num">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </Section>

      {/* ---------- INTUITION ---------- */}
      <Section icon={Lightbulb} title="Intuition" accent="yellow">
        <p className="topic-text topic-intuition">{content.intuition}</p>
      </Section>

      {/* ---------- DIAGRAM ---------- */}
      {content.diagram_mermaid && content.diagram_mermaid.trim() && (
        <Section icon={Layers} title="Diagram" accent="purple">
            <MermaidDiagram code={content.diagram_mermaid} />
            {content.diagram_caption && (
              <p className="diagram-caption">{content.diagram_caption}</p>
            )}
        </Section>
      )}

      {/* ---------- EXAMPLES ---------- */}
      <Section icon={BookOpen} title="Real-World Examples" accent="green">
        <ul className="bullet-list">
          {(content.real_world_examples || []).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </Section>

      <Section icon={Wrench} title="Technical Example" accent="blue">
        <div className="topic-code-wrap">
          <Markdown>{content.technical_example}</Markdown>
        </div>
      </Section>

      {/* ---------- TYPES ---------- */}
      {content.types && content.types.length > 0 && (
        <Section icon={Layers} title="Types" accent="purple">
          <div className="types-grid">
            {content.types.map((t, i) => (
              <div key={i} className="type-card">
                <div className="type-card-name">{t.name}</div>
                <div className="type-card-desc">{t.description}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ---------- COMPONENTS ---------- */}
      {content.components && content.components.length > 0 && (
        <Section icon={Zap} title="Key Components" accent="orange">
          <div className="chips-row">
            {content.components.map((c, i) => (
              <span key={i} className="mini-chip">
                {c}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ---------- APPLICATIONS ---------- */}
      <Section icon={Target} title="Applications" accent="green">
        <div className="chips-row">
          {(content.applications || []).map((a, i) => (
            <span key={i} className="mini-chip mini-chip-green">
              {a}
            </span>
          ))}
        </div>
      </Section>

      {/* ---------- ADVANTAGES + DISADVANTAGES ---------- */}
      <div className="two-col">
        <Section icon={CheckCircle2} title="Advantages" accent="green">
          <ul className="bullet-list bullet-check">
            {(content.advantages || []).map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Section>
        <Section icon={XCircle} title="Disadvantages" accent="red">
          <ul className="bullet-list bullet-cross">
            {(content.disadvantages || []).map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </Section>
      </div>

      {/* ---------- MISTAKES + MISCONCEPTIONS ---------- */}
      <div className="two-col">
        <Section icon={AlertTriangle} title="Common Mistakes" accent="orange">
          <ul className="bullet-list bullet-warn">
            {(content.common_mistakes || []).map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </Section>
        <Section icon={AlertTriangle} title="Misconceptions" accent="red">
          <ul className="bullet-list bullet-warn">
            {(content.misconceptions || []).map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </Section>
      </div>

      {/* ---------- PREREQUISITES ---------- */}
      {content.prerequisites && content.prerequisites.length > 0 && (
        <Section icon={Info} title="Prerequisites" accent="blue">
          <div className="chips-row">
            {content.prerequisites.map((p, i) => (
              <span key={i} className="mini-chip">
                {p}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ---------- SUMMARY ---------- */}
      <Section icon={Sparkles} title="Summary" accent="purple">
        <p className="topic-text topic-summary">{content.summary}</p>
      </Section>

      {/* ---------- BOTTOM CTA ---------- */}
      <div className="topic-cta">
        <div>
          <h3>Ready to test your understanding?</h3>
          <p>
            Take a conceptual test to identify exactly which concepts you've
            mastered and which need revision.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => navigate(`/quiz?topic=${id}`)}
        >
          <Play size={16} />
          Start Conceptual Test
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

/* ---------- Reusable Section Component ---------- */
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