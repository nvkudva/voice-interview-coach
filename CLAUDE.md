# Voice Interview Coach

Real-time LiveKit voice agent: a technical interview coach. Spec in `prd.md`.

## Commands

```bash
make install      # uv venv + editable install with dev extras
make test         # pytest, no network and no API keys needed
make lint         # ruff check
make console      # talk to the agent in the terminal
make dev          # worker against LiveKit Cloud
make api          # token server + browser client on :8080
make bench        # latency table; exits non-zero if p95 > 800 ms
```

## Layout

| Path | Holds |
|---|---|
| `agent/` | worker, persona, tools, scoring, metrics, pricing |
| `api/` | token minting, session read, delete |
| `web/` | browser client and metrics dashboard |
| `bench/` | latency table generator and CI gate |
| `docs/` | tuning, cost, decisions |

## Conventions

**No provider names outside `agent/config.py`.** Models are `provider/model`
strings from `.env`. If you find yourself importing `cartesia` anywhere else,
the abstraction has leaked.

**Use the 1.8 nested `turn_handling` dict.** The flat `turn_detection=`,
`min_endpointing_delay=`, `min_interruption_duration=` kwargs on `AgentSession`
are deprecated.

**Latency numbers come from framework metrics, never a stopwatch.**
`EOUMetrics`, `LLMMetrics.ttft`, `TTSMetrics.ttfb`. `ttft` of `-1` means the
response produced no tokens — do not average it in.

**Prices are data.** `agent/pricing.py` carries an `AS_OF` date. Correcting a
rate must never require touching agent code.

**Nothing blocks the audio path.** Metrics publishing, storage writes and
scoring are fire-and-forget or run at shutdown.

**Tests must not need network or API keys.** Fake the LLM (see
`tests/test_scoring.py`); construct metrics objects directly.

## Gotchas that cost real time

- `silero.VAD.load()` defaults `min_silence_duration` to **0.55 s**. The EOT
  detector will not infer until VAD reports silence, so that default alone eats
  most of the 800 ms budget. Pinned to 0.2 s in `config.py`.
- Claude is **not** served by the LiveKit inference gateway. It comes from
  `livekit-plugins-anthropic`; `inference.LLM` covers OpenAI, Google, Kimi,
  DeepSeek, ZAI and xAI.
- `AgentSessionUsage` exposes `model_usage`, not `models`.
- `metrics.Metadata` lives in `livekit.agents.metrics.base`, not the package root.
- **`avatar.start()` must run before `session.start()`.** Starting the avatar
  rebinds the agent's audio tail to the avatar worker, which then publishes
  lip-synced video *and* audio on the agent's behalf. Start it after and the
  first reply goes out as bare audio with no video.
- With an avatar running, the browser subscribes to the **avatar** participant,
  not the agent. It carries `lk.publish_on_behalf` set to the agent's identity.
- Avatar video bills per minute of wall-clock, not per minute of speech, and it
  dominates every other cost line. A failed avatar must clear
  `MetricsSink.avatar_model` or the session bills for video nobody saw.
