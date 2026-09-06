# PRD — Real-Time Voice Interview Coach

**Status:** draft v1 · **Owner:** nvkudva · **Last updated:** 2026-09-05

A real-time LiveKit voice agent you can call, interrupt, and that calls tools.
Ships as a portfolio piece and as the reusable foundation for later voice products.

---

## 1. Problem

Voice demos that read well on paper fall apart on a real call. They talk over you,
they go silent for three seconds while a tool runs, and they cost money nobody
measured. This project builds one agent that survives a real conversation and
publishes the numbers that prove it.

## 2. Goals

| # | Goal | Measure |
|---|---|---|
| G1 | Natural turn-taking | p95 end-of-speech → first agent audio **< 800 ms** |
| G2 | Correct interruption | backchannel ("mhm", "right") does **not** stop the agent; a real interjection does, within 500 ms |
| G3 | Tool use without dead air | 3 tools; filler speech starts **< 600 ms** after a tool blocks |
| G4 | Structured output | every session emits a full transcript **and** a validated JSON score |
| G5 | Swappable stack | STT / LLM / TTS chosen from `.env`, zero provider names in agent logic |
| G6 | Known cost | per-session cost computed from real token/character counts, under **$0.18** per 5-minute session |
| G7 | Bilingual | English + Hindi, selected per session |
| G8 | Looks like a real interview | a photoreal coach on video, the candidate's camera on, both in one call |

## 3. Non-goals (v1)

Outbound calling · voice cloning · self-hosted LiveKit · multi-agent handoff.
Also out: authentication beyond a short-lived room token, mobile-native clients,
and persistent user accounts.

## 3a. The interview room

v1 shipped voice only. A voice in the dark is not what a system-design
interview feels like, and the gap matters: candidates rehearse being *watched*
as much as being heard.

So a session is a two-party video call. A photoreal avatar joins the room as
its own participant and speaks the coach's lines in lip-sync; the candidate's
camera is on; both appear as tiles, coach large and candidate inset, with a
device-check lobby before joining.

**How it works.** `avatar.start(session, room)` runs **before**
`session.start()`. Starting it rebinds the agent's audio tail to the avatar
worker over a data stream; the worker then publishes lip-synced video *and*
audio into the room on the agent's behalf, carrying
`lk.publish_on_behalf`. The browser subscribes to that participant, not the
agent. Get the order wrong and the first reply goes out as bare audio.

**Providers are swappable like every other leg** — `AVATAR_MODEL` takes
`lemonslice` (served by the LiveKit gateway, no second key), `tavus/<replica>`,
`bey/<avatar>` or `simli`. Plugins import lazily, so a provider you do not use
is a dependency you do not install.

**Failure degrades to voice, never to silence.** If the avatar does not join
within `AVATAR_JOIN_TIMEOUT`, the call proceeds with audio only, the client
shows a voice-only tile, and the session stops billing for video nobody saw.

**Video is optional and it is the expensive half** — `AVATAR_ENABLED=false`
returns the product to its original cost. See §10.

## 4. Persona

**A technical interview coach.** It opens with a system-design question, listens
through a long answer, pushes back on hand-waving, and scores the result.

Chosen deliberately: this persona is the hardest turn-taking case available.
Long user turns stress endpointing. Thinking-out-loud produces mid-sentence
pauses that a naive VAD reads as end-of-turn. The candidate interrupts the
coach's pushback. The output is genuinely structured. One persona exercises
every requirement.

**Behavioural contract**

1. Ask one system-design question. Stop talking.
2. Never interrupt a candidate who is mid-thought. Wait for a real end of turn.
3. When an answer is vague, name the vagueness and ask for the number.
   "You said it scales. To what — requests per second, or data volume?"
4. At most one pushback per claim. No lecturing.
5. Close with a spoken summary, then emit the JSON score silently.

**Rubric (5 dimensions, 0–4 each, 20 total)**

`requirements_clarification` · `high_level_design` · `data_modeling` ·
`scaling_and_tradeoffs` · `communication`

## 5. Architecture

