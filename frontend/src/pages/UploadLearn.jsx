import { useRef, useState } from "react";
import { extractFile, learnFromText } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Markdown from "../components/Markdown";
import { exportAnswerAsPdf } from "../utils/pdfExport";
import "../components/Markdown.css";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  FileType2,
  X,
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Zap,
  BookOpen,
  HelpCircle,
  ListChecks,
  Download,
} from "lucide-react";
import "./UploadLearn.css";

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.csv";

const QUICK_ACTIONS = [
  {
    icon: BookOpen,
    label: "Full GFG-Style Tutorial",
    instruction:
      "Write a comprehensive, GFG-quality tutorial on the main topic in this text. Include: what it is, why it matters, how it works step by step, types/variants, real-world examples, a worked example with numbers, advantages, disadvantages, common mistakes, comparison with alternatives, key takeaways, and practice problems. Aim for 2000-4000 words.",
  },
  {
    icon: HelpCircle,
    label: "Answer This Question",
    instruction:
      "Answer the question in this text with detailed reasoning. Show your steps clearly. Then explain the underlying concept in depth as if teaching a beginner, and end with 2 similar practice problems.",
  },
  {
    icon: ListChecks,
    label: "Summarize & Expand",
    instruction:
      "First, give me a concise summary in 5-7 bullets. Then, for each bullet, write a detailed paragraph explaining the underlying concept as if I've never studied it before. Include one concrete example per bullet.",
  },
  {
    icon: Zap,
    label: "Explain Like I'm 5",
    instruction:
      "Explain the main concept in this text using the simplest possible language, real-world analogies, and concrete everyday examples. Structure it as a story that builds up the concept gradually. End with a simple Q&A to check understanding.",
  },
];

