"""
Generates focused, deep-dive content for a single concept.
Uses fast model + per-concept lock + text normalizer.
"""

import json
import threading
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import models
from services.llm import call_llm_json, FAST_MODEL, DEFAULT_MODEL


_concept_locks: dict[int, threading.Lock] = {}
_locks_guard = threading.Lock()


def _get_concept_lock(concept_id: int) -> threading.Lock:
    with _locks_guard:
        if concept_id not in _concept_locks:
            _concept_locks[concept_id] = threading.Lock()
        return _concept_locks[concept_id]


def _normalize_text(value):
    """Convert literal \\n escapes into real newlines (recursive)."""
    if isinstance(value, str):
        s = value.replace("\\\\n", "\n")
        s = s.replace("\\n", "\n")
        s = s.replace("\\\\t", "\t")
        s = s.replace("\\t", "\t")
        s = s.replace("\\\\r", "")
        s = s.replace("\\r", "")
        return s
    if isinstance(value, list):
        return [_normalize_text(v) for v in value]
    if isinstance(value, dict):
        return {k: _normalize_text(v) for k, v in value.items()}
    return value


CONCEPT_SYSTEM_PROMPT = (
    "You are an expert educator producing focused, deep-dive explanations "
    "of individual concepts. You adapt your examples to the nature of the "
    "concept — code only when the concept is programming-related; otherwise "
    "use real-world scenarios, analogies, or step-by-step reasoning. "
    "You always respond with valid JSON only. No markdown fences, no prose. "
    "CRITICAL: Use REAL newline characters in markdown text — never escape them as \\\\n."
)


CONCEPT_CONTENT_PROMPT = """Write a focused, deep-dive explanation of the concept "{concept}" from the topic "{topic}" (subject: "{subject}", difficulty: {difficulty}).

Context: {description}

Rules:
- Dive deep into THIS concept only
- Beginner-friendly but technically accurate
- Return ONLY valid JSON
- Use REAL newline characters in markdown text, not \\\\n escapes

═══════════════════════════════════════════════
CONCRETE EXAMPLE — MATCH THE TOPIC
═══════════════════════════════════════════════

The "concrete_example" field MUST match the nature of the concept.
DO NOT default to code. Choose the right format:

▼ **Programming concepts** (functions, loops, OOP, APIs, data structures,
  libraries, frameworks, algorithms you'd implement):
  → Use code with a fenced block (```python, ```cpp, etc.)
  → Walk through the code line by line briefly.

▼ **Mathematical / ML theory concepts** (hyperplane, margin, gradient,
  bias-variance, loss function, derivative, probability):
  → Use a NUMERICAL worked example with simple numbers.
  → Show the setup, apply the formula step by step, arrive at a result.
  → Use a small table if comparing values.
  → Only use code if there is a directly applicable, standard library call —
    and even then, keep it minimal (5 lines max) with heavy prose explanation.

▼ **Abstract / conceptual ideas** (recursion, polymorphism, cache coherency,
  deadlock, virtual memory, kernel functions, ensemble learning):
  → Use a REAL-WORLD ANALOGY or SCENARIO.
  → Example: "Imagine three friends sharing a single notebook..."
  → Walk through the analogy step by step.
  → Then map it back to the technical concept.

▼ **Process / workflow concepts** (compilation, TCP handshake, scheduling):
  → Use a STEP-BY-STEP narrated walkthrough.
  → Numbered steps. Concrete actors (client/server, process A/B).
  → Show what happens at each stage.

RULES:
- If the concept is NOT clearly programming-related, DO NOT use code.
- A numerical example with 5 concrete numbers is often better than 20 lines of code.
- A relatable real-world analogy is often better than both.
- Match the learner's level ({difficulty}) — beginners need analogies and simple numbers, not production code.

═══════════════════════════════════════════════
MARKDOWN FORMATTING
═══════════════════════════════════════════════

For concrete_example, use rich markdown:
- ## <short descriptive title>
- 1-2 sentence intro explaining what we're about to do
- Then use ### Step 1, ### Step 2, ... OR ### Case 1, ### Case 2
- Use **bold** for key terms, `code` for inline formulas/identifiers
- Use $$...$$ on its own line for display math (never $...$ inline)
- Use bullet lists sparingly
- Only use fenced code blocks when the concept is genuinely programming-related

Do NOT include a summary table.

═══════════════════════════════════════════════
SCHEMA
═══════════════════════════════════════════════

{{
  "summary": "1-2 sentence essence",
  "why_it_matters": "2-3 sentences",
  "deep_explanation": "6-8 sentence explanation",
  "how_it_works": ["step 1", "step 2", "step 3"],
  "intuition": "an analogy that makes it click",
  "concrete_example": "markdown example (see above — match the topic)",
  "common_pitfalls": ["pitfall 1", "pitfall 2", "pitfall 3"],
  "connections": ["related concept 1", "related concept 2"],
  "quick_check": "one short question"
}}

Keep it concise: 400-600 words total.
"""


