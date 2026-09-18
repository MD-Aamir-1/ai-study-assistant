"""
Generates GFG-style content + concepts with speed optimizations.
Uses per-topic lock + text normalizer + LaTeX repair.
"""

import json
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
from services.llm import call_llm_json, FAST_MODEL, DEFAULT_MODEL


_topic_locks: dict[int, threading.Lock] = {}
_locks_guard = threading.Lock()


def _get_topic_lock(topic_id: int) -> threading.Lock:
    with _locks_guard:
        if topic_id not in _topic_locks:
            _topic_locks[topic_id] = threading.Lock()
        return _topic_locks[topic_id]


def _repair_latex(text: str) -> str:
    """
    Fix common LaTeX breakages from JSON escape collisions:
      TAB + 'ext'  →  '\\text'
      TAB + 'heta' →  '\\theta'
      etc.
    """
    if not isinstance(text, str):
        return text

    s = text

    # TAB → \t commands
    s = s.replace("\t" + "ext", r"\text")
    s = s.replace("\t" + "imes", r"\times")
    s = s.replace("\t" + "heta", r"\theta")
    s = s.replace("\t" + "anh", r"\tanh")
    s = s.replace("\t" + "an", r"\tan")
    s = s.replace("\t" + "op", r"\top")
    s = s.replace("\t" + "o", r"\to")
    s = s.replace("\t" + "ag", r"\tag")
    s = s.replace("\t" + "au", r"\tau")
    s = s.replace("\t" + "ilde", r"\tilde")

    # CR → \r commands
    s = s.replace("\r" + "ight", r"\right")
    s = s.replace("\r" + "angle", r"\rangle")
    s = s.replace("\r" + "floor", r"\rfloor")
    s = s.replace("\r" + "ceil", r"\rceil")
    s = s.replace("\r" + "ho", r"\rho")

    # LF → \n commands
    s = s.replace("\n" + "u", r"\nu")
    s = s.replace("\n" + "abla", r"\nabla")
    s = s.replace("\n" + "ewline", r"\newline")
    s = s.replace("\n" + "onumber", r"\nonumber")
    s = s.replace("\n" + "otin", r"\notin")
    s = s.replace("\n" + "eg", r"\neg")
    s = s.replace("\n" + "eq", r"\neq")

    # Fix "exts.t." mangled from "\text{s.t.}"
    s = re.sub(r"exts\.t\.", r"\\text{ s.t. }", s)
    s = re.sub(r"extfor([a-z]+)", r"\\text{ for \1}", s)

    # Collapse double-escaped commands
    s = s.replace(r"\\text", r"\text")
    s = s.replace(r"\\times", r"\times")
    s = s.replace(r"\\theta", r"\theta")

    return s


def _normalize_text(value):
    """Recursively normalize text: real newlines + LaTeX repair."""
    if isinstance(value, str):
        s = value.replace("\\\\n", "\n")
        s = s.replace("\\n", "\n")
        s = s.replace("\\\\t", "\t")
        s = s.replace("\\t", "\t")
        s = s.replace("\\\\r", "")
        s = s.replace("\\r", "")
        s = _repair_latex(s)
        return s
    if isinstance(value, list):
        return [_normalize_text(v) for v in value]
    if isinstance(value, dict):
        return {k: _normalize_text(v) for k, v in value.items()}
    return value


CONTENT_SYSTEM_PROMPT = (
    "You are a warm, patient teacher writing beginner-friendly educational articles "
    "in the style of GeeksforGeeks. Plain prose, real-world examples, no jargon without explanation. "
    "You NEVER invent content that doesn't naturally belong to a topic, "
    "and you NEVER omit well-known subtypes. "
    "Return ONLY valid JSON. No markdown fences, no prose outside JSON.\n\n"
    "CRITICAL LaTeX RULES for JSON output:\n"
    "- When writing LaTeX in JSON strings, ALWAYS double-escape backslashes.\n"
    "- Write double-backslash text, times, theta, alpha, beta, frac, sqrt — never single.\n"
    "- A single backslash becomes a tab or newline character in JSON and breaks the output.\n"
    "- Avoid complex LaTeX entirely when you can express it in plain words.\n"
    "- Prefer inline code like `y = mx + b` over complex math syntax."
)


