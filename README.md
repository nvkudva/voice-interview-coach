# voice-interview-coach

A LiveKit voice-and-video agent that runs a system-design mock interview and scores it, for anyone practising interviews or reading the code as a reference real-time agent.

Written as a portfolio piece; the full product spec is in [`prd.md`](prd.md).

[Docs](docs/)

## Requirements

- Python 3.11 or newer
- [`uv`](https://github.com/astral-sh/uv) and `make` — `make install` uses `uv venv` and `uv pip`
- A LiveKit Cloud project (URL, API key, API secret). Self-hosting is out of scope
- API keys for the default pipeline: Anthropic (LLM), Deepgram (STT), Cartesia (TTS)
- A webcam and microphone for the browser client. The avatar leg bills per minute of
  wall-clock video, so keep `AVATAR_ENABLED=false` unless you want to pay for it

## Run it

```bash
git clone https://github.com/nvkudva/voice-interview-coach.git
cd voice-interview-coach
make install
cp .env.example .env    # fill in the variables below
make console            # talk to the agent in the terminal
```

For the browser client, run the worker and the token server in two terminals:

```bash
make dev                # terminal 1: worker, connects to LiveKit Cloud
make api                # terminal 2: token server + static client on :8080
```

Working means `make console` holds a spoken turn in the terminal, and
`http://localhost:8080` puts you through a device-check lobby into a room where the
coach speaks and the transcript fills in.

## Configuration

`.env.example` lists every variable with comments. The ones you cannot skip:

| Variable | Required | What it is |
|---|---|---|
| `LIVEKIT_URL` | yes | `wss://` URL of your LiveKit Cloud project |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | yes | LiveKit credentials; the API server signs room tokens with them |
| `ANTHROPIC_API_KEY` | yes | Default LLM (`anthropic/claude-sonnet-4-6`) |
| `DEEPGRAM_API_KEY` | yes | Default STT (`deepgram/nova-3`, `language=multi`) |
| `CARTESIA_API_KEY` | yes | Default TTS (`cartesia/sonic-3`) |
| `AVATAR_ENABLED` | no | `true` joins a photoreal avatar on video. `false` is voice only |
| `STT_MODEL` / `LLM_MODEL` / `TTS_MODEL` | no | `provider/model` strings; swapping them needs no code change |
| `COST_CEILING_USD` | no | Logged-only warning threshold per session. Nothing enforces it |
| `CORS_ORIGINS` | no | Defaults to `*`. Narrow it before exposing the API |

## How it works

`api/server.py` mints a LiveKit room token, embedding the language and question id as
dispatch metadata, and serves the browser client in `web/`. `agent/main.py` is the
worker: it reads that metadata back, builds an `AgentSession` from the builders in
`agent/config.py`, brings up the optional avatar (`agent/avatar.py`) before the session
starts, and degrades to voice if the avatar never joins. Every model is a
`provider/model` string resolved in `agent/config.py`, so no provider name appears in
agent logic. `agent/metrics_sink.py` stitches per-turn STT, LLM and TTS metrics with
prices from `agent/pricing.py`, publishes them to the browser over a data channel, and
`agent/storage.py` writes one JSON file per session — transcript, turn metrics and an
LLM-generated score from `agent/scoring.py`. `bench/latency.py` reads those same files
to produce the latency table and act as a CI gate.

## Status

Not verified against a live call. The code for the console agent, browser client, tools
and scoring is written, but no milestone has been confirmed end to end against LiveKit
Cloud, and there is no deployed demo.

- **Latency:** the 800 ms p95 end-of-speech-to-first-audio figure is a **target**, not a
  measurement. No benchmark run exists. `make bench` builds the table from recorded
  sessions once there are any.
- **Cost:** roughly $0.65 per five-minute session with avatar video and $0.15 without.
  Both are **arithmetic from provider rate cards** in [`docs/cost.md`](docs/cost.md),
  not billed amounts.
- **Known defects:** every `/api/*` route is unauthenticated, so anyone who can reach
  the API can list, read and delete stored transcripts and mint agent-dispatching
  tokens. The transcript is rewritten to disk synchronously on every conversation item.
  With `PREEMPTIVE_GENERATION=true`, metrics can be attributed to the wrong turn, and
  incomplete turns are included in the percentile. See [`REVIEW.md`](REVIEW.md).
- **Tests:** `make test` runs the suite with no network and no API keys. It covers
  config, pricing, storage, metrics stitching, avatar spec parsing and the API routes.
  `agent/main.py` and `bench/latency.py` have no tests.
- **Not built:** SIP inbound number, public demo, and any authentication.

## License

No licence file yet — all rights reserved.
