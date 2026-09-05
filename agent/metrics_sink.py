"""Per-turn latency, interruption, and cost accounting.

Metrics arrive as separate events with no turn number attached, so the sink
stitches them into turns: an ``EOUMetrics`` opens a turn, the LLM and TTS
metrics that follow fill it in, and the next EOU closes it.
"""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from typing import Any

from livekit.agents import metrics as lk_metrics

from . import pricing


@dataclass
class TurnMetrics:
    turn_index: int
    started_at: float = field(default_factory=time.time)
    eou_delay: float = 0.0
    transcription_delay: float = 0.0
    llm_ttft: float = 0.0
    tts_ttfb: float = 0.0
    stt_audio_duration: float = 0.0
    llm_input_tokens: int = 0
    llm_output_tokens: int = 0
    llm_cached_tokens: int = 0
    tts_characters: int = 0
    llm_model: str = ""
    tts_model: str = ""
    stt_model: str = ""

    @property
    def e2e_latency(self) -> float:
        """End of speech to first agent audio."""
        return self.eou_delay + self.transcription_delay + self.llm_ttft + self.tts_ttfb

    @property
    def cost_usd(self) -> float:
        return round(
            pricing.llm_cost(
                self.llm_model,
                self.llm_input_tokens,
                self.llm_output_tokens,
                self.llm_cached_tokens,
            )
            + pricing.tts_cost(self.tts_model, self.tts_characters)
            + pricing.stt_cost(self.stt_model, self.stt_audio_duration),
            6,
        )

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["e2e_latency"] = round(self.e2e_latency, 4)
        data["cost_usd"] = self.cost_usd
        return data


class MetricsSink:
    """Collects per-turn rows. Attach with ``session.on("metrics_collected", sink)``."""

    def __init__(self) -> None:
        self.turns: list[TurnMetrics] = []
        self.interruptions = 0
        self.backchannels = 0
        self._current: TurnMetrics | None = None

    # ---- collection -------------------------------------------------------

    def __call__(self, event: Any) -> None:
        self.collect(getattr(event, "metrics", event))

    def collect(self, m: Any) -> None:
        if isinstance(m, lk_metrics.EOUMetrics):
            self._current = TurnMetrics(turn_index=len(self.turns))
            self.turns.append(self._current)
            self._current.eou_delay = m.end_of_utterance_delay
            self._current.transcription_delay = m.transcription_delay
        elif isinstance(m, lk_metrics.LLMMetrics):
            turn = self._ensure_turn()
            # -1 means the response produced no tokens; do not average it in.
            if m.ttft >= 0:
                turn.llm_ttft = m.ttft
            turn.llm_input_tokens += m.prompt_tokens
            turn.llm_output_tokens += m.completion_tokens
            turn.llm_cached_tokens += m.prompt_cached_tokens
            turn.llm_model = _model_of(m) or turn.llm_model
        elif isinstance(m, lk_metrics.TTSMetrics):
            turn = self._ensure_turn()
            if not turn.tts_ttfb:
                turn.tts_ttfb = m.ttfb
            turn.tts_characters += m.characters_count
            turn.tts_model = _model_of(m) or turn.tts_model
        elif isinstance(m, lk_metrics.STTMetrics):
            turn = self._ensure_turn()
            turn.stt_audio_duration += m.audio_duration
            turn.stt_model = _model_of(m) or turn.stt_model
        elif isinstance(m, lk_metrics.InterruptionMetrics):
            # These counters are cumulative, not deltas.
            self.interruptions = m.num_interruptions
            self.backchannels = m.num_backchannels

    def _ensure_turn(self) -> TurnMetrics:
        if self._current is None:
            self._current = TurnMetrics(turn_index=len(self.turns))
            self.turns.append(self._current)
        return self._current

    # ---- reporting --------------------------------------------------------

    def latencies(self) -> list[float]:
        return [t.e2e_latency for t in self.turns if t.e2e_latency > 0]

    def percentile(self, p: float) -> float:
        values = sorted(self.latencies())
        if not values:
            return 0.0
        # Nearest-rank: with 20 turns, p95 is the 19th value. No interpolation,
        # so the reported number is a latency that actually happened.
        rank = max(1, min(len(values), round(p / 100 * len(values))))
        return round(values[rank - 1], 4)

    def summary(self, session_seconds: float = 0.0) -> dict[str, Any]:
        latencies = self.latencies()
        model_cost = round(sum(t.cost_usd for t in self.turns), 6)
        transport = round(pricing.transport_cost(session_seconds), 6)
        return {
            "turns": len(self.turns),
            "p50_latency": self.percentile(50),
            "p95_latency": self.percentile(95),
            "max_latency": round(max(latencies), 4) if latencies else 0.0,
            "mean_llm_ttft": _mean(t.llm_ttft for t in self.turns),
            "mean_tts_ttfb": _mean(t.tts_ttfb for t in self.turns),
            "mean_eou_delay": _mean(t.eou_delay for t in self.turns),
            "interruptions": self.interruptions,
            "backchannels": self.backchannels,
            "model_cost_usd": model_cost,
            "transport_cost_usd": transport,
            "total_cost_usd": round(model_cost + transport, 6),
        }

    def rows(self) -> list[dict[str, Any]]:
        return [t.to_dict() for t in self.turns]


def _model_of(m: Any) -> str:
    meta = getattr(m, "metadata", None)
    return (getattr(meta, "model_name", "") or "") if meta else ""


def _mean(values) -> float:
    values = [v for v in values if v]
    return round(sum(values) / len(values), 4) if values else 0.0