CONTENT_PROMPT_TEMPLATE = """Write a beginner-friendly article about "{topic}" ({subject}, {difficulty}).

STYLE (match GeeksforGeeks):
- Plain prose paragraphs
- Warm, patient tone
- Start simple, then go deeper
- Use REAL newline characters, not backslash-n escapes

DEFINITION STYLE (intro_md):
Paragraph 1: One clear sentence defining the topic. Then "In simple words, ..." then why it matters with 2-3 real-world examples.
Paragraph 2 (optional): Deeper definition.

MATH — KEEP IT SIMPLE:
- Simple formulas: use backticks like `y = mx + b`
- Real formulas on their own line: use $$...$$
- In JSON, write backslashes DOUBLED.
- Prefer words over symbols. Example: say "sum of squared errors" instead of sigma notation.
- Avoid complex LaTeX commands unless absolutely needed.

BULLET LISTS — CRITICAL FORMATTING:
For challenges_md, best_practices_md, applications_md, related_topics_md:
- Write each item on its OWN LINE starting with "- "
- Never put two items on the same line
- Format: - **Name:** one-sentence explanation

Correct:
- **Bias and Fairness:** Models may reproduce harmful stereotypes.
- **Hallucination:** Generated outputs can contain plausible but incorrect information.

Wrong: two items on the same line, or all merged into a paragraph.

TYPES SECTION:
If the topic has WELL-KNOWN subtypes, list them:
### Type 1: Type Name
description

If NO, return types_md as EMPTY STRING. Never write "No types available."

Reference:
- SVM to SVC, SVR, One-Class SVM, Linear, Kernel
- Neural Networks to CNN, RNN, Transformer, Feedforward
- Machine Learning to Supervised, Unsupervised, Reinforcement
- Generative AI to Text, Image, Audio, Video, Multimodal
- Transfer Learning to Feature Extraction, Fine-tuning, Domain Adaptation

Topics with NO types (return empty): Recursion, Binary Search, HTTP Protocol.

SECTIONS:
1. intro_md — 2 paragraphs.
2. real_world_example_md — 2 paragraphs.
3. why_needed_md — use ### 1. Reason Name subsections.
4. how_it_works_md — use ### Step 1: Name subsections with a SPACE after colon.
5. types_md — May be empty.
6. applications_md — bullet list (5-6 items, one per line).
7. challenges_md — bullet list (4-5 items, one per line).
8. best_practices_md — bullet list (4-5 items, one per line).
9. related_topics_md — bullet list (4-5 items, one per line).
10. diagram_mermaid — Mermaid code.
11. diagram_caption — one line.

TONE: 900-1300 words.

Return ONLY this JSON:
{{
  "title": "string",
  "tagline": "one-line subtitle",
  "intro_md": "string",
  "real_world_example_md": "string",
  "why_needed_md": "string",
  "how_it_works_md": "string",
  "types_md": "string",
  "applications_md": "string",
  "challenges_md": "string",
  "best_practices_md": "string",
  "related_topics_md": "string",
  "diagram_mermaid": "string",
  "diagram_caption": "string"
}}

Topic: {topic}
"""


def _try_generate(model: str, topic: str, subject: str, difficulty: str) -> dict:
    prompt = CONTENT_PROMPT_TEMPLATE.format(
        topic=topic, subject=subject, difficulty=difficulty
    )
    content = call_llm_json(
        prompt,
        system=CONTENT_SYSTEM_PROMPT,
        temperature=0.6,
        max_tokens=4000,
        model=model,
    )
    if not isinstance(content, dict) or "title" not in content:
        raise RuntimeError("LLM returned malformed content")
    for field in [
        "tagline", "intro_md", "real_world_example_md", "why_needed_md",
        "how_it_works_md", "types_md", "applications_md", "challenges_md",
        "best_practices_md", "related_topics_md", "diagram_mermaid",
        "diagram_caption",
    ]:
        content.setdefault(field, "")

    content = _normalize_text(content)
    return content


