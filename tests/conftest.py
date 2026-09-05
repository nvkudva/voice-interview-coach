import os
import tempfile

import pytest


@pytest.fixture(autouse=True)
def isolated_storage(monkeypatch):
    """Every test gets its own data directory."""
    with tempfile.TemporaryDirectory() as tmp:
        from pathlib import Path

        from agent import storage

        monkeypatch.setattr(storage, "DATA_DIR", Path(tmp))
        yield Path(tmp)


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for key in list(os.environ):
        if key.startswith(("STT_", "LLM_", "TTS_", "COACH_", "VAD_", "ENDPOINTING_")):
            monkeypatch.delenv(key, raising=False)
