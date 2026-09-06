"""Worker entrypoint.

Run a console session:      python -m agent.main console
Connect to LiveKit Cloud:   python -m agent.main dev
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, JobContext, WorkerOptions, cli

from . import config, questions, scoring, storage
from .metrics_sink import MetricsSink
from .persona import InterviewCoach

load_dotenv()
logger = logging.getLogger("interview-coach")

METRICS_TOPIC = "coach.metrics"
"""Data-channel topic the browser dashboard subscribes to."""


@dataclass
class CoachUserdata:
    """Passed to tools via ``RunContext.userdata``."""

    session_id: str
    language: str
    question_id: str
    transcript: list[dict[str, Any]] = field(default_factory=list)


def prewarm(proc: agents.JobProcess) -> None:
    """Load the VAD weights once per process, not once per call."""
    proc.userdata["vad"] = config.build_vad(config.SessionConfig())


async def entrypoint(ctx: JobContext) -> None:
    cfg = config.SessionConfig()
    storage.sweep_expired()

    await ctx.connect()

    language, question_id = _read_job_metadata(ctx, cfg)
    question = questions.pick(question_id)
    session_id = ctx.room.name

    userdata = CoachUserdata(
        session_id=session_id,
        language=language,
        question_id=question.id,
    )
    storage.merge(
        session_id,
        language=language,
        question_id=question.id,
        started_at=time.time(),
        source=_source_of(ctx),
    )

    session: AgentSession[CoachUserdata] = AgentSession(
        stt=config.build_stt(cfg),
        llm=config.build_llm(cfg),
        tts=config.build_tts(cfg, language),
        vad=ctx.proc.userdata.get("vad") or config.build_vad(cfg),
        turn_handling=config.build_turn_handling(cfg),
        userdata=userdata,
    )

    sink = MetricsSink(cost_ceiling_usd=cfg.cost_ceiling_usd)
    started = time.monotonic()

    @session.on("metrics_collected")
    def _on_metrics(event) -> None:
        sink.collect(event.metrics)
        # Fire and forget: a dashboard update must never block the audio path.
        asyncio.create_task(_publish_metrics(ctx, sink, started))

    @session.on("conversation_item_added")
    def _on_item(event) -> None:
        text = event.item.text_content
        if not text:
            return
        userdata.transcript.append(
            {
                "role": event.item.role,
                "text": text,
                "at": event.created_at,
                "interrupted": event.item.interrupted,
            }
        )
        # Persist as we go so a crashed session still leaves a transcript.
        storage.merge(session_id, transcript=userdata.transcript)

    @session.on("error")
    def _on_error(event) -> None:
        logger.error("session error: %s", event)

    async def _finalize() -> None:
        elapsed = time.monotonic() - started
        summary = sink.summary(session_seconds=elapsed)
        score = await scoring.score_session(config.build_llm(cfg), userdata.transcript)
        storage.merge(
            session_id,
            ended_at=time.time(),
            duration_seconds=round(elapsed, 2),
            transcript=userdata.transcript,
            turns=sink.rows(),
            summary=summary,
            score=score,
            notes_count=len(storage.load(session_id).get("notes", [])),
        )
        if summary["over_ceiling"]:
            logger.warning(
                "session cost %.4f exceeded ceiling %.4f",
                summary["total_cost_usd"],
                cfg.cost_ceiling_usd,
            )
        logger.info("session %s scored: %s", session_id, score.get("total", "n/a"))

    ctx.add_shutdown_callback(_finalize)

    await session.start(InterviewCoach(question, language), room=ctx.room)


async def _publish_metrics(ctx: JobContext, sink: MetricsSink, started: float) -> None:
    payload = {
        "summary": sink.summary(session_seconds=time.monotonic() - started),
        "turns": sink.rows()[-10:],
    }
    try:
        await ctx.room.local_participant.publish_data(
            json.dumps(payload).encode(), topic=METRICS_TOPIC, reliable=True
        )
    except Exception as exc:  # a closed room during teardown is normal
        logger.debug("metrics publish skipped: %s", exc)


def _read_job_metadata(ctx: JobContext, cfg: config.SessionConfig) -> tuple[str, str | None]:
    """Language and question come from room metadata, set by the token API."""
    raw = getattr(ctx.job, "metadata", "") or ""
    try:
        meta = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        meta = {}
    language = meta.get("language", cfg.language)
    if language not in config.SUPPORTED_LANGUAGES:
        logger.warning("unsupported language %r, falling back to %s", language, cfg.language)
        language = cfg.language
    return language, meta.get("question_id")


def _source_of(ctx: JobContext) -> str:
    for participant in ctx.room.remote_participants.values():
        if participant.attributes.get("sip.callID"):
            return "sip"
    return "web"


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name="interview-coach",
        )
    )