```
Browser (WebRTC)  ─┐
                   ├─► LiveKit Cloud room ─► Python agent worker ─► STT ─► LLM ─► TTS
SIP inbound (PSTN)─┘                                │
                                                    ├─► tools (lookup / note / follow-up)
                                                    ├─► metrics sink ─► /api/metrics ─► dashboard
                                                    └─► on shutdown: transcript + JSON score
```

- **Worker**: `livekit-agents` 1.8.x Python, `AgentSession`, process-per-job.
- **Client**: static page, `livekit-client` JS, joins with a token from our API.
- **Control plane**: FastAPI — mints tokens, serves session records, deletes them.
- **Storage**: JSON files on disk in v1 (`data/sessions/<id>.json`). One interface,
  swap for Postgres later. No schema migration burden while the shape is moving.

## 6. Session configuration (reference)

The tuned configuration, expressed against the real `livekit-agents` 1.8 API.
`turn_handling` is the current surface; the flat `turn_detection=` /
`min_endpointing_delay=` kwargs are deprecated.

```python
session = AgentSession(
    stt=build_stt(),          # deepgram nova-3, language "multi"
    llm=build_llm(),          # Claude via livekit-plugins-anthropic
    tts=build_tts(),          # cartesia sonic-3
    vad=build_vad(),          # silero, min_silence_duration=0.2
    turn_handling={
        "turn_detection": inference.TurnDetector(),
        "endpointing": {"mode": "dynamic", "min_delay": 0.3, "max_delay": 2.5},
        "interruption": {"mode": "adaptive", "min_duration": 0.5},
        "preemptive_generation": {"enabled": True},
    },
)
```

**Why each value**

- `TurnDetector()` — LiveKit's semantic end-of-turn model. It reads the words,
  not just the silence, so "so the write path is…" holds the floor.
- `dynamic` endpointing — the delay adapts to how confident the detector is.
  `0.3 s` floor keeps a crisp "yes" fast; `2.5 s` ceiling covers a candidate
  thinking mid-sentence.
- `adaptive` interruption — an ML classifier separates backchannel from a real
  interjection. `vad` mode cannot: it only sees energy.
- `min_duration 0.5` — half a second of speech before we count it at all.
- **Silero `min_silence_duration=0.2`** — the audio EOT detector will not issue
  an inference until VAD reports at least 200 ms of silence. The plugin default
  is `0.55 s`, which alone would blow most of the 800 ms budget. This is the
  single highest-leverage tuning knob and is easy to miss.

## 7. Latency budget (800 ms, p95)

| Stage | Budget | Source |
|---|---|---|
| End of speech → EOT decision | 300 ms | `EOUMetrics.end_of_utterance_delay` |
| Final transcript | 100 ms | `EOUMetrics.transcription_delay` |
| LLM time-to-first-token | 250 ms | `LLMMetrics.ttft` |
| TTS time-to-first-byte | 120 ms | `TTSMetrics.ttfb` |
| Network / playout | 30 ms | client-side |
| **Total** | **800 ms** | |

Preemptive generation overlaps LLM work with the tail of the user's turn, so the
measured total is usually below the sum. `preemptive_tts` stays **off** in v1:
it cuts more latency but wastes TTS spend on every discarded draft, which fights
G6. Revisit once the cost ceiling has headroom.

## 8. Tools

All three take a `RunContext` and wrap the blocking work in
`ctx.with_filler(...)`, so the line never goes silent.

| Tool | Does | Filler |
|---|---|---|
| `lookup_concept(topic)` | returns a short reference note on a system-design concept | "Let me pull that up." |
| `save_note(text, tag)` | records a coaching observation against the session | "Noting that." |
| `schedule_follow_up(topic, days_from_now)` | books a follow-up practice slot | "Getting that on the calendar." |

`ctx.with_filler(source, delay=0.4)` waits for 400 ms of continuous idle before
speaking, so a fast tool never triggers a pointless "let me check".

## 9. Outputs

**Transcript** — every `conversation_item_added` event, appended live so a
crashed session still leaves a record.

**Score** — emitted on shutdown by one non-streaming LLM call over the
transcript, validated against a Pydantic model. Invalid JSON is retried once,
then stored with `"status": "unscored"` rather than lost.

