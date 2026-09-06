"""Control plane: mint room tokens, serve session records, delete them.

Run: uvicorn api.server:app --reload --port 8080
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from livekit import api
from pydantic import BaseModel, Field

from agent import config, metrics_sink, questions, storage

load_dotenv()

app = FastAPI(title="Interview Coach API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)


class TokenRequest(BaseModel):
    language: str = Field(default="en")
    question_id: str | None = None
    identity: str | None = None


class TokenResponse(BaseModel):
    url: str
    token: str
    room: str
    language: str


@app.post("/api/token", response_model=TokenResponse)
def mint_token(req: TokenRequest) -> TokenResponse:
    """Short-lived room token. The room name doubles as the session id."""
    if req.language not in config.SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"language must be one of {config.SUPPORTED_LANGUAGES}")
    if req.question_id and req.question_id not in questions.BY_ID:
        raise HTTPException(400, f"unknown question_id {req.question_id}")

    livekit_url = os.getenv("LIVEKIT_URL", "")
    key, secret = os.getenv("LIVEKIT_API_KEY", ""), os.getenv("LIVEKIT_API_SECRET", "")
    if not (livekit_url and key and secret):
        raise HTTPException(500, "LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set")

    room = f"coach-{uuid.uuid4().hex[:12]}"
    # No name, no email: the identity is a random handle, never a person.
    identity = req.identity or f"candidate-{uuid.uuid4().hex[:8]}"

    token = (
        api.AccessToken(key, secret)
        .with_identity(identity)
        .with_grants(api.VideoGrants(room_join=True, room=room, can_publish=True,
                                     can_subscribe=True, can_publish_data=True))
        .with_room_config(
            api.RoomConfiguration(
                agents=[
                    api.RoomAgentDispatch(
                        agent_name="interview-coach",
                        metadata=_metadata(req),
                    )
                ]
            )
        )
        .to_jwt()
    )
    return TokenResponse(url=livekit_url, token=token, room=room, language=req.language)


def _metadata(req: TokenRequest) -> str:
    import json

    return json.dumps({"language": req.language, "question_id": req.question_id})


@app.get("/api/config")
def client_config() -> dict[str, Any]:
    """Budgets and options the client renders against.

    The client must never carry its own copy of a threshold the worker owns —
    two sources of truth drift, and the one on screen is the one people trust.
    """
    cfg = config.SessionConfig()
    return {
        "languages": list(config.SUPPORTED_LANGUAGES),
        "default_language": cfg.language,
        "latency_budget_seconds": metrics_sink.LATENCY_BUDGET_SECONDS,
        "cost_ceiling_usd": cfg.cost_ceiling_usd,
    }


@app.get("/api/questions")
def list_questions() -> list[dict[str, str]]:
    return [{"id": q.id, "prompt": q.prompt_en} for q in questions.QUESTIONS]


@app.get("/api/sessions")
def list_sessions() -> list[dict[str, Any]]:
    out = []
    for session_id in storage.list_ids():
        record = storage.load(session_id) or {}
        out.append(
            {
                "session_id": session_id,
                "language": record.get("language"),
                "question_id": record.get("question_id"),
                "started_at": record.get("started_at"),
                "duration_seconds": record.get("duration_seconds"),
                "total": (record.get("score") or {}).get("total"),
                "cost_usd": (record.get("summary") or {}).get("total_cost_usd"),
            }
        )
    return out


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str) -> dict[str, Any]:
    record = storage.load(session_id)
    if record is None:
        raise HTTPException(404, "no such session")
    return record


@app.get("/api/sessions/{session_id}/metrics")
def get_metrics(session_id: str) -> dict[str, Any]:
    record = storage.load(session_id)
    if record is None:
        raise HTTPException(404, "no such session")
    return {"summary": record.get("summary", {}), "turns": record.get("turns", [])}


@app.delete("/api/sessions/{session_id}", status_code=204)
def delete_session(session_id: str) -> Response:
    """Erase a session. Idempotent: 204 whether or not it existed."""
    try:
        storage.delete(session_id)
    except ValueError:
        raise HTTPException(400, "invalid session id") from None
    return Response(status_code=204)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


_web = Path(__file__).resolve().parent.parent / "web"
if _web.exists():
    app.mount("/", StaticFiles(directory=_web, html=True), name="web")
