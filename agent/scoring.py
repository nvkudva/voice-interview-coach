"""Structured scoring at session end.

One non-streaming LLM call over the transcript, validated against a Pydantic
model. Provider-agnostic: it goes through whatever ``llm.LLM`` the session was
built with, so swapping the LLM in ``.env`` swaps the scorer too.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Literal

from livekit.agents import llm
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger(__name__)

Score = Literal[0, 1, 2, 3, 4]

DIMENSIONS = (
    "requirements_clarification",
    "high_level_design",
    "data_modeling",
    "scaling_and_tradeoffs",
    "communication",
)


class HandWaving(BaseModel):
    quote: str = Field(description="What the candidate actually said.")
    why: str = Field(description="What was missing from it.")


class Scores(BaseModel):
    requirements_clarification: Score
    high_level_design: Score
    data_modeling: Score
    scaling_and_tradeoffs: Score
    communication: Score


class SessionScore(BaseModel):
    scores: Scores
    strengths: list[str] = Field(default_factory=list, max_length=5)
    gaps: list[str] = Field(default_factory=list, max_length=5)
    hand_waving: list[HandWaving] = Field(default_factory=list, max_length=5)
    next_drill: str = ""

    @property
    def total(self) -> int:
        return sum(getattr(self.scores, d) for d in DIMENSIONS)


_RUBRIC = """\
Score this system-design interview transcript.

Each dimension scores 0 to 4:
0 absent, 1 named but not reasoned, 2 reasoned without numbers,
3 reasoned with numbers, 4 reasoned with numbers and an explicit tradeoff.

Dimensions: requirements_clarification, high_level_design, data_modeling,
scaling_and_tradeoffs, communication.

Quote the candidate verbatim in hand_waving. Do not invent quotes.
Write the score in English even when the interview was in another language.

Return only a JSON object matching this shape, with no prose and no code fence:
{
  "scores": {"requirements_clarification": 0, "high_level_design": 0,
             "data_modeling": 0, "scaling_and_tradeoffs": 0, "communication": 0},
  "strengths": ["..."],
  "gaps": ["..."],
  "hand_waving": [{"quote": "...", "why": "..."}],
  "next_drill": "..."
}

Transcript:
"""


def _extract_json(text: str) -> str:
    """Pull the JSON object out of a reply that may be fenced or prefaced."""
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if fenced:
        return fenced.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        return text[start : end + 1]
    return text


async def _complete(model: llm.LLM, prompt: str) -> str:
    ctx = llm.ChatContext.empty()
    ctx.add_message(role="user", content=prompt)
    chunks: list[str] = []
    async with model.chat(chat_ctx=ctx) as stream:
        async for chunk in stream:
            if chunk.delta and chunk.delta.content:
                chunks.append(chunk.delta.content)
    return "".join(chunks)


def format_transcript(items: list[dict[str, Any]]) -> str:
    lines = []
    for item in items:
        role = item.get("role", "?")
        text = item.get("text", "")
        if not text:
            continue
        speaker = "COACH" if role == "assistant" else "CANDIDATE"
        lines.append(f"{speaker}: {text}")
    return "\n".join(lines)


async def score_session(
    model: llm.LLM,
    transcript: list[dict[str, Any]],
    *,
    retries: int = 1,
) -> dict[str, Any]:
    """Score a transcript. Never raises — an unscorable session is recorded as such."""
    body = format_transcript(transcript)
    if not body.strip():
        return {"status": "unscored", "reason": "empty transcript"}

    prompt = _RUBRIC + body
    last_error = ""
    for attempt in range(retries + 1):
        try:
            raw = await _complete(model, prompt)
            parsed = SessionScore.model_validate_json(_extract_json(raw))
            return {
                "status": "scored",
                "total": parsed.total,
                **parsed.model_dump(),
            }
        except (ValidationError, json.JSONDecodeError) as exc:
            last_error = f"invalid score json: {exc}"
            logger.warning("scoring attempt %d failed: %s", attempt + 1, exc)
            prompt = (
                _RUBRIC + body
                + "\n\nYour previous reply was not valid JSON. Return only JSON."
            )
        except Exception as exc:  # provider error, timeout, cancellation
            last_error = f"{type(exc).__name__}: {exc}"
            logger.warning("scoring attempt %d errored: %s", attempt + 1, exc)

    return {"status": "unscored", "reason": last_error}
