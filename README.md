# Voice Interview Coach

A real-time LiveKit voice agent you can call, interrupt, and that calls tools.
It runs a system-design interview as a **video call**: a photoreal coach on
camera asks a question, listens through a long answer, pushes back on
hand-waving, and scores the result as JSON. Your camera is on too — you join
through a device-check lobby, the way you would join a real interview.

Built as a portfolio piece and as the foundation for later voice products.
Full spec in [`prd.md`](prd.md).

---

## What it does

- **It looks like the interview.** A photoreal avatar joins the room on video
  and speaks the coach's lines in lip-sync; your camera publishes alongside it.
  A failed avatar degrades to voice, never to silence.
- **Turn-taking that survives a real conversation.** Semantic end-of-turn
  detection, not a silence timer — thinking mid-sentence does not hand the
  floor to the agent.
- **Interruption that knows the difference.** "Mhm" does not stop it. "Wait,
  that's wrong" does. Both counted separately.
- **Three tools, no dead air.** Every tool speaks a filler phrase if it blocks.
- **Structured output.** Full transcript plus a validated JSON score per session.
- **Swappable everything.** STT, LLM and TTS come from `.env`. No provider name
  appears in agent logic.
- **English and Hindi**, including the Hinglish people actually speak.
- **Per-turn metrics dashboard.** STT, LLM TTFT, TTS TTFB, interruptions, cost.

## Latency

Target: **under 800 ms** from end of speech to first agent audio, p95.

| Stage | Budget | p50 | p95 | max |
|---|---|---|---|---|
| End of speech → EOT decision | 300 ms | — | — | — |
| Final transcript | 100 ms | — | — | — |
| LLM time-to-first-token | 250 ms | — | — | — |
| TTS time-to-first-byte | 120 ms | — | — | — |
| **Total** | **800 ms** | — | — | — |

Measured numbers land here after milestone 3. Fill it with `make bench`, which
reads real `EOUMetrics` / `LLMMetrics` / `TTSMetrics` from recorded sessions —
not a stopwatch. p95 is nearest-rank, so every number printed is a latency that
actually happened.

## Cost

**$0.65 per 5-minute session** with video, **$0.15** without. Avatar video
bills per minute of wall-clock — including silence — and is about four fifths
of a session, so `AVATAR_ENABLED=false` is a bigger saving than every voice-side
optimisation combined. Breakdown in [`docs/cost.md`](docs/cost.md).

## Quick start

```bash
cp .env.example .env      # fill in LiveKit + provider keys
make install
make console              # talk to it in the terminal
```

Then the browser client:

```bash
make dev                  # terminal 1: the agent worker
make api                  # terminal 2: token server + client on :8080
open http://localhost:8080
```

## Stack

| Layer | Default | Swap with |
|---|---|---|
| Transport | LiveKit Cloud | `LIVEKIT_URL` |
| STT | `deepgram/nova-3`, `language=multi` | `STT_MODEL` |
| LLM | `anthropic/claude-sonnet-4-6` | `LLM_MODEL` |
| TTS | `cartesia/sonic-3` | `TTS_MODEL` |
| Avatar | `lemonslice` | `AVATAR_MODEL` (or `AVATAR_ENABLED=false`) |
| VAD | silero, `min_silence_duration=0.2` | `VAD_MIN_SILENCE` |
| Turn detection | `inference.TurnDetector()` | — |

Each leg is wrapped in the framework's `FallbackAdapter` when a `*_FALLBACK` is
set, so a provider outage degrades instead of going silent.

## The configuration that matters

```python
AgentSession(
    turn_handling={
        "turn_detection": inference.TurnDetector(),
        "endpointing": {"mode": "dynamic", "min_delay": 0.3, "max_delay": 2.5},
        "interruption": {"mode": "adaptive", "min_duration": 0.5},
        "preemptive_generation": {"enabled": True},
    },
)
```

Plus the one default that will cost you 350 ms if you leave it alone: silero's
`min_silence_duration` ships at 0.55 s. Set it to 0.2 s and let the semantic
model decide when the turn ends, not the energy detector.
[`docs/tuning.md`](docs/tuning.md) has the rest.

## The interface

One page, two audiences, split by time rather than space. **During a call the
candidate owns the screen** — a status pill, the transcript, and three plain
chips. **After it the engineer does**: `Engineer view` (sticky, and
deep-linkable as `?view=engineer`) reveals the per-turn table, the p95, and the
cost line. `See a completed run` loads a stored session, so an evaluator can
read the numbers without talking to it.

Two ideas carry the visual identity:

- **The waveline is the app bar's rule.** There is no `border-bottom` — a
  hairline sits in its place and *is* the voice indicator: flat when idle, a
  one-pixel breath when the mic is open, a constant-rate travelling segment
  while thinking, a real waveform from the output analyser while speaking. It
  costs no layout and can be read peripherally while you talk.
- **The turn spine.** Transcript and metrics are one ledger indexed by the same
  mono turn number; hovering either side highlights the other. Density becomes
  navigation instead of a spreadsheet parked beside a chat.

Both themes follow the OS with an explicit toggle. Every over-budget value is
marked four ways — caret, weight, underline, and a bar that overshoots its tick
— so the page survives greyscale. Full specs in
[`docs/design-system.md`](docs/design-system.md) and
[`docs/ux-spec.md`](docs/ux-spec.md).

## Layout

```
agent/      worker, persona, tools, scoring, metrics, pricing
api/        token server, config, session read + delete
web/        browser client and metrics dashboard
bench/      latency table generator and CI gate
sip/        inbound trunk + dispatch rule
docs/       design system, UX spec, tuning, cost, decisions
```

## Milestones

- [ ] 1 · Console agent, one full turn (code in place, unverified against a live call)
- [x] 2 · Browser client built — video room, device lobby (deploy pending)
- [ ] 3 · Latency tuned, p95 under 800 ms over 20 turns
- [ ] 4 · Three tools with filler speech
- [ ] 5 · Coach persona and JSON scoring
- [ ] 6 · SIP inbound number
- [ ] 7 · Public demo link and this table filled in

## Privacy

Nothing is stored beyond the transcript, metrics and score. No name, no email;
inbound caller ID is never recorded. `DELETE /api/sessions/{id}` erases a
session and is idempotent. Records expire after 30 days.

## Development

```bash
make test     # 34 tests, no network, no API keys
make lint
make bench
```
