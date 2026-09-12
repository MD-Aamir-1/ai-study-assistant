"""
AI Tutor: uses Groq's Llama 3 with the student's weak topics as context.
"""

import os
from dotenv import load_dotenv
from groq import Groq

# Load .env from the backend folder
load_dotenv()

_client = None


def get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY not found. Create backend/.env with GROQ_API_KEY=..."
            )
        _client = Groq(api_key=api_key)
    return _client


SYSTEM_PROMPT = """You are a friendly, patient AI Study Tutor.

Your job is to help the student understand concepts they are struggling with.

Rules:
- Explain clearly with simple examples.
- Use analogies when helpful.
- Keep responses concise (under 250 words unless the student asks for more).
- End with one short follow-up question to check understanding.
- Be encouraging, not condescending.
"""


def ask_tutor(question: str, weak_topics: list[dict]) -> str:
    """
    weak_topics: list of dicts with keys: topic_name, subject_name, score, difficulty
    """
    client = get_client()

    # Build student context
    if weak_topics:
        context_lines = [
            f"- {t['topic_name']} (in {t['subject_name']}, "
            f"score {t['score']}%, difficulty {t['difficulty']})"
            for t in weak_topics[:5]
        ]
        context = (
            "The student is currently struggling with these topics:\n"
            + "\n".join(context_lines)
            + "\n\nKeep this context in mind when answering."
        )
    else:
        context = "This student has no recorded weak topics yet."

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": context},
        {"role": "user", "content": question},
    ]

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",   # currently supported Groq model
        messages=messages,
        temperature=0.7,
        max_tokens=800,
    )

    return response.choices[0].message.content
import json

QUIZ_GEN_PROMPT = """You are an expert educator creating multiple-choice questions to test CONCEPTUAL understanding.

Generate {num} multiple-choice questions on the topic "{topic}" (subject: "{subject}") at {difficulty} difficulty level.

Requirements:
- Test CONCEPTUAL understanding, not rote memorization
- Include application-based, reasoning, and "why/how" questions
- Avoid trivial "what is X" definition-only questions
- Each question must have exactly 4 options labeled A, B, C, D
- Only ONE option must be correct
- Distractors must be plausible but wrong
- Vary question types: scenario-based, comparison, debugging, prediction

Return ONLY a valid JSON array (no prose, no markdown) in this exact format:
[
  {{
    "question": "Full question text here?",
    "option_a": "First option",
    "option_b": "Second option",
    "option_c": "Third option",
    "option_d": "Fourth option",
    "correct_option": "A"
  }}
]

The "correct_option" must be exactly one of: "A", "B", "C", "D".
Output nothing else before or after the JSON array.
"""


def generate_quiz_questions(
    topic_name: str,
    subject_name: str,
    difficulty: str,
    num_questions: int = 5,
) -> list[dict]:
    """Generate fresh conceptual MCQs using Groq."""
    client = get_client()

    prompt = QUIZ_GEN_PROMPT.format(
        num=num_questions,
        topic=topic_name,
        subject=subject_name,
        difficulty=difficulty,
    )

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {
                "role": "system",
                "content": "You are a JSON-only quiz generator. Always respond with a valid JSON array. Never include markdown fences or prose.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.85,
        max_tokens=3500,
    )

    content = response.choices[0].message.content.strip()

    # Strip markdown fences if model added them anyway
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.lower().startswith("json"):
            content = content[4:]
        content = content.strip()

    # Find the JSON array boundaries (in case of stray text)
    start = content.find("[")
    end = content.rfind("]")
    if start != -1 and end != -1:
        content = content[start : end + 1]

    try:
        questions = json.loads(content)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Failed to parse quiz JSON: {e}")

    if not isinstance(questions, list) or len(questions) == 0:
        raise RuntimeError("Groq returned no questions")

    # Validate structure
    cleaned = []
    for q in questions:
        if not all(k in q for k in ["question", "option_a", "option_b", "option_c", "option_d", "correct_option"]):
            continue
        if q["correct_option"] not in ("A", "B", "C", "D"):
            continue
        cleaned.append(q)

    if not cleaned:
        raise RuntimeError("Groq returned malformed questions")

    return cleaned