# Code review — voice-interview-coach

A LiveKit 1.8 voice/video agent that runs a system-design mock interview: a FastAPI control plane mints room tokens and dispatches a worker, the worker drives an STT-LLM-TTS pipeline with an optional photoreal avatar, stitches per-turn latency and cost metrics, and writes a JSON transcript plus an LLM-generated score to disk.

Read in full: `pyproject.toml`, `Makefile`, `.env.example`, `.github/workflows/ci.yml`, all of `agent/`, `api/server.py`, `bench/latency.py`, `README.md`, `sip/*.json`, `tests/conftest.py`, `tests/test_api.py`, `tests/test_avatar.py`, `tests/test_metrics.py` (partial). Skimmed only: `web/app.js` (1312 lines — read the fetch/DOM-sink call sites, not the rendering), `web/index.html`, `docs/`, `prd.md`, `design-canvas/`. Tests were not executed: no Python interpreter in this environment.

## Architecture

Four layers with clean seams:

- **Control plane** — `api/server.py`. `mint_token` (server.py:47) generates a random room name that doubles as the session id, embeds `{language, question_id}` as `RoomAgentDispatch` metadata on the JWT, and returns it. `/api/config` (server.py:89) deliberately republishes the worker's budgets so the client never holds a second copy of a threshold.
- **Worker** — `agent/main.py`. `entrypoint` (main.py:47) reads the dispatch metadata back out via `_read_job_metadata` (main.py:187), builds an `AgentSession` entirely from `agent/config.py` builders, attaches three event handlers, brings up the avatar *before* `session.start()` (main.py:139-145, the ordering is correct and the comment explains why), and registers `_finalize` as a shutdown callback.
- **Provider boundary** — `agent/config.py` and `agent/avatar.py`. Every model is a `provider/model` string resolved by `_split` (config.py:28); `_make_stt` / `_make_llm` / `_make_tts` special-case only the providers that are not on the LiveKit inference gateway and fall through to `inference.*` otherwise. The stated convention ("no provider names outside `agent/config.py`") holds, and `avatar._plugin` (avatar.py:92) keeps optional plugins lazily imported. This is the best-designed part of the repo.
- **State** — one JSON file per session under `DATA_DIR`, via `agent/storage.py`. In-memory state is `CoachUserdata` (main.py:32, transcript) and `MetricsSink` (turn rows, cost). `bench/latency.py` and every `/api/sessions*` route read the same files, so the CI gate, the API and the dashboard cannot disagree about what happened.

Data flows one way: browser → token → room metadata → worker → metrics events → `MetricsSink` → data channel topic `coach.metrics` (main.py:180) for live view, and → `storage.merge` at shutdown for the durable record.

What the structure gets right: `scoring.score_session` (scoring.py:117) takes an `llm.LLM` rather than importing a provider, which is why the scoring tests can fake the model with no network. Pricing is a pure data table (`agent/pricing.py`) with an `AS_OF` date. The avatar failure path degrades to voice and clears `sink.avatar_model` (main.py:170) so a call nobody saw is not billed as video.

Where it will hurt:

- `entrypoint` (main.py:47-145) is already doing metadata parsing, storage seeding, session construction, three inline event handlers, avatar bring-up and finalisation in one 100-line function. Every new concern — a second agent, a warm-transfer, a per-question preamble — lands here.
- `_on_item` (main.py:91) calls `storage.merge` on **every** conversation item. `merge` is a synchronous read-parse-update-serialise-rename of the entire record (storage.py:43), executed on the event loop, and the record contains the whole transcript so far. That is O(n²) blocking file I/O growing with session length, in a codebase whose own CLAUDE.md says "Nothing blocks the audio path."
- `MetricsSink` owns stitching, pricing and reporting at once. `_publish_metrics` (main.py:174) calls `sink.summary()` on every metrics event, and `summary` recomputes `cost_usd` for every turn from scratch (metrics_sink.py:145).
- `bench/latency.py` re-declares the latency budget (line 20) and re-implements nearest-rank percentile (line 41) that `metrics_sink.LATENCY_BUDGET_SECONDS` and `MetricsSink.percentile` already own. Two copies of the number the whole project exists to publish.

## Code quality

Error handling is mostly deliberate and well-commented: the avatar degrade path (main.py:148-171), `score_session` documented never to raise (scoring.py:123), the metrics publish that swallows a closed-room teardown (main.py:183). Types are consistently annotated, dataclasses are frozen where they should be, and Pydantic guards both the API surface and the scorer's output. No secrets are committed; `.env` is gitignored and `.env.example` ships blank values. Say it plainly: the config and pricing modules are good code.