export default function UploadLearn() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const answerRef = useRef(null);

  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [extractionInfo, setExtractionInfo] = useState(null);
  const [instruction, setInstruction] = useState("");
  const [answer, setAnswer] = useState("");
  const [copied, setCopied] = useState(false);

  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  // ---------- File handling ----------
  const handleFile = async (f) => {
    if (!f) return;
    setError("");
    setAnswer("");
    setExtractedText("");
    setExtractionInfo(null);
    setFile(f);
    setExtracting(true);

    try {
      const res = await extractFile(f);
      setExtractedText(res.data.text);
      setExtractionInfo({
        source_type: res.data.source_type,
        pages: res.data.pages,
        char_count: res.data.char_count,
      });
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not extract text from this file. Try a different format."
      );
      setFile(null);
    } finally {
      setExtracting(false);
    }
  };

  const onInputChange = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const clearFile = () => {
    setFile(null);
    setExtractedText("");
    setExtractionInfo(null);
    setAnswer("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ---------- Generation ----------
  const handleGenerate = async () => {
    const text = extractedText.trim();
    const ins = instruction.trim();

    if (!ins) {
      setError("Please tell the AI what to do with this text.");
      return;
    }

    setGenerating(true);
    setError("");
    setAnswer("");

    try {
      const res = await learnFromText(text, ins, user?.student_id);
      setAnswer(res.data.answer);
    } catch (err) {
      setError(err.response?.data?.detail || "Generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  const useQuickAction = (action) => {
    setInstruction(action.instruction);
  };

  // ---------- Copy ----------
  const copyAnswer = async () => {
    if (!answer) return;
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  // ---------- PDF Export ----------
  const downloadPdf = async () => {
  if (!answerRef.current || !answer) return;
  setExporting(true);
  setError("");
  try {
    // Use a meaningful title instead of the raw filename
    const instructionPreview = instruction
      ? instruction.length > 140
        ? instruction.slice(0, 137) + "..."
        : instruction
      : "AI-generated response";

    await exportAnswerAsPdf({
      title: "AI Study Assistant",
      subtitle: instructionPreview,
      sourceElement: answerRef.current,
      filename: `study-assistant-${Date.now()}.pdf`,
    });
  } catch (err) {
    console.error(err);
    setError("PDF export failed. Try again.");
  } finally {
    setExporting(false);
  }
};

  const getFileIcon = (name = "") => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileType2 size={18} />;
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext))
      return <ImageIcon size={18} />;
    return <FileText size={18} />;
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="upload-page">
      <div className="upload-header">
        <h1 className="upload-title">Upload & Learn</h1>
        <p className="upload-subtitle">
          Upload a PDF, image, or text file. Extract the content and turn it into
          a lesson, an answer, or a summary.
        </p>
      </div>

      {error && (
        <div className="upload-error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* ---------- UPLOAD ZONE ---------- */}
      {!file && (
        <div
          className={`dropzone ${dragActive ? "active" : ""}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="dropzone-icon">
            <Upload size={28} />
          </div>
          <h3>Drop your file here</h3>
          <p>or click to browse</p>
          <p className="dropzone-formats">
            PDF · PNG · JPG · WEBP · GIF · TXT · MD · CSV — max 10 MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            onChange={onInputChange}
            style={{ display: "none" }}
          />
        </div>
      )}

      {/* ---------- FILE CARD ---------- */}
      {file && (
        <div className="file-card">
          <div className="file-card-icon">{getFileIcon(file.name)}</div>
          <div className="file-card-body">
            <div className="file-card-name">{file.name}</div>
            <div className="file-card-meta">
              {formatBytes(file.size)}
              {extractionInfo && (
                <>
                  {" · "}
                  <span className="file-card-tag">
                    {extractionInfo.source_type === "pdf"
                      ? `${extractionInfo.pages} pages`
                      : extractionInfo.source_type === "image"
                      ? "image OCR"
                      : "text"}
                  </span>
                  {" · "}
                  {extractionInfo.char_count.toLocaleString()} chars
                </>
              )}
            </div>
          </div>
          {extracting && (
            <div className="file-card-status">
              <Loader2 size={16} className="spin" /> Extracting...
            </div>
          )}
          <button
            className="file-card-remove"
            onClick={clearFile}
            title="Remove file"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* ---------- EXTRACTED TEXT PREVIEW ---------- */}
      {extractedText && (
        <div className="extracted-section">
          <div className="extracted-header">
            <h2 className="extracted-title">
              <FileText size={16} /> Extracted Text
            </h2>
            <span className="extracted-count">
              {extractedText.length.toLocaleString()} characters
            </span>
          </div>
          <div className="extracted-body">
            <textarea
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              rows={8}
            />
          </div>
          <p className="extracted-hint">
            You can edit the text above before generating.
          </p>
        </div>
      )}

      {/* ---------- INSTRUCTION + QUICK ACTIONS ---------- */}
      {extractedText && (
        <div className="instruction-section">
          <h2 className="instruction-title">
            <Sparkles size={16} /> What should the AI do?
          </h2>

          <div className="quick-actions">
            {QUICK_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.label}
                  type="button"
                  className="quick-action"
                  onClick={() => useQuickAction(a)}
                >
                  <Icon size={14} />
                  {a.label}
                </button>
              );
            })}
          </div>

          <textarea
            className="instruction-input"
            placeholder="Or type your own instruction... e.g., 'Give me 5 practice questions on this topic'"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={3}
          />

          <button
            className="btn-primary generate-btn"
            onClick={handleGenerate}
            disabled={generating || !instruction.trim()}
          >
            {generating ? (
              <>
                <Loader2 size={14} className="spin" /> Generating (this may take
                30-60 sec)...
              </>
            ) : (
              <>
                <Sparkles size={14} /> Generate Content
              </>
            )}
          </button>
        </div>
      )}

      {/* ---------- RESULT ---------- */}
      {answer && (
        <div className="result-section">
          <div className="result-header">
            <h2 className="result-title">
              <Sparkles size={16} /> AI Response
            </h2>
            <div className="result-actions">
              <button className="btn-secondary" onClick={copyAnswer}>
                {copied ? (
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
                onClick={downloadPdf}
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 size={14} className="spin" /> Preparing...
                  </>
                ) : (
                  <>
                    <Download size={14} /> PDF
                  </>
                )}
              </button>
              <button
                className="btn-secondary"
                onClick={handleGenerate}
                disabled={generating}
              >
                <RefreshCw size={14} className={generating ? "spin" : ""} />
                Regenerate
              </button>
            </div>
          </div>

          <div className="result-body" ref={answerRef}>
            <Markdown>{answer}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}