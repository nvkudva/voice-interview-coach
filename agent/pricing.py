"""Rate table and cost arithmetic.

Rates are published list prices in USD, entered per model. They drift — the
table is data, not logic, so correcting a rate never touches the agent. Update
`AS_OF` when you refresh them.
"""

from __future__ import annotations

from dataclasses import dataclass

AS_OF = "2026-09-05"


@dataclass(frozen=True)
class LLMRate:
    input_per_mtok: float
    output_per_mtok: float
    cached_input_per_mtok: float = 0.0


# USD per million tokens.
LLM_RATES: dict[str, LLMRate] = {
    "claude-sonnet-4-6": LLMRate(3.00, 15.00, 0.30),
    "claude-haiku-4-5": LLMRate(1.00, 5.00, 0.10),
    "gpt-4o-mini": LLMRate(0.15, 0.60, 0.075),
}

# USD per million characters synthesized.
TTS_RATES: dict[str, float] = {
    "sonic-3": 24.00,
    "sonic-2": 24.00,
    "eleven_turbo_v2_5": 60.00,
}

# USD per minute of audio transcribed.
STT_RATES: dict[str, float] = {
    "nova-3": 0.0077,
    "nova-2": 0.0059,
}

# LiveKit Cloud, USD per participant-minute (agent + caller = 2).
LIVEKIT_PER_PARTICIPANT_MINUTE = 0.0015


def _rate_key(model: str) -> str:
    """Strip any ``provider/`` prefix and ``:variant`` suffix."""
    return model.split("/")[-1].split(":")[0]


def llm_cost(model: str, input_tokens: int, output_tokens: int, cached_tokens: int = 0) -> float:
    rate = LLM_RATES.get(_rate_key(model))
    if rate is None:
        return 0.0
    fresh = max(input_tokens - cached_tokens, 0)
    return (
        fresh * rate.input_per_mtok
        + cached_tokens * rate.cached_input_per_mtok
        + output_tokens * rate.output_per_mtok
    ) / 1_000_000


def tts_cost(model: str, characters: int) -> float:
    return characters * TTS_RATES.get(_rate_key(model), 0.0) / 1_000_000


def stt_cost(model: str, audio_seconds: float) -> float:
    return audio_seconds / 60.0 * STT_RATES.get(_rate_key(model), 0.0)


def transport_cost(session_seconds: float, participants: int = 2) -> float:
    return session_seconds / 60.0 * LIVEKIT_PER_PARTICIPANT_MINUTE * participants


def session_cost(usage) -> dict[str, float]:
    """Total a ``metrics.AgentSessionUsage`` into a per-leg cost breakdown.

    Accepts the object returned by ``AgentSession.usage`` (or any object with a
    ``model_usage`` list of per-model usage entries).
    """
    legs = {"llm": 0.0, "tts": 0.0, "stt": 0.0}
    for entry in getattr(usage, "model_usage", []) or []:
        kind = getattr(entry, "type", "")
        model = getattr(entry, "model", "")
        if kind == "llm_usage":
            legs["llm"] += llm_cost(
                model,
                entry.input_tokens,
                entry.output_tokens,
                entry.input_cached_tokens,
            )
        elif kind == "tts_usage":
            legs["tts"] += tts_cost(model, entry.characters_count)
        elif kind == "stt_usage":
            legs["stt"] += stt_cost(model, entry.audio_duration)
    legs["total"] = round(sum(legs.values()), 6)
    return {k: round(v, 6) for k, v in legs.items()}