The problems:

- **Metric attribution is probably wrong under the project's own default config.** `PREEMPTIVE_GENERATION=true` (.env.example) starts the LLM before end-of-turn is confirmed, so an `LLMMetrics` event can arrive before the `EOUMetrics` that should open its turn. `MetricsSink.collect` (metrics_sink.py:99) hands it to `_ensure_turn`, which attaches it to the *previous* turn or fabricates a turn with no EOU. The latency table this repo exists to publish is built on that stitching.
- **Partial turns are averaged into p95.** `e2e_latency` is a plain sum of four fields defaulting to 0.0 (metrics_sink.py:38), and `latencies()` (metrics_sink.py:132) admits any turn whose sum is greater than zero. A turn that recorded only `eou_delay` contributes ~0.25 s and pulls p95 down. There is no "turn is complete" predicate anywhere.
- **The score can be lost silently.** `_finalize` (main.py:114) awaits a full LLM completion inside a shutdown callback, and `scoring._complete` (scoring.py:94) sets no timeout. Framework shutdown callbacks are time-bounded; a slow provider means the session record is written without `score` and nothing logs why. The browser's 45-second poll (web/app.js:1035) then shows "taking longer than expected".
- **Fire-and-forget with no handle.** `asyncio.create_task(_publish_metrics(...))` (main.py:89) keeps no reference, so the task is eligible for garbage collection mid-await, and there is no bound on how many can be in flight during a metrics burst.
- **Empty environment variables defeat the defaults.** `_env` (config.py:24) returns `""` when a variable is set-but-empty, so `LLM_MODEL=` in a real `.env` raises `ValueError` from `_split` at worker start rather than using the documented default. Every `float(_env(...))` field (config.py:59, 70, 88, 92) raises an unlabelled `ValueError` on a typo.
- **Storage races.** `storage.merge` is read-modify-write with no lock or file lock. `save_note` (tools.py:96) and `schedule_follow_up` (tools.py:118) each do their own `load` → append → `merge`, concurrently with the transcript handler writing the same file. `storage.save` (storage.py:38) also never fsyncs before `replace`.
- **`sweep_expired` skips records without `created_at`** (storage.py:73 — `record.get("created_at", now)` defaults to *now*, i.e. never expired), so the 30-day retention promise in README.md:155 is not enforced for malformed records.
- **Test coverage is inverted.** 49 tests, and `tests/` covers pricing, avatar spec parsing, metrics stitching, storage, config and the API. Nothing covers `agent/main.py` (entrypoint, `_read_job_metadata`, `_source_of`, the avatar-failure branch) or `bench/latency.py` — the two files carrying the most untested branching.
- **Dead-ish code.** `pricing.session_cost` (pricing.py:75) is exercised only by its own test (tests/test_pricing.py:58) and called from no production path; the per-turn sink computes cost independently.
- **Doc drift.** README.md:160 says "34 tests" against an actual 49. README.md:50 states `$0.65 per 5-minute session` as fact — it is arithmetic from docs/cost.md, not a measurement, and unlike the latency table it is not flagged as unmeasured. The latency table (README.md:35-41) is entirely em-dashes, which the README does at least admit.
- `build_turn_handling` returns a bare `dict` (config.py:163) — the one untyped seam in an otherwise typed codebase, and the one whose shape the framework will change.

## Risks

- **Every API route is unauthenticated.** `GET /api/sessions` (server.py:115) enumerates every session on disk; `GET /api/sessions/{id}` (server.py:134) returns the full transcript; `DELETE /api/sessions/{id}` (server.py:150) erases any session by id. Deployed anywhere public, interview transcripts are world-readable and world-deletable by anyone who can guess or list an id — and listing needs no guessing.
- **`POST /api/token` is an unauthenticated, unmetered spend endpoint.** Each call mints a token that dispatches an agent (server.py:63-79). There is no rate limit, no concurrency cap and no ceiling enforcement, and avatar video bills wall-clock including silence (avatar.py:102). An idle room costs money for as long as it stays open.
- **Client-chosen identity.** `req.identity` (server.py:61) is copied verbatim into the JWT identity. A caller picks any identity string it likes.
- **The cost ceiling is observational only.** `_finalize` logs a warning when a session exceeds it (main.py:125). Nothing terminates or shortens a running session.
- **CI gate contradicts the configured ceiling.** `bench/latency.py:70` defaults `--cost-ceiling` to `0.18` while `COST_CEILING_USD` is `0.85` and docs/cost.md models `$0.65` with video. `make bench` fails on any avatar-enabled session as a matter of arithmetic, not of regression.
- **`CORS_ORIGINS` defaults to `*`** (server.py:27, .env.example) on an API with no auth.
- **CDN script with no integrity hash.** web/index.html:348 loads `livekit-client` from jsdelivr onto the page that handles room tokens; no `integrity` or `crossorigin` attribute.
- **Job start-up scales with retained sessions.** `storage.sweep_expired()` (main.py:49) runs synchronously before `ctx.connect()` and loads and parses every record on disk. At 30 days of retention this is on the critical path of every call.
- **No LICENSE file.** The README calls this a portfolio piece; without a licence nobody can legally reuse it, and the intent is unstated.