def generate_concept_content(
    concept_name: str,
    description: str,
    topic_name: str,
    subject_name: str,
    difficulty: str,
) -> dict:
    prompt = CONCEPT_CONTENT_PROMPT.format(
        concept=concept_name,
        description=description or "No additional description.",
        topic=topic_name,
        subject=subject_name,
        difficulty=difficulty,
    )

    try:
        content = call_llm_json(
            prompt,
            system=CONCEPT_SYSTEM_PROMPT,
            temperature=0.7,
            max_tokens=2500,
            model=FAST_MODEL,
        )
    except Exception:
        content = call_llm_json(
            prompt,
            system=CONCEPT_SYSTEM_PROMPT,
            temperature=0.7,
            max_tokens=2500,
            model=DEFAULT_MODEL,
        )

    if not isinstance(content, dict) or "summary" not in content:
        raise RuntimeError("LLM returned malformed concept content")

    content = _normalize_text(content)
    return content


def get_or_create_concept_content(concept_id: int, db: Session, force: bool = False) -> dict:
    concept = db.query(models.Concept).filter(models.Concept.id == concept_id).first()
    if not concept:
        raise ValueError(f"Concept {concept_id} not found")

    if not force:
        cached = (
            db.query(models.ConceptContent)
            .filter(models.ConceptContent.concept_id == concept_id)
            .first()
        )
        if cached:
            try:
                data = json.loads(cached.content_json)
                return _normalize_text(data)
            except json.JSONDecodeError:
                db.delete(cached)
                db.commit()

    lock = _get_concept_lock(concept_id)
    with lock:
        db.expire_all()

        if not force:
            cached = (
                db.query(models.ConceptContent)
                .filter(models.ConceptContent.concept_id == concept_id)
                .first()
            )
            if cached:
                try:
                    data = json.loads(cached.content_json)
                    return _normalize_text(data)
                except json.JSONDecodeError:
                    db.delete(cached)
                    db.commit()

        if force:
            existing = (
                db.query(models.ConceptContent)
                .filter(models.ConceptContent.concept_id == concept_id)
                .first()
            )
            if existing:
                db.delete(existing)
                db.commit()

        topic = db.query(models.Topic).filter(models.Topic.id == concept.topic_id).first()
        if not topic:
            raise ValueError("Topic missing for concept")
        subject = (
            db.query(models.Subject)
            .filter(models.Subject.id == topic.subject_id)
            .first()
        )
        subject_name = subject.name if subject else "General"

        content = generate_concept_content(
            concept_name=concept.name,
            description=concept.description or "",
            topic_name=topic.name,
            subject_name=subject_name,
            difficulty=topic.difficulty or "medium",
        )

        record = models.ConceptContent(
            concept_id=concept_id,
            content_json=json.dumps(content),
            model_version=f"{FAST_MODEL} (with {DEFAULT_MODEL} fallback)",
        )
        db.add(record)

        try:
            db.commit()
            db.refresh(record)
        except IntegrityError:
            db.rollback()
            existing = (
                db.query(models.ConceptContent)
                .filter(models.ConceptContent.concept_id == concept_id)
                .first()
            )
            if existing:
                try:
                    data = json.loads(existing.content_json)
                    return _normalize_text(data)
                except json.JSONDecodeError:
                    pass
            raise

        return content


def invalidate_concept_content(concept_id: int, db: Session) -> bool:
    record = (
        db.query(models.ConceptContent)
        .filter(models.ConceptContent.concept_id == concept_id)
        .first()
    )
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True