"""
Free web search via DuckDuckGo. No API key required.
"""

from ddgs import DDGS


# Keywords that indicate the user wants recent/factual info
TRIGGER_KEYWORDS = [
    "latest", "recent", "current", "today", "yesterday", "tomorrow",
    "news", "update", "recently", "new", "just announced", "just released",
    "who is", "who won", "when did", "when is", "what happened",
    "2024", "2025", "2026", "price of", "stock of",
    "election", "score", "match", "weather",
    "release date", "next update",
]


def needs_web_search(question: str) -> bool:
    """Return True if the question likely needs fresh web info."""
    if not question:
        return False
    q = question.lower()
    return any(kw in q for kw in TRIGGER_KEYWORDS)


def search_web(query: str, max_results: int = 4) -> list[dict]:
    """
    Search the web via DuckDuckGo.
    Returns list of {title, snippet, url}. Empty list on failure.
    """
    try:
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                title = (r.get("title") or "").strip()
                snippet = (r.get("body") or "").strip()
                url = (r.get("href") or "").strip()
                if not url:
                    continue
                # Trim snippets to keep context manageable
                if len(snippet) > 400:
                    snippet = snippet[:400] + "..."
                results.append({
                    "title": title,
                    "snippet": snippet,
                    "url": url,
                })
        return results
    except Exception as e:
        print(f"[web_search] Search failed: {e}")
        return []