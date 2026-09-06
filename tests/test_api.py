import pytest
from fastapi.testclient import TestClient

from agent import storage


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("LIVEKIT_URL", "wss://example.livekit.cloud")
    monkeypatch.setenv("LIVEKIT_API_KEY", "devkey")
    monkeypatch.setenv("LIVEKIT_API_SECRET", "devsecret-at-least-32-characters-long")
    from api import server

    return TestClient(server.app)


def test_token_carries_room_and_language(client):
    res = client.post("/api/token", json={"language": "hi"})
    assert res.status_code == 200
    body = res.json()
    assert body["room"].startswith("coach-")
    assert body["language"] == "hi"
    assert body["token"]


def test_unsupported_language_is_rejected(client):
    assert client.post("/api/token", json={"language": "fr"}).status_code == 400


def test_unknown_question_is_rejected(client):
    res = client.post("/api/token", json={"language": "en", "question_id": "nope"})
    assert res.status_code == 400


def test_delete_erases_the_record(client):
    storage.save("coach-abc", {"session_id": "coach-abc", "transcript": [{"text": "hi"}]})
    assert client.delete("/api/sessions/coach-abc").status_code == 204
    assert storage.load("coach-abc") is None


def test_delete_is_idempotent(client):
    assert client.delete("/api/sessions/never-existed").status_code == 204


def test_missing_session_is_404(client):
    assert client.get("/api/sessions/nope").status_code == 404


def test_config_exposes_the_budgets_the_client_renders_against(client):
    body = client.get("/api/config").json()
    assert body["latency_budget_seconds"] == 0.8
    assert body["cost_ceiling_usd"] == 0.85   # raised by avatar video
    assert "hi" in body["languages"]


def test_config_tells_the_client_whether_to_expect_video(client):
    body = client.get("/api/config").json()
    assert body["avatar_enabled"] is True
    assert body["camera_enabled"] is True
    assert body["avatar_model"] == "lemonslice"
