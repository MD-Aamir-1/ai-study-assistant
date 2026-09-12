"""
Shared LLM helper: calls Groq and returns parsed JSON or raw text.
Reuses the Groq client from ai_tutor.py (no duplicate client).
"""

import json
from ai_tutor import get_client


DEFAULT_MODEL = "openai/gpt-oss-120b"


def _extract_json(text: str):
    """Strip markdown fences and find the first JSON value in the text."""
    text = text.strip()

    # Remove markdown code fences if present
    if text.startswith("```"):
        # Remove opening fence (```json or ```)
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1 :]
        # Remove closing fence
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]

    text = text.strip()

    # Find the first { or [ and the matching last } or ]
    first_brace = min(
        (text.find("{") if "{" in text else 10**9),
        (text.find("[") if "[" in text else 10**9),
    )
    if first_brace > 0 and first_brace < 10**9:
        text = text[first_brace:]

    last_brace = max(text.rfind("}"), text.rfind("]"))
    if last_brace != -1:
        text = text[: last_brace + 1]

    return json.loads(text)


def call_llm_json(prompt: str, system: str = "", temperature: float = 0.7, max_tokens: int = 4000):
    """
    Call Groq and return parsed JSON (dict or list).
    Raises RuntimeError if the model doesn't return valid JSON.
    """
    client = get_client()

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    else:
        messages.append({
            "role": "system",
            "content": (
                "You return ONLY valid JSON. No markdown fences, no prose, "
                "no explanation. Just the JSON object or array."
            ),
        })
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model=DEFAULT_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    content = response.choices[0].message.content
    try:
        return _extract_json(content)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"LLM returned invalid JSON: {e}\n---\nRaw content:\n{content[:600]}"
        )


def call_llm_text(prompt: str, system: str = "", temperature: float = 0.7, max_tokens: int = 1000) -> str:
    """Call Groq and return raw text."""
    client = get_client()

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model=DEFAULT_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content.strip()