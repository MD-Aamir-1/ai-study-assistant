"""
Generates comprehensive, structured learning content for a topic using Groq.
Caches result in the learning_contents table.
"""

import json
from datetime import datetime
from sqlalchemy.orm import Session

import models
from services.llm import call_llm_json


CONTENT_SYSTEM_PROMPT = (
    "You are an expert educator producing structured learning content. "
    "You always respond with valid JSON only, no markdown fences, no prose."
)


CONTENT_PROMPT_TEMPLATE = """Generate comprehensive, structured learning content about the topic "{topic}" (subject: "{subject}", difficulty: {difficulty}).

Rules:
- Write for a beginner but be technically accurate and thorough.
- No fluff. No "In this article..." intros.
- Every field must be filled.
- Return ONLY valid JSON matching this schema.

Schema:
{{
  "title": "string",
  "definition": "1-2 sentence clear definition",
  "purpose": "why it exists / what it is used for",
  "problem_solved": "what problem it solves",
  "core_concept": "the central idea in 2-4 sentences",
  "how_it_works": ["step 1", "step 2", ...],
  "intuition": "an analogy or intuitive explanation",
  "real_world_examples": ["example 1", "example 2", "example 3"],
  "technical_example": "a concrete technical example with specifics",
  "types": [{{"name": "type name", "description": "short description"}}],
  "components": ["key component 1", "key component 2", "key component 3"],
  "applications": ["application 1", "application 2", "application 3"],
  "advantages": ["advantage 1", "advantage 2", "advantage 3"],
  "disadvantages": ["disadvantage 1", "disadvantage 2", "disadvantage 3"],
  "common_mistakes": ["mistake 1", "mistake 2", "mistake 3"],
  "misconceptions": ["misconception 1", "misconception 2"],
  "prerequisites": ["prereq 1", "prereq 2"],
  "summary": "2-3 sentence wrap-up"
}}

Requirements:
- how_it_works: 4-6 steps
- types: 2-4 entries (use [] if the topic has no distinct types)
- components: 3-5 entries
- applications: 3-5 entries
- advantages / disadvantages: 3-4 each
- common_mistakes: 3-4 entries
- misconceptions: 2-3 entries
- prerequisites: 2-4 entries

Topic: {topic}
"""


def generate_content(topic_name: str, subject_name: str, difficulty: str) -> dict:
    """Call Groq and return parsed content dict."""
    prompt = CONTENT_PROMPT_TEMPLATE.format(
        topic=topic_name,
        subject=subject_name,
        difficulty=difficulty,
    )
    content = call_llm_json(
        prompt,
        system=CONTENT_SYSTEM_PROMPT,
        temperature=0.6,
        max_tokens=4500,
    )
    if not isinstance(content, dict) or "title" not in content:
        raise RuntimeError("LLM returned malformed content")
    return content


def get_or_create_content(topic_id: int, db: Session) -> dict:
    """
    Return cached content if it exists; otherwise generate, store, and return it.
    """
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise ValueError(f"Topic {topic_id} not found")

    # Check cache
    cached = (
        db.query(models.LearningContent)
        .filter(models.LearningContent.topic_id == topic_id)
        .first()
    )
    if cached:
        try:
            return json.loads(cached.content_json)
        except json.JSONDecodeError:
            # Corrupt cache — regenerate below
            db.delete(cached)
            db.commit()

    # Fetch subject name
    subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()
    subject_name = subject.name if subject else "General"

    # Generate fresh content
    content = generate_content(topic.name, subject_name, topic.difficulty or "medium")

    # Persist
    record = models.LearningContent(
        topic_id=topic_id,
        content_json=json.dumps(content),
        sources="[]",
        model_version="openai/gpt-oss-120b",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return content


def invalidate_content(topic_id: int, db: Session) -> bool:
    """Delete cached content for a topic (forces regeneration on next request)."""
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