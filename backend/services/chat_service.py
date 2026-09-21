"""
NovaAI Chat service.

Responsibilities:
- List available models (labels + descriptions)
- Build the message list for the LLM (with system prompt + RAG context)
- Generate short conversation titles
- Stream completions via the OpenAI-compatible client

Uses the shared client from ai_tutor.get_client().
"""

from typing import List, Dict, Any, Optional, Iterator

from ai_tutor import get_client


# ==================================================
# Model catalog
# ==================================================
DEFAULT_MODEL = "nova-balanced"

# Map UI model IDs → real LLM model IDs.
# Adjust the values to whatever provider you use.
_MODEL_MAP = {
    "nova-fast": "openai/gpt-oss-20b",
    "nova-balanced": "openai/gpt-oss-120b",
    "nova-reasoning": "openai/gpt-oss-120b",
}

_MODELS = [
    {
        "id": "nova-fast",
        "label": "Nova Fast",
        "description": "Fastest responses, good for quick questions.",
        "speed": "fast",
        "capability": "basic",
    },
    {
        "id": "nova-balanced",
        "label": "Nova Balanced",
        "description": "Best balance of speed and quality.",
        "speed": "medium",
        "capability": "general",
    },
    {
        "id": "nova-reasoning",
        "label": "Nova Reasoning",
        "description": "Stronger reasoning, slower responses.",
        "speed": "slow",
        "capability": "advanced",
    },
]

TITLE_MODEL = "openai/gpt-oss-20b"


def list_models() -> List[Dict[str, Any]]:
    return _MODELS


def resolve_model(model_id: Optional[str]) -> str:
    """Return the real LLM model ID for a UI model ID."""
    if not model_id:
        return _MODEL_MAP[DEFAULT_MODEL]
    return _MODEL_MAP.get(model_id, _MODEL_MAP[DEFAULT_MODEL])


# ==================================================
# System prompt
# ==================================================
SYSTEM_PROMPT = """You are NovaAI, a helpful, accurate, and concise AI assistant.

You help with study, coding, writing, research, planning, and general questions.

═══════════════════════════════════════════════
STRICT OUTPUT RULES
═══════════════════════════════════════════════
1. Use Markdown. Never emit raw HTML.
   FORBIDDEN tags: <br>, <div>, <span>, <p>, <b>, <i>, <u>, <ul>, <ol>, <li>, <table>, <tr>, <td>, <th>, <h1>-<h6>, <a>, <font>.
2. For line breaks inside a Markdown table cell, use " · " (middle dot) or a semicolon — never <br>.
3. For lists in normal text, use "-" or "*" at the start of each line, with a blank line before and after the list.
4. For paragraphs, separate them with a blank line. Do not use <br> to force line breaks.
5. Write "AI" correctly — never "Al".
6. MATH: use `inline` for short formulas and $$display$$ on its own line for long ones.
   Never use \\( ... \\) or \\[ ... \\].
7. Tables: Markdown pipe syntax only. Keep them small (max 6 rows × 4 columns).
8. No HTML entities (&amp;, &quot;, &#39;, &nbsp;, etc.) — write the actual character.
9. If you don't know something, say so honestly. Don't invent facts or citations.
10. When context from uploaded files is provided, ground your answer in it and cite as [Source N].
"""


# ==================================================
# Message builder
# ==================================================
def build_messages(
    conversation,
    history: List[Any],
    user_text: str,
    context_note: str = "",
) -> List[Dict[str, str]]:
    """
    Build the LLM message list.

    - history is a list of ChatMessage ORM rows (only user/assistant roles).
    - context_note is the RAG context block (may be empty).
    """
    messages: List[Dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Inject RAG context as a system note (so it can't be confused with user instructions)
    if context_note and context_note.strip():
        messages.append(
            {
                "role": "system",
                "content": (
                    "The user has uploaded files. Here is relevant context:\n\n"
                    f"{context_note}"
                ),
            }
        )

    # History — most recent N messages to keep prompt size reasonable
    MAX_HISTORY = 20
    trimmed = list(history)[-MAX_HISTORY:] if history else []

    for msg in trimmed:
        role = getattr(msg, "role", None)
        content = getattr(msg, "content", None) or ""
        if role not in ("user", "assistant", "system"):
            continue
        if not content.strip():
            continue
        # Skip system rows from history (they'd duplicate SYSTEM_PROMPT)
        if role == "system":
            continue
        messages.append({"role": role, "content": content})

    # Current user message (if not already in history)
    if not trimmed or getattr(trimmed[-1], "content", "") != user_text:
        messages.append({"role": "user", "content": user_text})

    return messages


# ==================================================
# Streaming
# ==================================================
def stream_completion(
    model_id: str,
    messages: List[Dict[str, str]],
) -> Iterator[str]:
    """
    Yield text chunks from the LLM as they arrive.
    The caller is responsible for HTML stripping / SSE packaging.
    """
    client = get_client()
    real_model = resolve_model(model_id)

    try:
        stream = client.chat.completions.create(
            model=real_model,
            messages=messages,
            temperature=0.7,
            max_tokens=4000,
            stream=True,
        )
    except Exception as e:
        # Surface the error as a single delta so the UI shows something useful.
        yield f"\n\n[Error: {e}]"
        return

    for chunk in stream:
        try:
            delta = chunk.choices[0].delta
        except (AttributeError, IndexError):
            continue

        content = getattr(delta, "content", None)
        if content:
            yield content


# ==================================================
# Title generation
# ==================================================
def generate_title(user_text: str) -> str:
    """
    Generate a short (<= 60 char) conversation title from the first user message.
    Falls back to a truncated version of the message on any error.
    """
    text = (user_text or "").strip()
    if not text:
        return "New chat"

    # Quick local fallback
    fallback = text[:60].strip()
    if fallback and len(text) > 60:
        fallback = fallback.rsplit(" ", 1)[0] + "…"

    prompt = (
        "Generate a short, descriptive title for a chat that starts with the "
        "user message below. Rules:\n"
        "- 3 to 6 words\n"
        "- Title Case\n"
        "- No quotes, no trailing punctuation, no prefixes like 'Title:'\n"
        "- Output ONLY the title on a single line\n\n"
        f"User message:\n{text[:400]}"
    )

    try:
        client = get_client()
        resp = client.chat.completions.create(
            model=TITLE_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=20,
        )
        title = (resp.choices[0].message.content or "").strip()
        title = title.strip("\"'`. ").replace("\n", " ")
        if title:
            return title[:80]
    except Exception:
        pass

    return fallback or "New chat"


# ==================================================
# Non-streaming completion (used by other features)
# ==================================================
def complete(
    model_id: str,
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> str:
    """One-shot non-streaming completion. Returns the assistant text."""
    client = get_client()
    real_model = resolve_model(model_id)
    resp = client.chat.completions.create(
        model=real_model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=False,
    )
    return (resp.choices[0].message.content or "").strip()