from livekit.agents import metrics as lk
from livekit.agents.metrics.base import Metadata

from agent.metrics_sink import MetricsSink


def _meta(name):
    return Metadata(model_name=name, model_provider="test")


def _turn(sink, *, eou=0.25, stt=0.08, ttft=0.22, ttfb=0.11):
    sink.collect(
        lk.EOUMetrics(
            timestamp=0.0,
            end_of_utterance_delay=eou,
            transcription_delay=stt,
            on_user_turn_completed_delay=0.0,
        )
    )
    sink.collect(
        lk.LLMMetrics(
            label="llm", request_id="r", timestamp=0.0, duration=1.0, ttft=ttft,
            cancelled=False, completion_tokens=100, prompt_tokens=2000,
            prompt_cached_tokens=1500, total_tokens=2100, tokens_per_second=90.0,
            metadata=_meta("claude-sonnet-4-6"),
        )
    )
    sink.collect(
        lk.TTSMetrics(
            label="tts", request_id="r", timestamp=0.0, ttfb=ttfb, duration=1.0,
            audio_duration=3.0, cancelled=False, characters_count=180, streamed=True,
            metadata=_meta("sonic-3"),
        )
    )


def test_e2e_latency_is_the_sum_of_the_four_stages():
    sink = MetricsSink()
    _turn(sink)
    assert abs(sink.turns[0].e2e_latency - (0.25 + 0.08 + 0.22 + 0.11)) < 1e-9


def test_each_eou_opens_a_new_turn():
    sink = MetricsSink()
    _turn(sink)
    _turn(sink)
    assert len(sink.turns) == 2
    assert [t.turn_index for t in sink.turns] == [0, 1]


def test_p95_is_a_latency_that_actually_happened():
    sink = MetricsSink()
    for i in range(20):
        _turn(sink, ttft=0.10 + i * 0.01)
    assert sink.percentile(95) in {round(t.e2e_latency, 4) for t in sink.turns}


def test_negative_ttft_is_not_counted():
    """The framework reports -1 when a response generated no tokens."""
    sink = MetricsSink()
    _turn(sink, ttft=-1.0)
    assert sink.turns[0].llm_ttft == 0.0


def test_backchannels_are_counted_separately_from_interruptions():
    sink = MetricsSink()
    _turn(sink)
    sink.collect(
        lk.InterruptionMetrics(
            timestamp=0.0, total_duration=0.1, prediction_duration=0.05,
            detection_delay=0.2, num_interruptions=2, num_backchannels=7, num_requests=9,
        )
    )
    summary = sink.summary(session_seconds=300)
    assert summary["interruptions"] == 2
    assert summary["backchannels"] == 7


def test_summary_totals_model_and_transport_cost():
    sink = MetricsSink()
    _turn(sink)
    summary = sink.summary(session_seconds=300)
    assert summary["model_cost_usd"] > 0
    assert summary["transport_cost_usd"] > 0
    assert summary["total_cost_usd"] == round(
        summary["model_cost_usd"] + summary["transport_cost_usd"], 6
    )
