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