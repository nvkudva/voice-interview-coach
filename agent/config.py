"""Provider wiring. Every model comes from the environment, never a literal.

Each ``build_*`` returns a framework object. When a ``*_FALLBACK`` variable is
set, the primary and the fallback are wrapped in the framework's
``FallbackAdapter`` so a provider outage degrades instead of going silent.

Model strings use ``provider/model`` form, e.g. ``deepgram/nova-3``. That keeps
provider names out of every other module: swapping TTS is a one-line ``.env``
edit.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from livekit.agents import inference, llm, stt, tts, vad
from livekit.plugins import anthropic, cartesia, deepgram, elevenlabs, silero

DEFAULT_LANGUAGE = "en"
SUPPORTED_LANGUAGES = ("en", "hi")


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _split(spec: str) -> tuple[str, str]:
    """``"deepgram/nova-3"`` -> ``("deepgram", "nova-3")``."""
    provider, _, model = spec.partition("/")
    if not model:
        raise ValueError(f"model spec must be 'provider/model', got {spec!r}")
    return provider.lower(), model


@dataclass(frozen=True)
class SessionConfig:
    """Everything the worker reads from the environment, resolved once."""

    stt_model: str = field(default_factory=lambda: _env("STT_MODEL", "deepgram/nova-3"))
    stt_fallback: str = field(default_factory=lambda: _env("STT_FALLBACK"))
    stt_language: str = field(default_factory=lambda: _env("STT_LANGUAGE", "multi"))

    llm_model: str = field(
        default_factory=lambda: _env("LLM_MODEL", "anthropic/claude-sonnet-4-6")
    )
    llm_fallback: str = field(default_factory=lambda: _env("LLM_FALLBACK"))

    tts_model: str = field(default_factory=lambda: _env("TTS_MODEL", "cartesia/sonic-3"))
    tts_fallback: str = field(default_factory=lambda: _env("TTS_FALLBACK"))

    language: str = field(default_factory=lambda: _env("COACH_LANGUAGE", DEFAULT_LANGUAGE))

    # Turn handling. Defaults are the tuned values from prd.md §6.
    endpointing_mode: str = field(default_factory=lambda: _env("ENDPOINTING_MODE", "dynamic"))
    min_endpointing_delay: float = field(
        default_factory=lambda: float(_env("MIN_ENDPOINTING_DELAY", "0.3"))
    )
    max_endpointing_delay: float = field(
        default_factory=lambda: float(_env("MAX_ENDPOINTING_DELAY", "2.5"))
    )
    interruption_mode: str = field(default_factory=lambda: _env("INTERRUPTION_MODE", "adaptive"))
    min_interruption_duration: float = field(
        default_factory=lambda: float(_env("MIN_INTERRUPTION_DURATION", "0.5"))
    )
    preemptive_generation: bool = field(
        default_factory=lambda: _env("PREEMPTIVE_GENERATION", "true").lower() == "true"
    )
    preemptive_tts: bool = field(
        default_factory=lambda: _env("PREEMPTIVE_TTS", "false").lower() == "true"
    )

    # Silero must report silence faster than the framework's 200 ms EOT floor,
    # or the plugin default of 0.55 s eats most of the 800 ms budget.
    vad_min_silence: float = field(default_factory=lambda: float(_env("VAD_MIN_SILENCE", "0.2")))
    vad_min_speech: float = field(default_factory=lambda: float(_env("VAD_MIN_SPEECH", "0.05")))

    cost_ceiling_usd: float = field(
        default_factory=lambda: float(_env("COST_CEILING_USD", "0.18"))
    )

    def tts_voice(self, language: str | None = None) -> str:
        """Voice id for a language, e.g. ``TTS_VOICE_HI``."""
        lang = (language or self.language).upper()
        return _env(f"TTS_VOICE_{lang}") or _env("TTS_VOICE")


def build_stt(cfg: SessionConfig) -> stt.STT:
    primary = _make_stt(cfg.stt_model, cfg.stt_language)
    if not cfg.stt_fallback:
        return primary
    return stt.FallbackAdapter([primary, _make_stt(cfg.stt_fallback, cfg.stt_language)])


def _make_stt(spec: str, language: str) -> stt.STT:
    provider, model = _split(spec)
    if provider == "deepgram":
        return deepgram.STT(model=model, language=language)
    # Anything else goes through the LiveKit inference gateway, which accepts
    # the same "provider/model" string.
    return inference.STT(model=spec, language=language)


def build_llm(cfg: SessionConfig) -> llm.LLM:
    primary = _make_llm(cfg.llm_model)
    if not cfg.llm_fallback:
        return primary
    return llm.FallbackAdapter([primary, _make_llm(cfg.llm_fallback)])


def _make_llm(spec: str) -> llm.LLM:
    provider, model = _split(spec)
    if provider == "anthropic":
        # Claude is not served by the inference gateway; use the plugin.
        return anthropic.LLM(model=model, caching="ephemeral")
    return inference.LLM(model=spec)


def build_tts(cfg: SessionConfig, language: str | None = None) -> tts.TTS:
    primary = _make_tts(cfg, cfg.tts_model, language)
    if not cfg.tts_fallback:
        return primary
    return tts.FallbackAdapter([primary, _make_tts(cfg, cfg.tts_fallback, language)])


def _make_tts(cfg: SessionConfig, spec: str, language: str | None) -> tts.TTS:
    provider, model = _split(spec)
    lang = language or cfg.language
    voice = cfg.tts_voice(lang)
    if provider == "cartesia":
        kwargs = {"model": model, "language": lang}
        if voice:
            kwargs["voice"] = voice
        return cartesia.TTS(**kwargs)
    if provider == "elevenlabs":
        kwargs = {"model": model}
        if voice:
            kwargs["voice_id"] = voice
        return elevenlabs.TTS(**kwargs)
    return inference.TTS(model=spec)


def build_vad(cfg: SessionConfig) -> vad.VAD:
    return silero.VAD.load(
        min_silence_duration=cfg.vad_min_silence,
        min_speech_duration=cfg.vad_min_speech,
    )


def build_turn_handling(cfg: SessionConfig) -> dict:
    """The ``turn_handling`` dict passed to ``AgentSession``.

    Uses the 1.8 nested surface; the flat ``turn_detection=`` /
    ``min_endpointing_delay=`` kwargs are deprecated.
    """
    return {
        "turn_detection": inference.TurnDetector(),
        "endpointing": {
            "mode": cfg.endpointing_mode,
            "min_delay": cfg.min_endpointing_delay,
            "max_delay": cfg.max_endpointing_delay,
        },
        "interruption": {
            "mode": cfg.interruption_mode,
            "min_duration": cfg.min_interruption_duration,
        },
        "preemptive_generation": {
            "enabled": cfg.preemptive_generation,
            "preemptive_tts": cfg.preemptive_tts,
        },
    }