def generate_content(topic_name: str, subject_name: str, difficulty: str) -> dict:
    try:
        return _try_generate(FAST_MODEL, topic_name, subject_name, difficulty)
    except Exception as e:
        print(f"[content_service] Fast model failed ({e}), retrying with fallback...")
        return _try_generate(DEFAULT_MODEL, topic_name, subject_name, difficulty)


def get_or_create_content(topic_id: int, db: Session) -> dict:
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise ValueError(f"Topic {topic_id} not found")

    cached = (
        db.query(models.LearningContent)
        .filter(models.LearningContent.topic_id == topic_id)
        .first()
    )
    if cached:
        try:
            return _normalize_text(json.loads(cached.content_json))
        except json.JSONDecodeError:
            db.delete(cached)
            db.commit()

    subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()
    subject_name = subject.name if subject else "General"

    content = generate_content(topic.name, subject_name, topic.difficulty or "medium")

    record = models.LearningContent(
        topic_id=topic_id,
        content_json=json.dumps(content),
        sources="[]",
        model_version=f"{FAST_MODEL} (with {DEFAULT_MODEL} fallback)",
    )
    db.add(record)

    try:
        db.commit()
        db.refresh(record)
    except IntegrityError:
        db.rollback()
        existing = (
            db.query(models.LearningContent)
            .filter(models.LearningContent.topic_id == topic_id)
            .first()
        )
        if existing:
            try:
                return _normalize_text(json.loads(existing.content_json))
            except json.JSONDecodeError:
                pass
        raise

    return content


def invalidate_content(topic_id: int, db: Session) -> bool:
    record = (
        db.query(models.LearningContent)
        .filter(models.LearningContent.topic_id == topic_id)
        .first()
    )
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True


def _gen_content_thread(topic_id: int):
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_or_create_content(topic_id, db)
    finally:
        db.close()


def _gen_concepts_thread(topic_id: int):
    from services.concept_service import get_or_create_concepts
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_or_create_concepts(topic_id, db)
    finally:
        db.close()


def get_or_create_full(topic_id: int, db: Session) -> tuple[dict, list]:
    db.expire_all()
    cached_content = (
        db.query(models.LearningContent)
        .filter(models.LearningContent.topic_id == topic_id)
        .first()
    )
    cached_concepts = (
        db.query(models.Concept)
        .filter(models.Concept.topic_id == topic_id)
        .order_by(models.Concept.order_index)
        .all()
    )

    if cached_content and cached_concepts:
        try:
            return _normalize_text(json.loads(cached_content.content_json)), cached_concepts
        except json.JSONDecodeError:
            db.delete(cached_content)
            db.commit()

    lock = _get_topic_lock(topic_id)
    with lock:
        db.expire_all()
        cached_content = (
            db.query(models.LearningContent)
            .filter(models.LearningContent.topic_id == topic_id)
            .first()
        )
        cached_concepts = (
            db.query(models.Concept)
            .filter(models.Concept.topic_id == topic_id)
            .order_by(models.Concept.order_index)
            .all()
        )

        if cached_content and cached_concepts:
            try:
                return _normalize_text(json.loads(cached_content.content_json)), cached_concepts
            except json.JSONDecodeError:
                pass

        with ThreadPoolExecutor(max_workers=2) as ex:
            f_content = ex.submit(_gen_content_thread, topic_id)
            f_concepts = ex.submit(_gen_concepts_thread, topic_id)

            content = f_content.result()
            f_concepts.result()

        db.expire_all()
        content_record = (
            db.query(models.LearningContent)
            .filter(models.LearningContent.topic_id == topic_id)
            .first()
        )
        concepts = (
            db.query(models.Concept)
            .filter(models.Concept.topic_id == topic_id)
            .order_by(models.Concept.order_index)
            .all()
        )

        if content_record:
            try:
                content = _normalize_text(json.loads(content_record.content_json))
            except json.JSONDecodeError:
                pass

        return content, concepts