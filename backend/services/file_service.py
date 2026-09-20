"""
Extract text from uploaded files.

Supported:
- PDF (text-based) — via pypdf
- PDF (scanned)    — auto-fallback to page-image OCR via Groq Vision
- Images (png/jpg/webp/gif) — via Groq Vision
- DOCX             — via python-docx
- TXT/MD/CSV       — direct decode
"""

import io
import base64
import time
from pypdf import PdfReader
from ai_tutor import get_client

# Optional: PyMuPDF for scanned PDFs
try:
    import pymupdf  # new module name (fitz is deprecated)
    HAS_FITZ = True
except ImportError:
    try:
        import fitz  # fallback for older versions
        HAS_FITZ = True
    except ImportError:
        HAS_FITZ = False

# Optional: python-docx for Word files
try:
    from docx import Document
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False


# ==================================================
# MIME / extension classification
# ==================================================
IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
TEXT_TYPES = {"text/plain", "text/markdown", "text/csv"}
PDF_TYPES = {"application/pdf"}
DOCX_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}

# Groq vision model rotation
VISION_MODELS = [
    "qwen/qwen3.6-27b",
    "qwen/qwen3.8-27b",
]

# Free-tier Groq limit: 1000 output tokens/minute per model.
# Keep each call safely under that.
VISION_MAX_TOKENS = 900

# Delay between OCR calls to stay under rate limit
PAGE_DELAY_SECONDS = 1.5


# ==================================================
# PDF: text-based
# ==================================================
def extract_from_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = []
    for i, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        if text.strip():
            pages.append(f"--- Page {i + 1} ---\n{text.strip()}")
    return "\n\n".join(pages)


# ==================================================
# PDF: scanned → render pages to images, then OCR
# ==================================================
def _extract_pdf_via_vision(file_bytes: bytes, max_pages: int = 15) -> str:
    """
    Renders each PDF page as a PNG and OCRs it via Groq Vision.
    Used when the PDF has no embedded text.
    """
    if not HAS_FITZ:
        raise RuntimeError(
            "Scanned PDF detected but PyMuPDF isn't installed. "
            "Run: pip install PyMuPDF"
        )

    # Support both pymupdf and fitz
    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except NameError:
        doc = fitz.open(stream=file_bytes, filetype="pdf")

    total = len(doc)
    limit = min(total, max_pages)

    pages_text = []
    for page_num in range(limit):
        # ---- Delay before each page (except the first) to respect rate limit ----
        if page_num > 0:
            time.sleep(PAGE_DELAY_SECONDS)

        page = doc[page_num]
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")

        try:
            text = extract_from_image(img_bytes, "image/png")
        except Exception as e:
            text = f"(OCR failed for page {page_num + 1}: {e})"

        if text and text.strip():
            pages_text.append(f"--- Page {page_num + 1} ---\n{text.strip()}")

    doc.close()

    result = "\n\n".join(pages_text)
    if total > limit:
        result += (
            f"\n\n[... {total - limit} more pages not processed — "
            f"limit is {limit} pages for OCR ...]"
        )

    return result


# ==================================================
# Images
# ==================================================
def _call_vision(model: str, data_url: str) -> str:
    client = get_client()
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You extract text from images. Return ONLY the extracted text "
                    "with no commentary, no markdown fences, no labels. "
                    "Preserve structure: headings, lists, and question numbering. "
                    "If the image has no readable text, return an empty string."
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Extract all text from this image exactly as it appears.",
                    },
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
        temperature=0.1,
        max_tokens=VISION_MAX_TOKENS,
    )
    return (response.choices[0].message.content or "").strip()


def extract_from_image(file_bytes: bytes, mime_type: str) -> str:
    b64 = base64.b64encode(file_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64}"

    last_error = None
    for model in VISION_MODELS:
        # Try twice per model (once, then again after a delay on 429)
        for attempt in (1, 2):
            try:
                text = _call_vision(model, data_url)
                if text:
                    return text
                last_error = RuntimeError("Model returned empty text")
                break  # try next model
            except Exception as e:
                last_error = e
                err_str = str(e)
                if "rate_limit" in err_str.lower() or "429" in err_str:
                    if attempt == 1:
                        # Wait then retry same model
                        print(f"[file_service] Rate limit hit — waiting 5s before retry...")
                        time.sleep(5)
                        continue
                # Not a rate limit or 2nd attempt → try next model
                break

    raise RuntimeError(f"Image extraction failed. Last error: {last_error}")


# ==================================================
# DOCX
# ==================================================
def extract_from_docx(file_bytes: bytes) -> str:
    if not HAS_DOCX:
        raise RuntimeError(
            "DOCX support not installed. Run: pip install python-docx"
        )

    doc = Document(io.BytesIO(file_bytes))
    parts = []

    for p in doc.paragraphs:
        text = p.text.strip()
        if text:
            parts.append(text)

    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells]
            row_text = " | ".join(cells).strip()
            if row_text.replace("|", "").strip():
                parts.append(row_text)

    return "\n\n".join(parts)


# ==================================================
# Plain text
# ==================================================
def extract_from_text(file_bytes: bytes) -> str:
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise RuntimeError("Could not decode the text file.")


# ==================================================
# Router
# ==================================================
def extract_text(file_bytes: bytes, mime_type: str, filename: str) -> dict:
    mime_type = (mime_type or "").lower()
    filename_lower = (filename or "").lower()
    ext = filename_lower.rsplit(".", 1)[-1] if "." in filename_lower else ""

    # ---------- PDF ----------
    if mime_type in PDF_TYPES or ext == "pdf":
        text = ""
        try:
            text = extract_from_pdf(file_bytes)
        except Exception as e:
            print(f"[file_service] pypdf failed: {e}")

        if not text.strip():
            print("[file_service] PDF has no embedded text — falling back to OCR.")
            text = _extract_pdf_via_vision(file_bytes)
            if not text.strip():
                raise RuntimeError(
                    "No text could be extracted from this PDF. "
                    "It may be blank, corrupted, or password-protected."
                )
            return {
                "text": text,
                "source_type": "pdf_scanned",
                "pages": text.count("--- Page"),
            }

        return {
            "text": text,
            "source_type": "pdf",
            "pages": text.count("--- Page"),
        }

    # ---------- DOCX ----------
    if mime_type in DOCX_TYPES or ext in ("docx", "doc"):
        text = extract_from_docx(file_bytes)
        if not text.strip():
            raise RuntimeError("This Word document has no readable text.")
        return {"text": text, "source_type": "docx", "pages": 1}

    # ---------- Image ----------
    if mime_type in IMAGE_TYPES or ext in ("jpg", "jpeg", "png", "webp", "gif"):
        text = extract_from_image(file_bytes, mime_type or "image/jpeg")
        return {"text": text, "source_type": "image", "pages": 1}

    # ---------- Plain text ----------
    if mime_type in TEXT_TYPES or ext in ("txt", "md", "csv"):
        text = extract_from_text(file_bytes)
        return {"text": text, "source_type": "text", "pages": 1}

    raise ValueError(
        f"Unsupported file type: {mime_type or filename}. "
        "Supported: PDF, DOCX, PNG, JPG, WEBP, GIF, TXT, MD, CSV."
    )