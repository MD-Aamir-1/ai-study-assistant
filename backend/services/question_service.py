"""
Generates concept-aware test questions using Groq.
Each question is mapped to one or more concepts and saved to the DB.
"""

import json
import uuid
from typing import Dict, Optional
from sqlalchemy.orm import Session

import models
from services.llm import call_llm_json
from services.concept_service import get_or_create_concepts
from services.analysis_service import update_concept_stats


TEST_SYSTEM_PROMPT = (
    "You are an expert educator producing conceptual multiple-choice questions. "
    "You always respond with valid JSON only. No markdown fences, no prose."
)


TEST_PROMPT_TEMPLATE = """Create {num} conceptual multiple-choice questions about "{topic}" (subject: {subject}, difficulty: {difficulty}).

The topic is broken into these concepts:
{concept_list}

Rules:
- Questions MUST test CONCEPTUAL understanding — reasoning, application, scenarios, comparisons, "what if" questions
- NO trivial definition questions ("What is X?")
- Every question must target at least ONE of the concepts above
- Use the EXACT concept names from the list above when filling concept_names
- Each question must have exactly 4 options (A, B, C, D), only one correct
- Distractors must be plausible, not silly
- Provide a brief explanation (1-2 sentences) for why the correct answer is correct

Return ONLY valid JSON matching this schema:
{{
  "questions": [
    {{
      "question": "Question text ending with ?",
      "option_a": "First option",
      "option_b": "Second option",
      "option_c": "Third option",
      "option_d": "Fourth option",
      "correct_option": "A",
      "explanation": "Why the correct answer is correct",
      "question_type": "conceptual",
      "difficulty": "{difficulty}",
      "concept_names": ["Exact Concept Name 1"]
    }}
  ]
}}

question_type must be one of: conceptual, application, scenario, comparison.

Topic: {topic}
"""


def _find_concept(name: str, concept_map: dict) -> Optional[models.Concept]:
    """Match an LLM-provided concept name to a real concept (fuzzy)."""
    if not name:
        return None
    key = name.strip().lower()
    if key in concept_map:
        return concept_map[key]
    # Substring fallback (either direction)
    for cname, c in concept_map.items():
        if key in cname or cname in key:
            return c
    return None


def generate_test(topic_id: int, db: Session, num_questions: int = 8) -> dict:
    """
    Generate a concept-aware test for a topic.
    Saves questions + concept links to the DB.
    Returns a payload ready for the frontend.
    """
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise ValueError(f"Topic {topic_id} not found")

    # Ensure concepts exist
    concepts = get_or_create_concepts(topic_id, db)
    if not concepts:
        raise RuntimeError("No concepts available for this topic")

    subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()
    subject_name = subject.name if subject else "General"

    concept_list = "\n".join(
        f"{i + 1}. {c.name} — {c.description} (importance {c.importance}/5)"
        for i, c in enumerate(concepts)
    )

    prompt = TEST_PROMPT_TEMPLATE.format(
        num=num_questions,
        topic=topic.name,
        subject=subject_name,
        difficulty=topic.difficulty or "medium",
        concept_list=concept_list,
    )

    result = call_llm_json(
        prompt,
        system=TEST_SYSTEM_PROMPT,
        temperature=0.75,
        max_tokens=5500,
    )

    if not isinstance(result, dict) or "questions" not in result:
        raise RuntimeError("LLM returned malformed test")

    # Build name → Concept map for linking
    concept_map = {c.name.lower(): c for c in concepts}

    saved_payload = []
    for q_data in result["questions"]:
        # Validate minimum required fields
        required = ["question", "option_a", "option_b", "option_c", "option_d", "correct_option"]
        if not all(k in q_data for k in required):
            continue
        if q_data["correct_option"] not in ("A", "B", "C", "D"):
            continue

        q = models.Question(
            topic_id=topic_id,
            question=q_data["question"].strip(),
            option_a=q_data["option_a"].strip(),
            option_b=q_data["option_b"].strip(),
            option_c=q_data["option_c"].strip(),
            option_d=q_data["option_d"].strip(),
            correct_option=q_data["correct_option"],
            explanation=q_data.get("explanation", "").strip(),
            difficulty=q_data.get("difficulty", topic.difficulty or "medium"),
            question_type=q_data.get("question_type", "conceptual"),
        )
        db.add(q)
        db.flush()  # assigns q.id

        linked_concepts = []
        for cname in q_data.get("concept_names", []):
            concept = _find_concept(cname, concept_map)
            if concept:
                link = models.QuestionConcept(
                    question_id=q.id,
                    concept_id=concept.id,
                    weight=1.0,
                )
                db.add(link)
                linked_concepts.append({"id": concept.id, "name": concept.name})

        # Snapshot question data before commit (avoid detached-instance issues)
        saved_payload.append({
            "id": q.id,
            "question": q.question,
            "option_a": q.option_a,
            "option_b": q.option_b,
            "option_c": q.option_c,
            "option_d": q.option_d,
            "question_type": q.question_type,
            "difficulty": q.difficulty,
            "concepts": linked_concepts,
        })

    if not saved_payload:
        raise RuntimeError("LLM returned no valid questions")

    db.commit()

    return {
        "topic_id": topic_id,
        "topic_name": topic.name,
        "subject_name": subject_name,
        "difficulty": topic.difficulty,
        "total_questions": len(saved_payload),
        "questions": saved_payload,
    }


