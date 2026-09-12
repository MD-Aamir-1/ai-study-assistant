export default function Placeholder({ title }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius)",
        padding: "60px 40px",
        textAlign: "center",
        border: "1px solid var(--border)",
      }}
    >
      <h2 style={{ marginTop: 0, color: "var(--text)" }}>{title}</h2>
      <p style={{ color: "var(--text-muted)" }}>
        This page is coming soon. We'll build it in a later phase.
      </p>
    </div>
  );
}