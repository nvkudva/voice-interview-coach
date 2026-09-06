import pytest

from agent import avatar


def test_parses_provider_and_id():
    spec = avatar.parse_spec("tavus/r665388ec672")
    assert spec.provider == "tavus"
    assert spec.avatar_id == "r665388ec672"


def test_provider_alone_is_valid():
    spec = avatar.parse_spec("lemonslice")
    assert spec.provider == "lemonslice"
    assert spec.avatar_id is None


def test_empty_spec_fails_loudly():
    with pytest.raises(ValueError):
        avatar.parse_spec("/only-an-id")


def test_avatar_bills_on_wall_clock_not_speech():
    """A five-minute call bills five minutes of video however little is said."""
    assert avatar.avatar_cost("tavus/r1", 300) == pytest.approx(0.37 * 5)
    assert avatar.avatar_cost("lemonslice", 300) == pytest.approx(0.10 * 5)


def test_unknown_provider_uses_a_conservative_rate():
    assert avatar.avatar_cost("someone-new", 60) == pytest.approx(avatar.DEFAULT_AVATAR_RATE)


def test_video_is_the_dominant_cost_line():
    """The premise of the cost section: video swamps the whole voice stack."""
    from agent import pricing

    voice = (
        pricing.llm_cost("claude-sonnet-4-6", 60_000, 1_500, cached_tokens=50_000)
        + pricing.tts_cost("sonic-3", 1_200)
        + pricing.stt_cost("nova-3", 300)
        + pricing.transport_cost(300)
    )
    assert avatar.avatar_cost("lemonslice", 300) > voice * 3


def test_unsupported_provider_names_the_supported_ones():
    with pytest.raises(ValueError, match="lemonslice"):
        avatar.build_avatar("nope/xyz")


def test_missing_plugin_says_how_to_install_it():
    with pytest.raises(ImportError, match="uv pip install"):
        avatar._plugin("definitely_not_a_plugin")
