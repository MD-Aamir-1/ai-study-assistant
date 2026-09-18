"""
Extract text from uploaded files.
- PDF: pypdf (pure Python)
- Images: Groq Vision (Qwen 3.6 27B multimodal)
- TXT/MD/CSV: direct read
"""

import io
import base64
from pypdf import PdfReader
from ai_tutor import get_client


IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
TEXT_TYPES = {"text/plain", "text/markdown", "text/csv"}
PDF_TYPES = {"application/pdf"}

# Current Groq vision models (as of Groq's latest docs)
# Primary + fallback in case one is temporarily unavailable
VISION_MODELS = [
    "qwen/qwen3.6-27b",
    "qwen/qwen3.8-27b",
]


def extract_from_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF using pypdf."""
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = []
    for i, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        if text.strip():
            pages.append(f"--- Page {i + 1} ---\n{text.strip()}")
    if not pages:
        raise RuntimeError(
            "No text found. The PDF may be a scanned image — try uploading it as an image instead."
        )
    return "\n\n".join(pages)


def _call_vision(model: str, data_url: str) -> str:
    """Single call to a specific Groq vision model."""
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
                    {
                        "type": "image_url",
                        "image_url": {"url": data_url},
                    },
                ],
            },
        ],
        temperature=0.1,
        max_tokens=2500,
    )
    return (response.choices[0].message.content or "").strip()


def extract_from_image(file_bytes: bytes, mime_type: str) -> str:
    """Extract text from an image using Groq Vision (with fallback model)."""
    b64 = base64.b64encode(file_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64}"

    last_error = None
    for model in VISION_MODELS:
        try:
            text = _call_vision(model, data_url)
            if text:
                return text
            last_error = RuntimeError("Model returned empty text")
        except Exception as e:
            last_error = e
            continue

    raise RuntimeError(
        f"Image extraction failed. Last error: {last_error}"
    )


def extract_from_text(file_bytes: bytes) -> str:
    """Decode plain text files."""
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise RuntimeError("Could not decode the text file.")


def extract_text(file_bytes: bytes, mime_type: str, filename: str) -> dict:
    """
    Route to the right extractor. Returns { text, source_type, pages }.
    """
    mime_type = (mime_type or "").lower()
    filename_lower = (filename or "").lower()

    if mime_type in PDF_TYPES or filename_lower.endswith(".pdf"):
        text = extract_from_pdf(file_bytes)
        return {"text": text, "source_type": "pdf", "pages": text.count("--- Page")}

    if mime_type in IMAGE_TYPES or filename_lower.rsplit(".", 1)[-1] in {
        "jpg", "jpeg", "png", "webp", "gif"
    }:
        text = extract_from_image(file_bytes, mime_type or "image/jpeg")
        return {"text": text, "source_type": "image", "pages": 1}

    if mime_type in TEXT_TYPES or filename_lower.endswith((".txt", ".md", ".csv")):
        text = extract_from_text(file_bytes)
        return {"text": text, "source_type": "text", "pages": 1}

    raise ValueError(
        f"Unsupported file type: {mime_type or filename}. "
        "Supported: PDF, PNG, JPG, WEBP, GIF, TXT, MD, CSV."
    )