def submit_test(
    student_id: int,
    answers: Dict[str, Optional[str]],
    db: Session,
    session_id: Optional[str] = None,
) -> dict:
    """
    Grade a test session, save attempts, update concept_stats.

    `answers`: mapping of {question_id_str: "A"|"B"|"C"|"D"|None}
    """
    if not session_id:
        session_id = str(uuid.uuid4())

    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise ValueError("Student not found")

    question_ids = []
    for k in answers.keys():
        try:
            question_ids.append(int(k))
        except (ValueError, TypeError):
            continue

    questions = (
        db.query(models.Question)
        .filter(models.Question.id.in_(question_ids))
        .all()
    )
    q_map = {q.id: q for q in questions}

    if not questions:
        raise ValueError("No valid questions found for the given answers")

    correct_count = 0
    total = len(questions)
    details = []

    # session_concept_acc: concept_id -> {"correct": int, "total": int}
    session_concept_acc: dict[int, dict] = {}
    # concept_id -> Concept object (for naming in response)
    concept_objs: dict[int, models.Concept] = {}

    for qid_str, selected in answers.items():
        try:
            qid = int(qid_str)
        except (ValueError, TypeError):
            continue

        q = q_map.get(qid)
        if not q:
            continue

        selected_clean = (selected or "").strip().upper() or None
        is_correct = selected_clean == q.correct_option

        if is_correct:
            correct_count += 1

        # Save the attempt
        attempt = models.QuestionAttempt(
            student_id=student_id,
            question_id=qid,
            selected_option=selected_clean,
            is_correct=is_correct,
            session_id=session_id,
        )
        db.add(attempt)

        # Collect concepts
        concept_names = []
        for link in q.concept_links:
            cid = link.concept_id
            session_concept_acc.setdefault(cid, {"correct": 0, "total": 0})
            session_concept_acc[cid]["total"] += 1
            if is_correct:
                session_concept_acc[cid]["correct"] += 1
            concept_objs[cid] = link.concept
            concept_names.append(link.concept.name)

        details.append({
            "question_id": qid,
            "question": q.question,
            "your_answer": selected_clean,
            "correct_answer": q.correct_option,
            "is_correct": is_correct,
            "explanation": q.explanation,
            "concepts": concept_names,
        })

    db.flush()

    # Update per-concept stats
    concept_updates = []
    for cid, acc in session_concept_acc.items():
        stat = update_concept_stats(
            student_id=student_id,
            concept_id=cid,
            session_correct=acc["correct"],
            session_total=acc["total"],
            db=db,
        )
        session_score = (
            round((acc["correct"] / acc["total"]) * 100, 1)
            if acc["total"]
            else 0.0
        )
        concept_updates.append({
            "concept_id": cid,
            "concept_name": concept_objs[cid].name,
            "session_correct": acc["correct"],
            "session_total": acc["total"],
            "session_score": session_score,
            "overall_score": stat.score,
            "overall_attempts": stat.attempts,
            "confidence": stat.confidence,
            "trend": stat.trend,
        })

    # Also update the legacy Performance table for the topic
    # (keeps Dashboard and Study Plan working as before)
    score_percent = round((correct_count / total) * 100, 2) if total else 0.0
    topic_id = questions[0].topic_id

    perf = (
        db.query(models.Performance)
        .filter(
            models.Performance.student_id == student_id,
            models.Performance.topic_id == topic_id,
        )
        .first()
    )
    if perf:
        perf.score = round((perf.score + score_percent) / 2, 2)
        perf.attempts += 1
    else:
        perf = models.Performance(
            student_id=student_id,
            topic_id=topic_id,
            score=score_percent,
            attempts=1,
        )
        db.add(perf)

    db.commit()

    # Sort concepts by session_score ascending (weakest first)
    concept_updates.sort(key=lambda x: x["session_score"])

    return {
        "session_id": session_id,
        "score_percent": score_percent,
        "correct": correct_count,
        "total": total,
        "concepts": concept_updates,
        "details": details,
    }