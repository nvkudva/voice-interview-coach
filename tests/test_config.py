from agent import config


def test_defaults_match_the_prd():
    cfg = config.SessionConfig()
    assert cfg.min_endpointing_delay == 0.3
    assert cfg.max_endpointing_delay == 2.5
    assert cfg.endpointing_mode == "dynamic"
    assert cfg.interruption_mode == "adaptive"
    assert cfg.min_interruption_duration == 0.5
    assert cfg.preemptive_generation is True
    # Silero's own default of 0.55 s would eat most of the 800 ms budget.
    assert cfg.vad_min_silence == 0.2


def test_env_overrides_every_model(monkeypatch):
    monkeypatch.setenv("TTS_MODEL", "elevenlabs/eleven_turbo_v2_5")
    monkeypatch.setenv("LLM_MODEL", "openai/gpt-4o-mini")
    cfg = config.SessionConfig()
    assert cfg.tts_model == "elevenlabs/eleven_turbo_v2_5"
    assert cfg.llm_model == "openai/gpt-4o-mini"


def test_turn_handling_shape():
    cfg = config.SessionConfig()
    th = config.build_turn_handling(cfg)
    assert th["endpointing"] == {"mode": "dynamic", "min_delay": 0.3, "max_delay": 2.5}
    assert th["interruption"] == {"mode": "adaptive", "min_duration": 0.5}
    assert th["preemptive_generation"]["enabled"] is True
    assert th["turn_detection"] is not None


def test_voice_is_per_language(monkeypatch):
    monkeypatch.setenv("TTS_VOICE", "default-voice")
    monkeypatch.setenv("TTS_VOICE_HI", "hindi-voice")
    cfg = config.SessionConfig()
    assert cfg.tts_voice("hi") == "hindi-voice"
    assert cfg.tts_voice("en") == "default-voice"


def test_bad_model_spec_fails_loudly():
    import pytest

    with pytest.raises(ValueError):
        config._split("nova-3")
