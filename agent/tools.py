"""The three function tools.

Every tool wraps its blocking work in ``ctx.with_filler(...)``. The filler waits
for the session to be idle for ``delay`` seconds before speaking, so a fast tool
never produces a pointless "let me check" — but a slow one never leaves the line
silent either.
"""

from __future__ import annotations

import asyncio
import datetime as dt
from typing import Annotated, Any

from livekit.agents import RunContext, function_tool
from pydantic import Field

from . import storage

FILLER_DELAY = 0.4
"""Seconds of continuous idle before a filler phrase plays."""

# A tiny local reference set. Real deployments point this at a vector store or a
# docs API; the tool contract does not change.
_CONCEPTS: dict[str, str] = {
    "consistent hashing": (
        "Maps keys and nodes onto one ring so adding a node moves only the keys "
        "between it and its predecessor, roughly one over n of the keyspace."
    ),
    "cap theorem": (
        "Under a network partition a system chooses availability or consistency. "
        "With no partition the tradeoff is latency against consistency."
    ),
    "write ahead log": (
        "Durability record written before the change is applied, so a crash "
        "replays committed work and discards partial work."
    ),
    "bloom filter": (
        "Probabilistic set membership. No false negatives, tunable false "
        "positives, constant space per element."
    ),
    "leader election": (
        "One node holds a lease with a bounded term. Fencing tokens stop a "
        "stalled old leader from writing after its lease expires."
    ),
    "back pressure": (
        "The consumer signals the producer to slow down instead of buffering "
        "without limit, so overload degrades latency rather than memory."
    ),
}


def _session_id(ctx: RunContext) -> str:
    data = ctx.userdata
    return getattr(data, "session_id", "unknown")


@function_tool
async def lookup_concept(
    ctx: RunContext,
    topic: Annotated[str, Field(description="System-design concept to look up.")],
) -> str:
    """Look up a precise definition of a system-design concept.

    Use this when you need to state a definition exactly, not to fill a pause.
    """
    async with ctx.with_filler("Let me pull that up.", delay=FILLER_DELAY):
        key = topic.strip().lower()
        definition = _CONCEPTS.get(key)
        if definition is None:
            # Cheap fuzzy match before giving up.
            for name, text in _CONCEPTS.items():
                if key in name or name in key:
                    definition = text
                    break
        if definition is None:
            return f"No reference note for {topic}. Answer from your own knowledge."
        return definition


@function_tool
async def save_note(
    ctx: RunContext,
    text: Annotated[str, Field(description="The observation, in one sentence.")],
    tag: Annotated[
        str,
        Field(description="One of: strength, gap, hand_waving, followup."),
    ] = "gap",
) -> str:
    """Record a coaching observation about the candidate's answer.

    Call this the moment you notice something worth scoring, not at the end.
    """
    async with ctx.with_filler("Noting that.", delay=FILLER_DELAY):
        session_id = _session_id(ctx)
        record = storage.load(session_id) or {"session_id": session_id}
        notes: list[dict[str, Any]] = record.get("notes", [])
        notes.append({"text": text, "tag": tag, "at": dt.datetime.now(dt.UTC).isoformat()})
        storage.merge(session_id, notes=notes)
        return f"Saved note tagged {tag}."


@function_tool
async def schedule_follow_up(
    ctx: RunContext,
    topic: Annotated[str, Field(description="What the follow-up session drills.")],
    days_from_now: Annotated[
        int, Field(description="Days from today, 1 to 30.", ge=1, le=30)
    ] = 7,
) -> str:
    """Book a follow-up practice session. Only call this if the candidate agrees."""
    async with ctx.with_filler("Getting that on the calendar.", delay=FILLER_DELAY):
        # Stands in for a calendar API. The await keeps the filler path honest.
        await asyncio.sleep(0.05)
        when = dt.datetime.now(dt.UTC) + dt.timedelta(days=days_from_now)
        slot = when.replace(hour=18, minute=0, second=0, microsecond=0)
        session_id = _session_id(ctx)
        record = storage.load(session_id) or {"session_id": session_id}
        follow_ups: list[dict[str, Any]] = record.get("follow_ups", [])
        follow_ups.append({"topic": topic, "at": slot.isoformat()})
        storage.merge(session_id, follow_ups=follow_ups)
        return f"Booked a session on {topic} for {slot:%A %-d %B} at six in the evening."


ALL_TOOLS = [lookup_concept, save_note, schedule_follow_up]