## Action items

| Priority | Item | File | Why |
|---|---|---|---|
| P0 | Put auth in front of every `/api/sessions*` route, or bind records to the token identity | `api/server.py:115` | Anonymous callers can list, read and delete every interview transcript |
| P0 | Rate-limit and authenticate `POST /api/token`; cap concurrent rooms | `api/server.py:47` | Unmetered endpoint that dispatches paid agents and wall-clock-billed avatar video |
| P0 | Reject or ignore `req.identity`; always mint a server-side handle | `api/server.py:61` | Client picks its own JWT identity |
| P0 | Move the per-item transcript write off the event loop (batch it, or `asyncio.to_thread`) | `agent/main.py:105` | Synchronous whole-record rewrite per turn blocks the audio path the project's budget depends on |
| P1 | Fix turn attribution when preemptive generation is on — key metrics by request/turn id, not arrival order | `agent/metrics_sink.py:99` | With the shipped default, LLM metrics can land on the wrong turn, invalidating the latency table |
| P1 | Exclude incomplete turns from `latencies()` — require all four stages before a turn counts | `agent/metrics_sink.py:132` | Partial turns sum to a small number and depress the published p95 |
| P1 | Give `_complete` a timeout and run scoring before shutdown (or persist a retry marker) | `agent/scoring.py:94` | A slow provider in a bounded shutdown callback loses the score with no log line |
| P1 | Hold a reference to the metrics-publish task and bound in-flight count | `agent/main.py:89` | Bare `create_task` can be garbage-collected mid-flight; bursts are unbounded |
| P1 | Reconcile the bench cost ceiling with `COST_CEILING_USD` — read it from config | `bench/latency.py:70` | `make bench` fails every avatar session against a stale `0.18` default |
| P1 | Make `sweep_expired` async/scheduled instead of running on every job start | `agent/main.py:49` | Parses every retained record before `ctx.connect()`, on the call's critical path |
| P1 | Treat a record with no `created_at` as expired, not as fresh | `agent/storage.py:73` | Retention promise silently skips malformed records |
| P1 | Add tests for `entrypoint`, `_read_job_metadata`, `_source_of` and the avatar-failure branch | `agent/main.py:47` | The most branch-heavy file has zero coverage |
| P1 | Add a LICENSE file | `README.md:9` | Published portfolio code with no grant of use |
| P2 | Default `CORS_ORIGINS` to `http://localhost:8080`, not `*` | `api/server.py:27` | Wildcard CORS on an unauthenticated API |
| P2 | Add `integrity` + `crossorigin` to the livekit-client CDN tag, or vendor it | `web/index.html:348` | Third-party script on the page that handles room tokens |
| P2 | Import the budget and percentile helper from `metrics_sink` instead of redefining them | `bench/latency.py:20` | Two copies of the number the project publishes will drift |
| P2 | Make `_env` fall back to the default when a variable is set but empty | `agent/config.py:24` | `LLM_MODEL=` in `.env` crashes the worker instead of using the documented default |
| P2 | Split `entrypoint` — metadata/setup, handler wiring, finalisation | `agent/main.py:47` | 100-line function that every future feature has to edit |
| P2 | fsync the temp file before `replace` | `agent/storage.py:38` | Write-then-rename without fsync can still leave an empty record after a crash |
| P2 | Correct "34 tests" and label the cost figures as modelled, not measured | `README.md:160` | Actual count is 49; the $0.65 figure is arithmetic from docs/cost.md while the latency table is honestly marked unmeasured |
| P2 | Delete `pricing.session_cost` and its test, or wire it into `_finalize` | `agent/pricing.py:75` | Unused path kept alive only by its own test |
