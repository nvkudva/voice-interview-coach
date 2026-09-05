# Decisions

## D1 — LiveKit Cloud, not self-hosted

Self-hosted LiveKit is out of scope for v1, and Cloud is what makes
`inference.TurnDetector()` and the adaptive interruption model available
without running GPU inference ourselves. Transport is metered per
participant-minute (~$0.015 per 5-minute two-party session) and folds into the
cost ceiling.

Reversible: the worker only reads `LIVEKIT_URL`. Point it at a self-hosted
server and the pipeline still runs — but `turn_detection` falls back to the
local `v1-mini` model, and the adaptive interruption detector is unavailable.
That is the real cost of self-hosting here, not the servers.

## D2 — Pipeline first, speech-to-speech benchmarked after

The STT-LLM-TTS pipeline is built first because it is the only architecture
that satisfies both swappable components and per-component cost attribution. A
realtime speech-to-speech model is one opaque box on both counts: you cannot
swap its TTS, and you cannot tell whether a slow turn was the model thinking or
the audio decoding.

The pipeline also produces the artifact the project exists to publish — a stage
by stage latency table. A realtime model produces one number.

Plan: milestone 3 publishes the pipeline's table. A follow-up runs the same
20-turn script against a realtime model and adds a column. The choice between
them then rests on measurements, not on which one sounded more modern.

Expect the realtime model to win on latency and lose on cost, controllability
and observability. Worth confirming rather than assuming.

## D3 — JSON files, not a database

Session records are one JSON file each under `DATA_DIR`. The record shape is
still moving, and the privacy requirement is "delete this session" — which a
file satisfies with `unlink()`. `agent/storage.py` is the whole interface;
swapping it for Postgres touches one module.

## D4 — Scoring runs through the session's own LLM

Rather than calling a provider SDK directly, `scoring.py` takes an `llm.LLM`
and streams a completion. Swapping `LLM_MODEL` in `.env` swaps the scorer with
the coach, and the scorer inherits the fallback adapter for free.

Trade-off: no structured-output mode, so the reply is parsed and validated
against a Pydantic model with one retry. A session that still fails is stored
as `"status": "unscored"` with the reason, never dropped.
