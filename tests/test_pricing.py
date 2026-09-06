from agent import pricing


def test_cached_tokens_are_cheaper():
    full = pricing.llm_cost("claude-sonnet-4-6", 100_000, 1_000)
    cached = pricing.llm_cost("claude-sonnet-4-6", 100_000, 1_000, cached_tokens=90_000)
    assert cached < full


def test_provider_prefix_is_stripped():
    assert pricing.llm_cost("anthropic/claude-sonnet-4-6", 1_000_000, 0) == 3.0


def test_unknown_model_costs_zero_not_crash():
    assert pricing.llm_cost("some/unlisted-model", 1_000, 1_000) == 0.0


def _five_minute_session(llm_model: str) -> float:
    """A coach that mostly listens: ~20 turns, prompt caching on, ~1.2k spoken chars.

    Cumulative LLM input across the session is ~60k tokens, most of it a cached
    system prompt and transcript prefix. Output stays small because the persona
    is terse.
    """
    return (
        pricing.llm_cost(llm_model, 60_000, 1_500, cached_tokens=50_000)
        + pricing.tts_cost("sonic-3", 1_200)
        + pricing.stt_cost("nova-3", 300)
        + pricing.transport_cost(300)
    )


def test_voice_only_stack_fits_its_own_ceiling():
    """Voice-only — no avatar video. The room ceiling is set in test_avatar."""
    cost = _five_minute_session("claude-sonnet-4-6")
    assert cost < 0.18, f"{cost:.4f} breaches the voice-only $0.18 ceiling"


def test_the_cheap_stack_is_the_lever_for_a_lower_ceiling():
    """Swapping the LLM is the only single change that moves cost materially."""
    assert _five_minute_session("claude-haiku-4-5") < 0.12


class _Usage:
    def __init__(self, models):
        self.model_usage = models


class _LLMUsage:
    type = "llm_usage"
    model = "claude-sonnet-4-6"
    input_tokens = 10_000
    output_tokens = 500
    input_cached_tokens = 0


def test_session_cost_breaks_out_each_leg():
    legs = pricing.session_cost(_Usage([_LLMUsage()]))
    assert legs["llm"] > 0
    assert legs["tts"] == 0.0
    assert legs["total"] == legs["llm"]
