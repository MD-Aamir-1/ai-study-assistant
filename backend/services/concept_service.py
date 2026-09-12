"""
Extracts key concepts from a topic using Groq.
Saves them in the concepts table with importance + order.
"""

from sqlalchemy.orm import Session
import models
from services.llm import call_llm_json


CONCEPT_SYSTEM_PROMPT = (
    "You extract conceptual building blocks from educational topics. "
    "You always respond with valid JSON only. No markdown fences, no prose."
)


CONCEPT_PROMPT_TEMPLATE = """Extract the 6-9 most important CONCEPTS from the topic "{topic}" (subject: "{subject}", difficulty: {difficulty}).

A "concept" is a specific idea, technique, sub-topic, or principle that:
- Can be independently tested
- Is meaningful on its own
- Is not vague ("Introduction", "Overview", "Basics" are BAD concepts)

Rules:
- Prefer 6-9 concepts
- Order them from foundational (order_index 0) to advanced
- Avoid vague or generic names
- Every concept must be specific to this topic

Return ONLY a JSON object matching this schema:
{{
  "concepts": [
    {{
      "name": "concise concept name (2-6 words)",
      "description": "one clear sentence explaining what it is",
      "importance": 1
    }}
  ]
}}

importance guide:
  5 = absolutely essential to understand the topic
  4 = very important
  3 = important (default)
  2 = useful background
  1 = niche detail

Topic: {topic}
"""


def extract_concepts(topic_name: str, subject_name: str, difficulty: str) -> list[dict]:
    """Call Groq and return list of concept dicts."""
    prompt = CONCEPT_PROMPT_TEMPLATE.format(
        topic=topic_name,
        subject=subject_name,
        difficulty=difficulty,
    )
    result = call_llm_json(
        prompt,
        system=CONCEPT_SYSTEM_PROMPT,
        temperature=0.5,
        max_tokens=1800,
    )

    # Expect {"concepts": [...]}
    if isinstance(result, dict) and "concepts" in result:
        concepts = result["concepts"]
    elif isinstance(result, list):
        concepts = result
    else:
        raise RuntimeError("LLM returned unexpected structure for concepts")

    # Validate + clean
    cleaned = []
    for i, c in enumerate(concepts):
        if not isinstance(c, dict):
            continue
        name = (c.get("name") or "").strip()
        if not name or len(name) < 3:
            continue
        description = (c.get("description") or "").strip()
        try:
            importance = int(c.get("importance", 3))
        except Exception:
            importance = 3
        importance = max(1, min(5, importance))
        cleaned.append({
            "name": name,
            "description": description,
            "importance": importance,
            "order_index": i,
        })

    if len(cleaned) < 3:
        raise RuntimeError("LLM returned too few concepts")

    return cleaned


def get_or_create_concepts(topic_id: int, db: Session, force: bool = False) -> list[models.Concept]:
    """
    Return existing concepts; if none exist (or force=True), extract and save.
    """
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise ValueError(f"Topic {topic_id} not found")

    existing = (
        db.query(models.Concept)
        .filter(models.Concept.topic_id == topic_id)
        .order_by(models.Concept.order_index)
        .all()
    )

    if existing and not force:
        return existing

    # If force, delete existing first
    if existing and force:
        for c in existing:
            db.delete(c)
        db.commit()

    subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()
    subject_name = subject.name if subject else "General"

    concepts_data = extract_concepts(
        topic.name, subject_name, topic.difficulty or "medium"
    )

    created = []
    for c in concepts_data:
        record = models.Concept(
            topic_id=topic_id,
            name=c["name"],
            description=c["description"],
            importance=c["importance"],
            order_index=c["order_index"],
        )
        db.add(record)
        created.append(record)

    db.commit()
    for c in created:
        db.refresh(c)

    return created