```json
{
  "session_id": "sess_01H...",
  "question_id": "url_shortener",
  "language": "en",
  "total": 14,
  "scores": {
    "requirements_clarification": 3,
    "high_level_design": 3,
    "data_modeling": 2,
    "scaling_and_tradeoffs": 3,
    "communication": 3
  },
  "strengths": ["Asked about read/write ratio before designing."],
  "gaps": ["Never sized the database."],
  "hand_waving": [
    {"quote": "we'd just cache it", "why": "no eviction policy, no hit rate"}
  ],
  "next_drill": "Capacity estimation for a 10k RPS read path.",
  "status": "scored"
}
```

## 10. Metrics and cost

The session emits `metrics_collected` per turn. The sink keeps one row per turn:

`turn_index · stt_duration · eou_delay · transcription_delay · llm_ttft ·
tts_ttfb · e2e_latency · interruptions · backchannels · cost_usd`

`e2e_latency = eou_delay + transcription_delay + llm_ttft + tts_ttfb`.

Interruption counts come from `InterruptionMetrics`, which reports
`num_interruptions` and `num_backchannels` separately — that split is the direct
evidence for G2.

**Cost** uses `AgentSession.usage` → `AgentSessionUsage` (real tokens,
characters, audio seconds) against a rate table in `agent/pricing.py`.

**Ceiling: $0.85 per 5-minute session with video; $0.18 voice-only.**

The ceiling has moved twice, both times because the arithmetic said so. It
started at $0.12; costing the voice stack put it at **$0.15**, so it went to
$0.18. Adding the interview room moved it again, and much further — avatar
video bills per minute of **wall-clock**, not per minute of speech, so it costs
the same whether the coach talks or listens:

| Leg | Voice only | + lemonslice | + tavus |
|---|---|---|---|
| LLM (Sonnet, caching on) | $0.0675 | $0.0675 | $0.0675 |
| TTS (cartesia sonic-3) | $0.0288 | $0.0288 | $0.0288 |
| STT (deepgram nova-3) | $0.0385 | $0.0385 | $0.0385 |
| LiveKit transport | $0.0150 | $0.0150 | $0.0150 |
| **Avatar video** | — | **$0.500** | **$1.850** |
| **Total** | **$0.150** | **$0.650** | **$1.985** |

Two things follow, and both are uncomfortable enough to state plainly:

1. **Video is roughly four fifths of a session.** Every voice-side optimisation
   in this document — prompt caching, a terse persona, Haiku — together saves
   about $0.04. One minute of avatar video costs three times that. The LLM
   stopped being the lever the moment video was switched on.
2. **Tavus cannot fit the ceiling at all.** At $0.37/min a 5-minute session is
   **$1.99**, more than double $0.85. It is supported because it looks the
   best; it is not the default, and choosing it is choosing to breach the
   ceiling knowingly.

`AVATAR_ENABLED=false` returns the product to $0.15 and the original $0.18
ceiling. That switch, not the model choice, is the real cost decision.

Exceeding the ceiling fails the benchmark run, not the call — a caller is never
cut off over money.

The dashboard is a table in the browser client fed by a LiveKit data channel,
plus `GET /api/sessions/{id}/metrics` for after the fact.

## 11. Language support

English (`en`) and Hindi (`hi`).

- **STT**: Deepgram nova-3 with `language="multi"` — one model, code-switching
  handled, no restart on language change. Hinglish is the realistic input.
- **TTS**: per-language voice ID from `.env`; Cartesia sonic-3 covers both.
- **Turn detector**: `TurnDetector` reports `supports_language()`. If a language
  is unsupported the session falls back to `vad` endpointing and logs it, rather
  than silently mispredicting turns.
- **Prompt**: the coach answers in the candidate's language; the rubric and JSON
  score stay in English so scores compare across sessions.

## 12. Reliability

Every provider is wrapped in the framework's `FallbackAdapter`:
`stt.FallbackAdapter([primary, secondary])`, same for `llm` and `tts`. Secondary
providers come from `*_FALLBACK` variables in `.env`; if unset, the list has one
entry and the adapter is a no-op passthrough.

`SessionConnectOptions(max_unrecoverable_errors=3)` closes a session that is
failing repeatedly rather than leaving the caller on a dead line. The `error`
event triggers a spoken apology before close — never silence.

