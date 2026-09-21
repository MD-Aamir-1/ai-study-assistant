import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";
import {
  Copy,
  Check,
  RotateCw,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import "./ChatMessageView.css";

function CodeBlock({ inline, className, children, ...props }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (inline) {
    return (
      <code className="inline-code" {...props}>
        {children}
      </code>
    );
  }

  const match = /language-(\w+)/.exec(className || "");
  const language = match?.[1] || "text";
  const code = String(children).replace(/\n$/, "");
  const lines = code.split("\n");
  const isLong = lines.length > 20;

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang">{language}</span>
        <div className="code-block-actions">
          {isLong && (
            <button
              type="button"
              className="code-action-btn"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          )}
          <button type="button" className="code-action-btn" onClick={copy}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre className={`code-block-body ${!expanded && isLong ? "collapsed" : ""}`}>
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export default function ChatMessageView({
  message,
  onRegenerate,
  onEdit,
  onFeedback,
  onDelete,
  isStreaming,
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const copy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const submitEdit = () => {
    if (draft.trim() && draft.trim() !== message.content.trim()) {
      onEdit?.(message.id, draft.trim());
    }
    setEditing(false);
  };

  return (
    <div className={`msg-row ${isUser ? "msg-user" : "msg-assistant"}`}>
      <div className="msg-bubble">
        {editing ? (
          <div className="msg-edit">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              autoFocus
            />
            <div className="msg-edit-actions">
              <button type="button" className="btn-xs" onClick={() => setEditing(false)}>
                <X size={12} /> Cancel
              </button>
              <button
                type="button"
                className="btn-xs btn-xs-primary"
                onClick={submitEdit}
              >
                <Check size={12} /> Save & Resend
              </button>
            </div>
          </div>
        ) : (
          <>
            {isAssistant && !message.content && isStreaming ? (
              <div className="msg-typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            ) : (
              <div className="msg-content">
                {isUser ? (
                  <p className="msg-user-text">{message.content}</p>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex, rehypeHighlight]}
                    components={{ code: CodeBlock }}
                  >
                    {message.content}
                  </ReactMarkdown>
                )}
              </div>
            )}

            {isAssistant && message.content && !isStreaming && (
              <div className="msg-actions">
                <button
                  type="button"
                  className="msg-action"
                  onClick={copy}
                  title="Copy"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
                {onRegenerate && (
                  <button
                    type="button"
                    className="msg-action"
                    onClick={() => onRegenerate(message.id)}
                    title="Regenerate"
                  >
                    <RotateCw size={13} />
                  </button>
                )}
                {onFeedback && (
                  <>
                    <button
                      type="button"
                      className={`msg-action ${message.feedback === "up" ? "active" : ""}`}
                      onClick={() =>
                        onFeedback(message.id, message.feedback === "up" ? "" : "up")
                      }
                      title="Good response"
                    >
                      <ThumbsUp size={13} />
                    </button>
                    <button
                      type="button"
                      className={`msg-action ${message.feedback === "down" ? "active down" : ""}`}
                      onClick={() =>
                        onFeedback(message.id, message.feedback === "down" ? "" : "down")
                      }
                      title="Bad response"
                    >
                      <ThumbsDown size={13} />
                    </button>
                  </>
                )}
                {onDelete && (
                  <button
                    type="button"
                    className="msg-action"
                    onClick={() => onDelete(message.id)}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )}

            {isUser && !isStreaming && (
              <div className="msg-actions">
                <button
                  type="button"
                  className="msg-action"
                  onClick={copy}
                  title="Copy"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
                {onEdit && (
                  <button
                    type="button"
                    className="msg-action"
                    onClick={() => {
                      setDraft(message.content);
                      setEditing(true);
                    }}
                    title="Edit & resend"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}