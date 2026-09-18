import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const A4 = {
  width: 210,
  height: 297,
  margin: 12,
  footerHeight: 12,
};

/**
 * Detect if user is on a small screen where PDF text needs to be larger.
 * A4 shrunk to ~70mm on phone = 33% zoom → 12pt feels like 4pt.
 */
function getFontScale() {
  const isMobileUA =
    /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
      navigator.userAgent
    );
  const width = window.innerWidth;

  if (isMobileUA || width < 500) return 2.0;
  if (width < 900) return 1.6;
  return 1.0;
}

export async function exportElementToPdf(sourceElement, filename, opts = {}) {
  if (!sourceElement) throw new Error("Nothing to export");

  const { title = "Study Material" } = opts;
  const scale = getFontScale();

  const wrapper = document.createElement("div");
  wrapper.className = "pdf-export-wrapper";
  wrapper.style.cssText = `
    position: fixed;
    left: -99999px;
    top: 0;
    width: 780px;
    background: #ffffff;
    padding: 0;
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #0f172a;
    font-size: ${18 * scale}px;
    line-height: 1.7;
    --pdf-scale: ${scale};
  `;

  const cleanupStyle = document.createElement("style");
  cleanupStyle.textContent = `
    .pdf-export-wrapper * {
      box-shadow: none !important;
      text-shadow: none !important;
      filter: none !important;
    }
    .pdf-export-wrapper [data-html2canvas-ignore="true"] { display: none !important; }

    .pdf-export-wrapper .mermaid-wrap,
    .pdf-export-wrapper .mermaid-fallback,
    .pdf-export-wrapper .ai-diagram-wrap,
    .pdf-export-wrapper .ai-diagram-frame,
    .pdf-export-wrapper .ai-diagram-empty,
    .pdf-export-wrapper .diagram-caption { display: none !important; }

    .pdf-export-wrapper .topic-section:has(.mermaid-wrap),
    .pdf-export-wrapper .topic-section:has(.mermaid-fallback),
    .pdf-export-wrapper .topic-section:has(.ai-diagram-wrap),
    .pdf-export-wrapper .topic-section:has(.ai-diagram-frame) {
      display: none !important;
    }

    /* Section boxes stripped */
    .pdf-export-wrapper .topic-section,
    .pdf-export-wrapper .topic-concepts-strip,
    .pdf-export-wrapper .topic-cta,
    .pdf-export-wrapper .cm-section,
    .pdf-export-wrapper .cm-quick-check,
    .pdf-export-wrapper .ai-reco-card,
    .pdf-export-wrapper .topic-highlight-block,
    .pdf-export-wrapper .cm-example-wrap,
    .pdf-export-wrapper .topic-code-wrap,
    .pdf-export-wrapper .topic-summary-block,
    .pdf-export-wrapper .topic-intuition-block,
    .pdf-export-wrapper .topic-takeaways {
      background: transparent !important;
      border: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
      margin: 0 0 calc(20px * var(--pdf-scale, 1)) 0 !important;
    }
    .pdf-export-wrapper .section-body { padding-left: 0 !important; }
    .pdf-export-wrapper .section-heading-icon { display: none !important; }
    .pdf-export-wrapper .section-heading {
      margin: 0 0 calc(10px * var(--pdf-scale, 1)) 0 !important;
    }
    .pdf-export-wrapper .section-heading-text {
      font-size: calc(19px * var(--pdf-scale, 1)) !important;
      font-weight: 800 !important;
      color: #0f172a !important;
      padding-bottom: calc(5px * var(--pdf-scale, 1)) !important;
      border-bottom: calc(1.5px * var(--pdf-scale, 1)) solid #cbd5e1 !important;
    }

    /* Concept chips */
    .pdf-export-wrapper .concept-chips { display: block !important; }
    .pdf-export-wrapper .concept-chip {
      display: inline !important;
      background: transparent !important;
      border: none !important;
      padding: 0 !important;
      margin: 0 !important;
      border-radius: 0 !important;
    }
    .pdf-export-wrapper .concept-chip-name {
      font-weight: 600 !important;
      color: #0f172a !important;
      font-size: calc(15px * var(--pdf-scale, 1)) !important;
    }
    .pdf-export-wrapper .concept-chip-name::after { content: ", " !important; }
    .pdf-export-wrapper .concept-chip:last-child .concept-chip-name::after { content: "" !important; }
    .pdf-export-wrapper .concept-chip-imp { display: none !important; }
    .pdf-export-wrapper .strip-title {
      font-size: calc(14px * var(--pdf-scale, 1)) !important;
      color: #475569 !important;
      margin-bottom: calc(6px * var(--pdf-scale, 1)) !important;
      text-transform: uppercase !important;
      font-weight: 700 !important;
    }

    /* Related topics */
    .pdf-export-wrapper .rt-grid { display: block !important; }
    .pdf-export-wrapper .rt-card {
      display: block !important;
      background: transparent !important;
      border: none !important;
      padding: calc(3px * var(--pdf-scale, 1)) 0 !important;
      margin: 0 !important;
      text-align: left !important;
    }
    .pdf-export-wrapper .rt-card-icon,
    .pdf-export-wrapper .rt-card-arrow { display: none !important; }
    .pdf-export-wrapper .rt-card-body { display: block !important; }
    .pdf-export-wrapper .rt-card-name {
      display: inline !important;
      font-size: calc(17px * var(--pdf-scale, 1)) !important;
      color: #0f172a !important;
      font-weight: 700 !important;
    }
    .pdf-export-wrapper .rt-card-name::after {
      content: " — " !important;
      font-weight: 400 !important;
      color: #475569 !important;
    }
    .pdf-export-wrapper .rt-card-desc {
      display: inline !important;
      font-size: calc(17px * var(--pdf-scale, 1)) !important;
      color: #475569 !important;
    }
    .pdf-export-wrapper .rt-hint { display: none !important; }

    /* Clickable types */
    .pdf-export-wrapper .ct-link {
      color: #0f172a !important;
      text-decoration: none !important;
      font-weight: 700 !important;
      display: inline !important;
      font-size: calc(17px * var(--pdf-scale, 1)) !important;
    }
    .pdf-export-wrapper .ct-heading {
      font-size: calc(17px * var(--pdf-scale, 1)) !important;
      color: #0f172a !important;
      margin: 0 0 calc(4px * var(--pdf-scale, 1)) 0 !important;
    }
    .pdf-export-wrapper .ct-desc {
      font-size: calc(17px * var(--pdf-scale, 1)) !important;
      color: #475569 !important;
    }

    /* Hide buttons */
    .pdf-export-wrapper button,
    .pdf-export-wrapper .spin { display: none !important; }

    /* Markdown content */
    .pdf-export-wrapper .md-content {
      font-size: calc(17px * var(--pdf-scale, 1)) !important;
      line-height: 1.75 !important;
      color: #0f172a !important;
    }
    .pdf-export-wrapper .md-content h1,
    .pdf-export-wrapper .md-content h2 {
      font-size: calc(21px * var(--pdf-scale, 1)) !important;
      margin: calc(18px * var(--pdf-scale, 1)) 0 calc(10px * var(--pdf-scale, 1)) 0 !important;
      color: #0f172a !important;
      font-weight: 800 !important;
      line-height: 1.3 !important;
    }
    .pdf-export-wrapper .md-content h3,
    .pdf-export-wrapper .md-content h4 {
      font-size: calc(18px * var(--pdf-scale, 1)) !important;
      margin: calc(14px * var(--pdf-scale, 1)) 0 calc(6px * var(--pdf-scale, 1)) 0 !important;
      color: #0f172a !important;
      font-weight: 700 !important;
      line-height: 1.3 !important;
    }
    .pdf-export-wrapper .md-content p {
      margin: 0 0 calc(12px * var(--pdf-scale, 1)) 0 !important;
    }
    .pdf-export-wrapper .md-content ul,
    .pdf-export-wrapper .md-content ol {
      margin: 0 0 calc(12px * var(--pdf-scale, 1)) 0 !important;
      padding-left: calc(26px * var(--pdf-scale, 1)) !important;
    }
    .pdf-export-wrapper .md-content li {
      margin-bottom: calc(6px * var(--pdf-scale, 1)) !important;
      font-size: calc(17px * var(--pdf-scale, 1)) !important;
    }
    .pdf-export-wrapper .md-content strong {
      font-weight: 700 !important;
      color: #0f172a !important;
    }
    .pdf-export-wrapper .md-content code {
      background: #f1f5f9 !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 4px !important;
      padding: 1px calc(5px * var(--pdf-scale, 1)) !important;
      font-family: Consolas, Monaco, monospace !important;
      font-size: calc(15px * var(--pdf-scale, 1)) !important;
      color: #2563eb !important;
    }
    .pdf-export-wrapper .md-content pre {
      background: #f8fafc !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 8px !important;
      padding: calc(14px * var(--pdf-scale, 1)) calc(16px * var(--pdf-scale, 1)) !important;
      white-space: pre-wrap !important;
      word-wrap: break-word !important;
      font-size: calc(15px * var(--pdf-scale, 1)) !important;
      line-height: 1.6 !important;
      margin: calc(14px * var(--pdf-scale, 1)) 0 !important;
    }
    .pdf-export-wrapper .md-content pre code {
      background: transparent !important;
      border: none !important;
      padding: 0 !important;
      font-size: calc(15px * var(--pdf-scale, 1)) !important;
      color: #0f172a !important;
    }
    .pdf-export-wrapper .md-content blockquote {
      border-left: calc(4px * var(--pdf-scale, 1)) solid #2563eb !important;
      background: #f8fafc !important;
      padding: calc(10px * var(--pdf-scale, 1)) calc(16px * var(--pdf-scale, 1)) !important;
      margin: calc(12px * var(--pdf-scale, 1)) 0 !important;
      font-size: calc(17px * var(--pdf-scale, 1)) !important;
      color: #475569 !important;
    }
    .pdf-export-wrapper .md-content table {
      width: 100% !important;
      border-collapse: collapse !important;
      font-size: calc(16px * var(--pdf-scale, 1)) !important;
      margin: calc(14px * var(--pdf-scale, 1)) 0 !important;
    }
    .pdf-export-wrapper .md-content th,
    .pdf-export-wrapper .md-content td {
      border: 1px solid #e2e8f0 !important;
      padding: calc(8px * var(--pdf-scale, 1)) calc(10px * var(--pdf-scale, 1)) !important;
    }
    .pdf-export-wrapper .md-content th {
      background: #f1f5f9 !important;
      font-weight: 700 !important;
    }
    .pdf-export-wrapper .md-content .katex-display {
      margin: calc(16px * var(--pdf-scale, 1)) 0 !important;
      padding: calc(14px * var(--pdf-scale, 1)) calc(18px * var(--pdf-scale, 1)) !important;
      background: #f8fafc !important;
      border-radius: 8px !important;
      border: 1px solid #e2e8f0 !important;
      text-align: center !important;
    }
    .pdf-export-wrapper .md-content .katex-display > .katex {
      font-size: 1.3em !important;
    }
    .pdf-export-wrapper .md-content .katex {
      font-size: 1.15em !important;
    }
  `;
  wrapper.appendChild(cleanupStyle);

  const clonedContent = sourceElement.cloneNode(true);
  clonedContent.removeAttribute("data-html2canvas-ignore");
  clonedContent.style.cssText = "padding: 0; margin: 0; background: transparent;";
  wrapper.appendChild(clonedContent);

  document.body.appendChild(wrapper);

  try {
    const SECTION_SELECTORS = [
      ".topic-section", ".cm-section", ".topic-concepts-strip",
      ".rt-wrap", ".ai-reco-card",
    ];

    let blocks = [];
    for (const sel of SECTION_SELECTORS) {
      const found = clonedContent.querySelectorAll(sel);
      if (found.length > 0) {
        blocks = Array.from(found);
        break;
      }
    }
    if (blocks.length === 0) blocks = [clonedContent];

    blocks = blocks.filter((b) => {
      const txt = b.textContent?.trim();
      if (!txt || txt.length === 0) return false;
      const heading = b.querySelector(".section-heading-text, h2, h3");
      if (heading && heading.textContent.trim().toLowerCase() === "diagram") {
        return false;
      }
      return true;
    });

    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    });

    const pageWidth = A4.width;
    const pageHeight = A4.height;
    const margin = A4.margin;
    const footerH = A4.footerHeight;
    const usableW = pageWidth - margin * 2;
    const usableH = pageHeight - margin - footerH - margin;

    let cursorY = margin;
    let pageNum = 1;

    // ==================================================
    // LOGO — Graduation cap in rounded blue square
    // ==================================================
    const drawLogo = (x, y, size) => {
      pdf.setFillColor(99, 102, 241);
      pdf.roundedRect(x, y, size, size, size * 0.22, size * 0.22, "F");

      const cx = x + size / 2;
      const cy = y + size / 2 + size * 0.04;

      pdf.setFillColor(30, 30, 40);
      const capW = size * 0.34;
      const capH = size * 0.15;

      const pts = [
        { x: cx - capW, y: cy - capH * 0.2 },
        { x: cx, y: cy - capH },
        { x: cx + capW, y: cy - capH * 0.2 },
        { x: cx, y: cy + capH * 0.6 },
      ];
      pdf.lines(
        [
          [pts[1].x - pts[0].x, pts[1].y - pts[0].y],
          [pts[2].x - pts[1].x, pts[2].y - pts[1].y],
          [pts[3].x - pts[2].x, pts[3].y - pts[2].y],
          [pts[0].x - pts[3].x, pts[0].y - pts[3].y],
        ],
        pts[0].x,
        pts[0].y,
        [1, 1],
        "F"
      );

      const baseW = size * 0.32;
      const baseH = size * 0.13;
      pdf.setFillColor(20, 20, 30);
      pdf.roundedRect(
        cx - baseW / 2,
        cy + capH * 0.4,
        baseW,
        baseH,
        0.4,
        0.4,
        "F"
      );

      pdf.setDrawColor(251, 191, 36);
      pdf.setFillColor(251, 191, 36);
      pdf.setLineWidth(0.35);

      const tasselStartX = cx + capW * 0.85;
      const tasselStartY = cy - capH * 0.15;
      const tasselEndY = cy + size * 0.28;

      pdf.line(tasselStartX, tasselStartY, tasselStartX, tasselEndY);
      pdf.circle(tasselStartX, tasselEndY + 0.4, size * 0.035, "F");
    };

    // ==================================================
    // HEADER
    // ==================================================
    const drawHeader = () => {
      const logoSize = 12;
      const logoX = margin;
      const logoY = margin;

      drawLogo(logoX, logoY, logoSize);

      // Brand text (scaled)
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9 * Math.min(scale, 1.4));
      pdf.setTextColor(139, 92, 246);
      pdf.text(
        "AI STUDY ASSISTANT",
        logoX + logoSize + 3,
        logoY + logoSize / 2 + 1.2
      );

      // Title (scaled, but capped so it doesn't overflow)
      const centerX = pageWidth / 2;
      const titleY = logoY + logoSize + 8;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(Math.min(22 * scale, 28));
      pdf.setTextColor(15, 23, 42);
      const maxTitleLen = scale > 1.5 ? 40 : 50;
      const shortTitle =
        title.length > maxTitleLen
          ? title.slice(0, maxTitleLen - 3) + "..."
          : title;
      const titleW = pdf.getTextWidth(shortTitle);
      pdf.text(shortTitle, centerX - titleW / 2, titleY);

      const dividerY = titleY + 4;
      pdf.setDrawColor(37, 99, 235);
      pdf.setLineWidth(0.4);
      pdf.line(margin, dividerY, pageWidth - margin, dividerY);

      cursorY = dividerY + 6;
    };

    const drawFooter = (num, total) => {
      const y = pageHeight - margin / 2 - 1;

      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(margin, y - 4, pageWidth - margin, y - 4);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9 * Math.min(scale, 1.4));
      pdf.setTextColor(148, 163, 184);

      pdf.text("AI Study Assistant", margin, y);

      const rightText = `Page ${num} of ${total}`;
      const rightWidth = pdf.getTextWidth(rightText);
      pdf.text(rightText, pageWidth - margin - rightWidth, y);

      const dateText = new Date().toLocaleDateString();
      const dateWidth = pdf.getTextWidth(dateText);
      pdf.text(dateText, pageWidth / 2 - dateWidth / 2, y);
    };

    drawHeader();

    // ==================================================
    // Render blocks
    // ==================================================
    for (const block of blocks) {
      const canvas = await html2canvas(block, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      if (canvas.width === 0 || canvas.height === 0) continue;

      const imgW = usableW;
      const imgH = (canvas.height / canvas.width) * imgW;
      const spaceLeft = margin + usableH - cursorY;

      if (imgH > spaceLeft && cursorY > margin + 5) {
        drawFooter(pageNum, "?");
        pdf.addPage();
        pageNum += 1;
        cursorY = margin;
      }

      let finalW = imgW;
      let finalH = imgH;
      if (finalH > usableH) {
        const s = usableH / finalH;
        finalH = usableH;
        finalW = imgW * s;
      }

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const xOffset = margin + (usableW - finalW) / 2;

      pdf.addImage(imgData, "JPEG", xOffset, cursorY, finalW, finalH, undefined, "FAST");
      cursorY += finalH + 8;
    }

    // Footers
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, pageHeight - footerH - 2, pageWidth, footerH + 2, "F");
      drawFooter(i, totalPages);
    }

    pdf.save(filename);
  } finally {
    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
  }
}

export async function exportAnswerAsPdf({ title, subtitle, sourceElement, filename }) {
  return exportElementToPdf(sourceElement, filename, { title, subtitle });
}