## 13. Privacy

No PII is collected beyond what the candidate says. Stored per session:
transcript, metrics, score, timestamps. No name, no email, no phone number —
inbound SIP caller ID is hashed before it is logged.

`DELETE /api/sessions/{id}` removes the transcript, metrics, and score. It
returns 204 on success and 204 for an already-absent session, so a delete is
idempotent. Retention default: **30 days**, enforced by a sweep on worker start.

## 14. Milestones

| # | Milestone | Done when |
|---|---|---|
| 1 | Console agent | `python -m agent.main console` holds one full turn |
| 2 | Browser client | deployed page joins a room and talks to the agent |
| 3 | Latency tuned | benchmark run reports p95 < 800 ms over 20 turns |
| 4 | Tools | all three fire, each with filler speech, no dead air |
| 5 | Persona + scoring | session end writes a validated JSON score |
| 6 | SIP inbound | a phone number reaches the agent |
| 6a | The interview room | avatar on video, candidate's camera on, device-check lobby |
| 7 | Public demo | link + README with the measured latency table |

## 15. Acceptance criteria

- [ ] p95 end-of-speech → first audio < 800 ms across ≥ 20 turns, table published
- [ ] 10 scripted backchannels interrupt the agent **0** times
- [ ] 10 scripted interjections interrupt the agent **10** times
- [ ] no gap > 800 ms between a tool call starting and audio resuming
- [ ] 5-minute session cost < $0.85 with video, < $0.18 without, from real usage
- [ ] the avatar joins within 20 s, or the call proceeds voice-only and says so
- [ ] the candidate's camera publishes, and can be stopped and restarted mid-call
- [ ] `.env` swap of TTS provider requires **no** code change
- [ ] one Hindi session completes with a valid score
- [ ] `DELETE /api/sessions/{id}` leaves no trace on disk

## 16. Decisions

Two decisions were flagged for a call before coding. Both are resolved by the
spec itself; recorded here with rationale, open to reversal.

**D1 — LiveKit Cloud, not self-hosted.**
Self-hosted LiveKit is explicitly out of scope for v1, and Cloud is what makes
`inference.TurnDetector()` and the adaptive interruption model available without
running GPU inference ourselves. Cost is metered per participant-minute and
folds into the G6 ceiling. Reversible: the worker only needs `LIVEKIT_URL` to
point elsewhere.

**D2 — STT-LLM-TTS pipeline first, then benchmark speech-to-speech.**
The pipeline is built first because it is the only architecture that satisfies
G5 (swappable components) and G6 (per-component cost attribution). A realtime
speech-to-speech model is a single opaque box on both counts. Milestone 3
publishes the pipeline's latency table; a follow-up benchmark runs the same
20-turn script against a realtime model and adds a second column. The decision
between them then rests on data, not preference.

## 17. Risks

| Risk | Mitigation |
|---|---|
| Long thinking pauses read as end-of-turn | semantic `TurnDetector` + `max_delay` 2.5 s; measured against a "thinking out loud" script |
| Preemptive generation inflates LLM spend | `max_speech_duration` 10 s caps attempts; discarded drafts tracked in the cost table |
| Rate table drifts and the ceiling silently lies | `AS_OF` date in `agent/pricing.py`; the benchmark prints it |
| Avatar spend runs away — it bills wall-clock, including silence | provider session is explicitly terminated on shutdown; a failed join clears `avatar_model` so nothing bills for video nobody saw |
| The avatar lands in the uncanny valley and hurts the demo | provider is one `.env` line; `AVATAR_ENABLED=false` is always the fallback |
| Video adds latency the 800 ms budget does not cover | the avatar sits downstream of TTS, so it moves lip-sync, not time-to-first-audio — but milestone 3 must re-measure with video on before the claim is repeated |
| Cartesia lacks a good Hindi voice | voice IDs are per-language `.env` values; ElevenLabs configured as the TTS fallback |
| SIP audio is 8 kHz and hurts STT | benchmark table reports browser and SIP rows separately |
| Provider outage mid-demo | `FallbackAdapter` on all three legs, exercised by a fault-injection test |
