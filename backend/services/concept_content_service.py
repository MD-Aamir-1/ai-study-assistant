"""
Generates focused, deep-dive content for a single concept using Groq.
Cached in the concept_contents table.
"""

import json
from sqlalchemy.orm import Session
import models
from services.llm import call_llm_json


CONCEPT_SYSTEM_PROMPT = (
    "You are an expert educator producing focused, deep-dive explanations "
    "of individual concepts. You always respond with valid JSON only. "
    "No markdown fences, no prose."
)


CONCEPT_CONTENT_PROMPT = """Write a focused, deep-dive explanation of the concept "{concept}" which appears in the topic "{topic}" (subject: "{subject}", difficulty: {difficulty}).

Context about the concept:
{description}

Rules:
- Dive deep into THIS concept only — don't cover the whole topic
- Be beginner-friendly but technically accurate
- Use concrete examples, not vague ones
- Assume the student has read the general topic overview already
- Return ONLY valid JSON matching this schema

Schema:
{{
  "summary": "1-2 sentence essence of this concept",
  "why_it_matters": "why this concept exists / what breaks without it (2-3 sentences)",
  "deep_explanation": "thorough 6-10 sentence explanation covering the mechanics",
  "how_it_works": ["step 1", "step 2", "step 3", "step 4"],
  "intuition": "an analogy or mental model that makes it click",
  "concrete_example": "specific example with actual values/numbers/names where possible",
  "common_pitfalls": ["pitfall 1", "pitfall 2", "pitfall 3"],
  "connections": ["related concept 1", "related concept 2", "related concept 3"],
  "quick_check": "one short question the student can answer to confirm understanding"
}}

Requirements:
- how_it_works: 3-5 steps
- common_pitfalls: 3-4 pitfalls that specifically trap learners
- connections: 3-4 related concepts students should know
"""


def generate_concept_content(
    concept_name: str,
    description: str,
    topic_name: str,
    subject_name: str,
    difficulty: str,
) -> dict:
    """Call Groq and return parsed concept content dict."""
    prompt = CONCEPT_CONTENT_PROMPT.format(
        concept=concept_name,
        description=description or "No additional description provided.",
        topic=topic_name,
        subject=subject_name,
        difficulty=difficulty,
    )
    content = call_llm_json(
        prompt,
        system=CONCEPT_SYSTEM_PROMPT,
        temperature=0.6,
        max_tokens=3500,
    )
    if not isinstance(content, dict) or "summary" not in content:
        raise RuntimeError("LLM returned malformed concept content")
    return content


def get_or_create_concept_content(concept_id: int, db: Session, force: bool = False) -> dict:
    """Return cached content if it exists; otherwise generate, store, and return it."""
    concept = db.query(models.Concept).filter(models.Concept.id == concept_id).first()
    if not concept:
        raise ValueError(f"Concept {concept_id} not found")

    cached = (
        db.query(models.ConceptContent)
        .filter(models.ConceptContent.concept_id == concept_id)
        .first()
    )

    if cached and not force:
        try:
            return json.loads(cached.content_json)
        except json.JSONDecodeError:
            db.delete(cached)
            db.commit()

    if cached and force:
        db.delete(cached)
        db.commit()

    # Fetch topic + subject context
    topic = db.query(models.Topic).filter(models.Topic.id == concept.topic_id).first()
    if not topic:
        raise ValueError("Topic missing for concept")
    subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()
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
        model_version="openai/gpt-oss-120b",
    )
    db.add(record)
    db.commit()

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