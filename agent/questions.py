"""The system-design question bank.

Each question carries the probes the coach uses to push back. Keeping them here
rather than in the prompt means a new question is data, not a prompt rewrite.
"""

from __future__ import annotations

import random
from dataclasses import dataclass


@dataclass(frozen=True)
class Question:
    id: str
    prompt_en: str
    prompt_hi: str
    probes: tuple[str, ...]

    def prompt(self, language: str) -> str:
        return self.prompt_hi if language == "hi" else self.prompt_en


QUESTIONS: tuple[Question, ...] = (
    Question(
        id="url_shortener",
        prompt_en="Design a URL shortener that handles ten thousand reads per second.",
        prompt_hi="Ek URL shortener design kijiye jo dus hazaar reads per second handle kare.",
        probes=(
            "read/write ratio",
            "key generation and collisions",
            "cache hit rate and eviction",
            "what happens when the database is down",
        ),
    ),
    Question(
        id="news_feed",
        prompt_en="Design the news feed for a social app with fifty million daily users.",
        prompt_hi="Paanch crore daily users wale social app ka news feed design kijiye.",
        probes=(
            "fan-out on write versus read",
            "celebrity accounts",
            "feed ranking cost",
            "how stale a feed may be",
        ),
    ),
    Question(
        id="rate_limiter",
        prompt_en="Design a distributed rate limiter for a public API.",
        prompt_hi="Ek public API ke liye distributed rate limiter design kijiye.",
        probes=(
            "per-user versus per-IP",
            "clock skew across nodes",
            "what happens on a Redis partition",
            "burst versus sustained limits",
        ),
    ),
)

BY_ID = {q.id: q for q in QUESTIONS}


def pick(question_id: str | None = None) -> Question:
    if question_id and question_id in BY_ID:
        return BY_ID[question_id]
    return random.choice(QUESTIONS)
