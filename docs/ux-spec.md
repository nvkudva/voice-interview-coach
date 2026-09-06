# UX Specification — Real-Time Voice Interview Coach (web client)

**Status:** draft v1 · **Owner:** nvkudva (PM) · **Last updated:** 2026-09-06
**Companion docs:** `prd.md` (product spec), visual design in parallel (not this document)
**Scope:** behaviour, states, information architecture, copy, priority. Not visual design. Not code.

---

## 0. The central tension, and how it is resolved

Two audiences share one page:

- **The candidate** is mid-task. They are speaking out loud, thinking, and being pushed back on. Every pixel that moves competes with the thing they are trying to do. Their success condition is *forgetting the machinery exists*.
- **The hiring engineer** is evaluating the build. They want the p95 table, the interruption/backchannel split, and the cost line. Their success condition is *seeing the machinery clearly, fast, without having to trust a claim*.

"Show both" is not a resolution — it produces a dashboard the candidate cannot ignore and an engineer's table nobody can read while talking.

### The resolving principle: **split by time, not by space**

> **During the call, the candidate owns the screen. After the call, the engineer owns it.**

This works because the engineer's evidence is inherently *retrospective*. A per-turn latency table is unreadable while you are speaking — by anyone, including the engineer. A p95 needs a population before it means anything. Nothing of value is lost by deferring the table to the moment the call ends, and everything is gained: the live screen becomes calm.

Three consequences, all of them deliberate:

1. **Live, the metrics collapse to three chips.** Not seven tiles and a table. Three numbers, chosen because each maps to exactly one PRD goal and each is legible to a non-engineer: reply gap (G1), turn-taking split (G2), cost so far (G6). They are text, they update on turn boundaries only, and they never animate. See §5.
2. **The full engineering surface is a mode, not a panel.** `Engineer view` is a persistent toggle, off by default, sticky in `localStorage`, and deep-linkable as `?view=engineer`. The portfolio link in the README ships with `?view=engineer` in it, so a hiring engineer lands in it without touching anything. A candidate arriving from anywhere else never sees it.
3. **The engineer does not have to talk to the machine to see the numbers.** The pre-call screen carries a secondary path — `See a completed run` — that loads a stored session from `GET /api/sessions` straight into the post-call layout: full turn table, full score, transcript. An evaluator with four minutes and no microphone still gets the proof. This is the single highest-leverage decision in the spec for the portfolio audience.

**What this is not:** it is not a persona switch on the pre-call screen ("Are you a candidate or a recruiter?"). Asking a visitor to self-classify before they know what the product is, is a tax with no payoff, and it makes the engineering surface feel like a hidden back room rather than an owned claim.

---

## 1. Design posture: "modern and distinctive yet familiar corporate", behaviourally

The brief is a feeling. Here is what it means in behaviour, which is what a designer and an engineer can actually build against.

### Corporate-trustworthy behaviour

| Behaviour | Why it reads as trustworthy |
|---|---|
| Every number carries a unit and a definition on hover/focus | A number without units is a claim; a number with a definition is evidence |
| States never lie or overstate — `connecting` means connecting, and there is a distinct `waiting for coach` | Precision under uncertainty is the whole product thesis |
| Figures set in a monospace face; prose in the text face | The eye can compare a column of digits; it signals "instrument", not "marketing" |
| Motion only when it carries state. Nothing loops, nothing idles, nothing breathes | Idle animation is decoration; state-bearing motion is information |
| Errors name the failure *and* the next action, and say what happened to the user's data | An error that only apologises is a liability |
| `Delete this session` is present, prominent enough to find, and actually works (§13 of the PRD) | Reversibility is the cheapest trust signal there is |
| Empty states show the shape of what will arrive, not a shrug | Predictability |
| Restraint under load: when latency goes over budget the UI marks it plainly and does not go red-alert | Confidence is not needing to shout |

### Toy behaviour — explicitly forbidden

Bouncing orbs. Particle fields. A waveform visualiser during speech. A microphone button that pulses like a heartbeat. Gradient meshes in motion. Confetti or any celebration on a good score. Sound effects. Emoji in the interface chrome. A score that counts up with a drumroll. Progress bars that are not measuring anything. "Oops!", "Yay", "Awesome". Exclamation marks anywhere in the product copy.

### Distinctive — the one strong idea

**The turn ribbon.** A single thin horizontal band under the transcript that grows left-to-right for the length of the session. One segment per turn, the segment's width proportional to how long that speaker held the floor, and the segment styled to show whose turn it was. Interruptions appear as a notch at the boundary where they occurred.

It earns its place because it is *the same object for both audiences*:

- For the candidate it answers a question they actually have: "am I talking too much / did I let it ask anything?"
- For the engineer, in Engineer view, hovering or focusing a segment shows that turn's `e2e_latency`, `llm_ttft`, `tts_ttfb` and `cost_usd` — the ribbon is the affordance into the per-turn data.
- It is a document artefact, not a novelty. It does not move while you speak; it appends a segment when a turn closes.

One distinctive element, executed calmly, is the whole aesthetic strategy. Everything else is familiar corporate furniture done well.

---

## 2. Screens and states

There is **one page**. Everything below is a state of it, not a route — with one exception, `?view=engineer` and `?session=<id>`, which are URL parameters over the same page so a state can be linked.

### State machine

```
                     ┌─────────────── error ──────────────┐
                     │                                    │
  idle ──▶ connecting ──▶ waiting-for-coach ──▶ LIVE ──▶ ending ──▶ scoring ──▶ scored
   │           │                  │              │                      │
   │           │                  └── no-coach ──┘                      └──▶ unscored
   │           └── permission-denied / no-microphone
   │
   └──▶ reviewing (a past session, loaded from the API — no call)

  LIVE is a substate machine driven by `lk.agent.state`:
     coach-listening ⇄ coach-thinking ⇄ coach-speaking   (+ tool-running, + interrupted)
```

### 2.1 `idle` — pre-call

**Sees:** Product name and one-line description. A short explainer of what is about to happen (§9 copy). Two selects: Language (English / Hindi), Question (Random + the list from `GET /api/questions`). One primary button, `Start call`. Below it, quietly: `See a completed run` and the `Engineer view` toggle. A privacy line.

**Changed from:** nothing — this is entry.

**Can do:** pick language, pick question, start, open a past run, flip Engineer view, read the explainer.

**Notes:** the question list comes from `GET /api/questions`. If that fetch fails, the select shows only `Random` and no error is surfaced — Random still works, and a broken dropdown on a screen the user is not looking at is not worth an error message. Focus rests on `Start call` on load.

### 2.2 `connecting`

**Sees:** the `Start call` button becomes disabled and its label changes to `Connecting`. Status line reads `Connecting`. The transcript and metrics regions render their empty states so the layout does not jump when content arrives.

**Changed:** controls locked; layout has settled to its live shape.

**Can do:** nothing except wait. No cancel button — the window is under two seconds in the normal case, and a cancel affordance that is on screen for 1.5s is noise. If `POST /api/token` or `room.connect` has not resolved in **8 seconds**, move to `error` with a retry.

### 2.3 `permission-denied` / `no-microphone`

Two distinct states, from the `getUserMedia` rejection name: `NotAllowedError` → permission denied, `NotFoundError` / `OverconstrainedError` → no microphone found. Both are reached from `connecting` and both **disconnect the room** rather than leaving a live, silent participant on the line.

**Sees:** an inline block replacing the transcript region — heading, one line of cause, one line of remedy specific to the case, and a `Try again` button. Browser-specific instructions are *not* attempted; a generic "in your browser's address bar" is honest and does not go stale.

**Changed:** returned to a variant of idle, controls unlocked.

**Can do:** fix the permission and retry, or read the explainer. `See a completed run` stays available and becomes the more prominent path here — a visitor who declined the microphone can still evaluate the product.

### 2.4 `waiting-for-coach`

Room connected, local mic published, **no agent participant yet**. Detected client-side: no remote participant of `ParticipantKind.AGENT`, or none carrying the `lk.agent.state` attribute.

**Sees:** status line `Waiting for the coach`. Transcript region shows the empty state. Hang-up button is live.

**Changed:** the room is up; the candidate is not yet expected to speak. This distinction matters — an "in call" indicator shown before the agent has joined trains people to talk into a void.

**Can do:** hang up. After **10 seconds** with no agent, transition to `no-coach` (§8.5).

### 2.5 `LIVE` — the call

Governing rule: **the layout does not change during the call.** Only text content and one status indicator change. Any reflow while someone is speaking is a distraction with no upside.

Persistent during LIVE: status indicator, elapsed timer, `End call` button, mute control, transcript, turn ribbon, three metric chips, session id, `Delete this session`.

The LIVE substates, all driven by the `lk.agent.state` participant attribute (`initializing | idle | listening | thinking | speaking`) plus client-side local-audio detection:

#### 2.5.1 `coach-listening` (`lk.agent.state === "listening"`, no local speech)

**Sees:** status reads `Listening`. A steady, unmoving indicator. Nothing else changes.
**Signal given:** the floor is yours and the machine is not about to take it.

#### 2.5.2 `user-speaking` (`listening` + local audio above threshold)

**Sees:** status reads `Hearing you`. The indicator moves to its "receiving" form — a **two-state change, not an amplitude visualiser** (see §6). Interim transcription text, if available, appears as a single dimmed provisional line at the bottom of the transcript.
**Signal given:** your microphone is working and audio is arriving. This is the single most valuable live signal in the product and the one people miss most.
**Can do:** talk. Interrupt. Mute. End the call.

#### 2.5.3 `coach-thinking` (`lk.agent.state === "thinking"`)

**Sees:** status reads `Thinking`. Provisional user line is committed to the transcript as final.
**Signal given:** your turn ended and was accepted. This is the acknowledgement that stops people from repeating themselves into the silence.
**Note:** the framework reports tool execution as `thinking` too, so `tool-running` is not separable today — see §12 BC-1.

#### 2.5.4 `coach-speaking` (`lk.agent.state === "speaking"`)

**Sees:** status reads `Coach speaking`. Coach lines append to the transcript as final segments arrive.
**Signal given:** it is the coach's floor — but the product promise is you may take it, so nothing about this state should look like a "wait" or a lock. No disabled affordances, no "please wait".

#### 2.5.5 `tool-running`

**Today:** indistinguishable from `coach-thinking`; the candidate instead hears the filler line ("Let me pull that up"), which is the intended UX and works without any screen affordance. **v1 ships no visual tool indicator.**
**With BC-1:** status reads `Looking something up` and, in Engineer view only, a chip shows the tool name and elapsed ms. That chip is proof of G3 and belongs to the engineer, not the candidate.

#### 2.5.6 `interrupted`

**Today:** the client has no per-event interruption signal. The `interruptions` / `backchannels` counters arrive with the next `coach.metrics` publish — one turn late, and cumulative.
**v1 behaviour:** the turn-taking chip updates when the counters change, and the ribbon draws a notch on the boundary. No live "you interrupted" callout.
**Deliberately not shipped:** a client-side heuristic (agent state leaving `speaking` while local RMS is high). It would be wrong often enough to undermine the exact claim it is meant to prove. See BC-2.

#### 2.5.7 `reconnecting`

Room-level, from `RoomEvent.Reconnecting` / `Reconnected`.
**Sees:** status reads `Reconnecting`; the transcript dims to indicate it may be incomplete; the timer keeps running.
**Signal:** do not keep talking — the audio may not be arriving.
**Can do:** hang up. On `Reconnected`, return to the prior LIVE substate and clear the dim.

### 2.6 `ending`

From `End call`, or the coach ending, or `RoomEvent.Disconnected`.

**Sees:** status `Call ended`. Controls unlock. Transcript freezes in place and remains scrollable. Metric chips freeze at their last values.
**Changed:** the room is gone; the metric numbers are now final-so-far and the score is not yet written.
**Can do:** read the transcript, delete the session, start another call.

### 2.7 `scoring`

The score is produced in the worker's shutdown callback (`_finalize`), *after* the room closes. It does not arrive on the data channel. The client polls `GET /api/sessions/{id}` until the record has a `score` key.

**Sees:** transcript stays on screen and readable — this is the point of doing it this way, the wait is filled by something the user actually wants. In the panel where the score will render: a labelled placeholder, `Scoring your session`, with the five rubric dimension names already listed and greyed, so the shape of the answer is visible before the answer is.
**Poll schedule:** 1s, then 2s, then every 3s, hard stop at **45 seconds** → `score-timeout` (§8.6).
**Can do:** read the transcript, delete the session, start another call. Deleting during scoring is allowed and cancels the poll.

### 2.8 `scored`

Full detail in §4.

### 2.9 `unscored`

`score.status === "unscored"`. The record carries a `reason`.

**Sees:** the coaching panel is replaced by an honest block: the session was recorded, the score was not produced, here is why in plain words, and the transcript is intact below.
**Can do:** read and copy the transcript, delete the session, start another call, and — with BC-6 — `Try scoring again`.

### 2.10 `error`

Any failure that stops the call proceeding: token mint failed, LiveKit connect failed, connect timed out, unrecoverable session errors.

**Sees:** a block in the transcript region with `role="alert"`: what failed, whether anything was saved, and a `Try again` button. The raw error string is available under a `Details` disclosure, not in the headline — the current client's `String(err).slice(0, 80)` in the status pill is the anti-pattern being replaced.

### 2.11 `reviewing` — a past session, no call

Entered from `See a completed run`, or a `?session=<id>` URL.

**Sees:** the post-call layout in full — score, transcript, and the complete per-turn table from `GET /api/sessions/{id}/metrics` — with a persistent banner reading that this is a recorded session, not a live call. `Start call` remains available.
**Why it exists:** it is the evaluator's fast path, and it is also how a candidate reviews last week's attempt. One state, two audiences, no extra surface.

---

## 3. Information architecture

### 3.1 What is on screen at once

**Pre-call (idle)** — one column, centred, at most one scroll:

1. Name + one-line positioning
2. Explainer: three short lines about what will happen (§9.1)
3. Controls: Language, Question, `Start call`
4. Secondary row: `See a completed run` · `Engineer view` toggle
5. Privacy line

**During the call** — two zones, the second one small:

1. **Conversation zone (primary, ~70% of the content width on desktop):** status indicator + elapsed timer + `End call` + mute; the transcript; the turn ribbon.
2. **Proof strip (secondary, one row):** three chips — `Reply gap`, `Turn-taking`, `Cost`. Below the ribbon, above the fold on desktop, single row, never taller than one line of text plus a label.

That is all. No table, no tiles, no seven-metric grid during a live call.

**After the call:** the conversation zone stays where it is and the coaching panel opens above it (the score is the answer to the question the user just spent five minutes on; it should not be below the fold). The proof strip stays. In Engineer view, the full per-turn table opens beneath.

### 3.2 Progressive disclosure, and the justification for each demotion

| Element | Placement | Justification for the demotion |
|---|---|---|
| **Per-turn metrics table** | Engineer view only, and post-call by default even there | It is 7 columns × N rows of monospace digits. It is unreadable while speaking and meaningless before there is a population. Nothing is lost by deferring it; the live screen gains everything. |
| **`p50`, `max_latency`, `mean_eou_delay`, `mean_llm_ttft`, `mean_tts_ttfb`** | Engineer view summary block | p95 is the number the PRD commits to (G1, <800 ms). The others are diagnostics for the person debugging the budget, not evidence for the person evaluating it. Showing five latency figures at once flattens the one that matters. |
| **`model_cost_usd` / `transport_cost_usd` split** | Engineer view; the chip shows `total_cost_usd` | The split is an attribution question (a D2 argument, per PRD §16). The claim is "under $0.18 a session". |
| **Token and character counts** (`llm_input_tokens`, `llm_output_tokens`, `llm_cached_tokens`, `tts_characters`, `stt_audio_duration`) | Engineer view, per-turn table, horizontally scrolled columns | These are how the cost is *derived*. They matter to someone auditing the arithmetic, and to nobody else. Their presence in the table is itself the credibility signal — the cost is not a guess. |
| **Model identifiers** (`llm_model`, `tts_model`, `stt_model`) | Engineer view; surfaced to everyone *only* when they change mid-session (fallback — §8.3) | Static configuration is not news. A change mid-session is. |
| **Full transcript** | Always visible, both modes | Not a demotion — it is the candidate's primary artefact and the engineer's context for a latency spike. |
| **`Delete this session`** | Persistent, footer, low visual weight, always enabled once a session id exists | Must be findable without hunting (PRD §13), must not compete with `End call`. |
| **Language / Question selects** | Pre-call only; hidden entirely during a call | They cannot be changed mid-session and a disabled control that can never be enabled is clutter. |
| **Session id** | Footer, monospace, selectable | Engineers copy it to hit `/api/sessions/{id}`. Candidates ignore it. It costs one line. |
| **Rubric definitions (0–4 level wording)** | Behind a `How this is scored` disclosure in the coaching panel, open by default on first visit only | It is the difference between "you got a 2" and "you reasoned without numbers". Essential the first time, noise the fifth. |
| **`hand_waving` quotes** | In the coaching panel, below strengths and the dimensions | Ordering is a coaching decision, not a space decision. See §4. |

### 3.3 The Engineer view toggle

- Off by default. Sticky per browser in `localStorage`. Overridable by `?view=engineer`.
- **What it changes:** adds the summary block and the per-turn table; adds tool chips (with BC-1); adds model identifiers, token counts and the raw score JSON (`Copy score JSON`); shows the latency budget line on the ribbon.
- **What it never changes:** the transcript, the score's coaching framing, or the three chips. Engineer view *adds*; it does not swap out a different product. An engineer must see exactly what the candidate sees, plus more — otherwise they cannot evaluate the candidate experience, which is half of what they are there to judge.
- Label: `Engineer view`. Not "Advanced", not "Debug", not a gear icon. It names its audience, which tells a candidate immediately that it is not for them and tells an engineer immediately that it is.

---

## 4. The score reveal

### 4.1 The problem

A JSON object with a total out of 20 is a verdict. Delivered as one, after someone has spent five minutes being pushed back on, it lands as a judgement about them. The same data, reordered, is coaching. **The reordering is the entire design.**

### 4.2 Rules

1. **The total is never the headline.** It appears, because hiding it would be coy and an engineer wants to see the rubric produce a number — but it sits in the panel's meta line at body-text size next to the duration and the question: `14 of 20 · url_shortener · 5m 12s`. It is a fact about the session, not a grade on the person.
2. **The first thing read is what went well.** `strengths` leads.
3. **No pass/fail language and no colour-coded verdict.** No red total, no "needs improvement" banner. Dimension levels are described in the rubric's own words rather than judged.
4. **Nothing is celebrated and nothing is commiserated.** No confetti at 18, no sympathy at 6.
5. **It ends on an action.** `next_drill` is the last thing on screen and the only primary button in the panel.
6. **The transcript is adjacent.** Every claim in the score is checkable against what was actually said, in the same scroll.
7. **The panel does not animate in.** It renders. Focus moves to its heading (`tabindex="-1"`), which announces it once to a screen reader without a live region firing mid-render.

### 4.3 Layout, top to bottom

```
┌─ Your session ─────────────────────────────────────────────┐
│ Design a URL shortener…      14 of 20 · 5m 12s · English   │  ← meta line, quiet
├────────────────────────────────────────────────────────────┤
│ WHAT WORKED                                                │  ← strengths[]
│  · Asked about read/write ratio before designing.          │
│  · Named the cache eviction policy without prompting.      │
├────────────────────────────────────────────────────────────┤
│ HOW IT SCORED                          How this is scored ▾│  ← the 5 dimensions
│  Requirements clarification   3  reasoned with numbers     │
│  ███████████░░░░                                           │
│  High-level design            3  reasoned with numbers     │
│  ███████████░░░░                                           │
│  Data modelling               2  reasoned without numbers  │
│  ███████░░░░░░░░                                           │
│  Scaling and tradeoffs        3  reasoned with numbers     │
│  ███████████░░░░                                           │
│  Communication                3  reasoned with numbers     │
│  ███████████░░░░                                           │
├────────────────────────────────────────────────────────────┤
│ WHERE TO GO DEEPER                                         │  ← gaps[]
│  · Never sized the database.                               │
├────────────────────────────────────────────────────────────┤
│ MOMENTS TO TIGHTEN                                         │  ← hand_waving[]
│  “we'd just cache it”                                      │
│   No eviction policy, no hit rate.                         │
├────────────────────────────────────────────────────────────┤
│ NEXT DRILL                                                 │  ← next_drill
│  Capacity estimation for a 10k RPS read path.              │
│  [ Practise this ]                    Copy score JSON ⧉    │  ← ⧉ = Engineer view only
└────────────────────────────────────────────────────────────┘
```

### 4.4 The five dimensions

- Rendered as five rows: human-readable dimension name, the integer 0–4, **the rubric's own wording for that level**, and a five-step bar.
- The level wording comes verbatim from `agent/scoring.py`: `0 absent · 1 named but not reasoned · 2 reasoned without numbers · 3 reasoned with numbers · 4 reasoned with numbers and an explicit tradeoff`. This is the whole trick. "Data modelling: 2" is a grade. "Data modelling: reasoned without numbers" is an instruction.
- The bar is **discrete — five steps, not a continuous fill** — because the scale is ordinal. A continuous bar implies 2.5 exists.
- Bars are the same colour at every level. **A dimension is never coloured red for being low.** The bar encodes magnitude by length; length is already colour-independent (§7.4). The numeral is present in every row, so the bar is decoration over data, never the only carrier.
- `How this is scored` disclosure holds the full 0–4 table. Open by default on first visit (`localStorage` flag), collapsed after.

### 4.5 Strengths, gaps, hand-waving

- **`strengths` → "What worked".** First position. If the array is empty, the section is omitted rather than showing "None" — an empty praise list rendered as a heading with nothing under it is worse than no heading.
- **`gaps` → "Where to go deeper".** Not "Weaknesses", not "Problems". The content is unchanged; the frame is forward-looking.
- **`hand_waving` → "Moments to tighten".** Each entry is one card: the `quote` set as a quotation, and `why` directly beneath as plain text. The quote is verbatim from the candidate (the scorer is instructed not to invent quotes), which is what makes this land as observation rather than opinion — the user recognises their own sentence.
  - **Where possible, link the quote to the transcript.** v1: a `Find in transcript` control that scrolls to and highlights the first transcript line containing the quote as a substring. If no match, the control is not rendered. No backend change; substring matching against the transcript already on screen. This is what turns the score from an assertion into evidence.
- Every list is capped at 5 by the Pydantic model, so no truncation UI is needed.

### 4.6 `next_drill`

- Terminal position, and the only primary action in the panel.
- **v1:** `next_drill` is free text and does not map to a question in the bank. The button therefore reads `Practise again` and starts a fresh call with the same question preselected, with the drill text quoted above it so the user carries the intent themselves.
- **With BC-5** (`next_drill_question_id`): the button becomes `Practise this` and starts a call on the mapped question directly. This is the single highest-value backend addition for the candidate audience — it closes the loop from score to next session in one click.

### 4.7 Engineer view additions to the panel

`Copy score JSON` (the raw object, which is the G4 proof), plus the score `status` field shown explicitly. Nothing else — the coaching panel is not where the engineer's evidence lives.

---

## 5. The metrics dashboard

### 5.1 Data available, exactly as it arrives

From the `coach.metrics` data topic (`agent/main.py`), published after **every** `metrics_collected` event, as `{summary, turns}` where `turns` is **only the last 10 rows** (`sink.rows()[-10:]`):

**`summary`:** `turns · p50_latency · p95_latency · max_latency · mean_llm_ttft · mean_tts_ttfb · mean_eou_delay · interruptions · backchannels · model_cost_usd · transport_cost_usd · total_cost_usd`

**each row in `turns`:** `turn_index · started_at · eou_delay · transcription_delay · llm_ttft · tts_ttfb · stt_audio_duration · llm_input_tokens · llm_output_tokens · llm_cached_tokens · tts_characters · llm_model · tts_model · stt_model · e2e_latency · cost_usd`

All latencies are **seconds** (floats); costs are USD.

Post-call, the same shapes come from `GET /api/sessions/{id}/metrics` with the **complete** turn list.

**Two client obligations that follow from the contract:**

1. **Accumulate turns by `turn_index`.** The live payload is capped at ten rows, so the client keeps a map keyed on `turn_index` and upserts. Since a publish happens on every metrics event, no turn is ever missed in practice. Without this, a 20-turn session shows only turns 10–19 live. *(This is a client fix, not a backend change — do not raise the cap and inflate the data channel.)*
2. **Nothing arrives until the first turn closes.** The first `EOUMetrics` only fires after the candidate's first utterance ends. The metrics area must therefore have a real empty state for the first 30–60 seconds of every session (§8.1).

### 5.2 Permanent screen space: three chips

| Chip | Source | Live label | Why it earns the space |
|---|---|---|---|
| **Reply gap** | `summary.p50_latency` live, `p95_latency` after the call | `Reply gap 610 ms` | The one latency number a candidate can also feel. Live it is p50 (a single sample is not a p95 and pretending otherwise is dishonest); post-call it switches to p95, labelled, because that is the PRD's commitment. |
| **Turn-taking** | `summary.interruptions`, `summary.backchannels` | `Turn-taking 2 interruptions · 5 ignored` | The direct evidence for G2 and the product's actual differentiator. Two integers. |
| **Cost** | `summary.total_cost_usd` | `Cost $0.0412` | Nobody else shows this. It is the cheapest credibility in the product, and a candidate reads it as "this is what my practice cost", which is a legitimate thing to want to know. |

Chips update **on turn boundaries only** (a new payload arrives), never mid-utterance. They do not animate; the text is replaced. Four significant figures on cost, whole milliseconds on latency.

### 5.3 How a non-engineer reads it without being alienated

- **Plain-language label first, engineering term second.** The chip says `Reply gap`. Its tooltip/`aria-describedby` says: *Time from you finishing to the coach starting to speak. Target: under 800 ms.* The engineering name (`e2e_latency`) appears only in Engineer view's table header.
- **A target, not a raw number.** `610 ms` alone means nothing to a non-engineer. `610 ms · target 800` is instantly readable by anyone. The target is `LATENCY_BUDGET` from PRD §7.
- **`interruptions` vs `backchannels` must be explained where it appears**, because the words are jargon and the split is the interesting bit. Chip detail text: *You interrupted 2 times and the coach stopped. You said "mhm" 5 times and it kept going.* That sentence converts a metrics row into the product claim, for both audiences at once.
- **Over-budget is marked, not alarmed.** A value above target gets a caret glyph and the word `over` — `860 ms ▲ over` — plus weight. It does not turn the panel red. Restraint here is a trust signal: the product knows the difference between a miss and a failure.
- **Nothing a non-engineer sees is unlabelled.** No bare `TTFB` on the default surface.

### 5.4 How an engineer gets the full picture

In Engineer view, below the conversation zone:

**Summary block** — one row of labelled figures: `p50 · p95 · max · mean EOU · mean LLM TTFT · mean TTS TTFB · turns · interruptions · backchannels · model cost · transport cost · total cost`. p95 carries the budget comparison prominently. Live, it is also stamped `n turns so far` — a p95 over four turns is not a p95 and the UI should say so.

**Per-turn table** — one row per turn, horizontally scrollable in its own container, sticky header, monospace, right-aligned numerics:

`# · EOU · Transcription · LLM TTFT · TTS TTFB · **e2e** · $ · in/out/cached tok · TTS chars · STT s · models`

- `e2e` is visually the anchor column; the four components read as its decomposition, mirroring the PRD §7 budget table exactly. An engineer comparing the built thing to the spec should not have to translate.
- Rows over budget are marked with a caret glyph **and** a text marker, never colour alone.
- **Column label fix:** the current client heads `transcription_delay` as `STT`, which collides with `stt_audio_duration` and with "STT latency" generally. Head it `Transcription` and reserve `STT s` for audio seconds.
- **Sort is fixed at `turn_index` ascending.** A latency table you can sort by latency invites cherry-picking; the honest artefact is chronological.
- `Copy as CSV` and `Copy as JSON`. An evaluator's instinct is to take the numbers away and check them. Let them.

**The ribbon becomes interactive:** hover or keyboard-focus a segment → that turn's row highlights in the table and a small readout shows its `e2e_latency`. This is the connective tissue between "the conversation felt like this" and "here are the numbers for that moment".

---

## 6. Live conversation feedback

### 6.1 Principles

The user is **talking**, which means they are not reading. Live feedback must be legible in a quarter-second glance from peripheral vision, and must not reward looking at it. A waveform visualiser is disqualified on both counts: it is continuously interesting, so it pulls the eye, and it conveys amplitude, which is not information the speaker needs.

**Rule: one indicator, four discrete forms, no continuous values.** Plus a status word, because a word is unambiguous and a shape is not.

### 6.2 The state signals

| State | Source | Word | Indicator | The specific question it answers |
|---|---|---|---|---|
| **Listening** | `lk.agent.state = "listening"`, no local speech | `Listening` | Steady, open form | "Is it my turn?" — yes, and nothing is happening |
| **Hearing you** | `listening` + local audio above threshold | `Hearing you` | Same form, **filled** | "Is my microphone actually working?" — the single most anxious question during a voice call, and the only one worth a real-time signal |
| **Thinking** | `lk.agent.state = "thinking"` | `Thinking` | Third discrete form | "Did my turn end, or is it still waiting for me?" — this is the acknowledgement that prevents people repeating themselves into silence |
| **Coach speaking** | `lk.agent.state = "speaking"` | `Coach speaking` | Fourth discrete form | "Whose floor is it?" — with nothing implying you may not take it |
| **Reconnecting** | `RoomEvent.Reconnecting` | `Reconnecting` | Neutral + transcript dimmed | "Is my audio getting through?" — no, stop talking |

### 6.3 The one place amplitude is used, and how it is contained

Local microphone level is measured client-side (Web Audio `AnalyserNode` over the local track) and used **only as a threshold with hysteresis** — a boolean, not a level:

- Cross above threshold for **120 ms** → `Hearing you`.
- Fall below for **400 ms** → back to `Listening`.

The asymmetry is deliberate: fast to confirm you are heard, slow to release, so the indicator does not flicker between words. **The level is never rendered.** No bar, no ring, no waveform. It drives a two-state change and nothing more.

### 6.4 The transcript as the honest feedback channel

The strongest "I am being understood" signal is not an indicator, it is **your own words appearing**. Currently `web/app.js` drops every non-final segment (`if (!seg.final) continue;`). Change: render interim segments for the local participant as a **single provisional line at the bottom of the transcript**, visually distinguished as unsettled, replaced in place as it updates, and committed when a final segment arrives.

- Only one provisional line ever exists — interim text does not append.
- Provisional text is `aria-hidden="true"` (§7.2); it is visual reassurance, and reading half-recognised words aloud to a screen reader user is noise.
- Coach interim segments are **not** rendered. The user can hear the coach; racing text against speech splits attention and reads as a chat app, not a call.

### 6.5 The turn ribbon during the call

Appends one segment when a turn closes. It does not move, pulse or scroll while someone is speaking. Its live job is to answer "am I dominating this?" at a glance — a candidate whose ribbon is one enormous block has learned something the score will tell them later anyway.

### 6.6 Explicitly not shipped

Waveforms. Circular level meters. An avatar. A "typing" animation while the coach thinks. Latency numbers ticking mid-turn. Audio cues on state change. A countdown timer to some target answer length.

---

## 7. Responsive behaviour

### 7.1 Desktop (≥ 1024 px)

Two columns during a call: conversation zone left (~2fr), proof strip and — in Engineer view — the summary block right (~1fr). The per-turn table is full-width beneath. Post-call, the coaching panel takes the full content width above the conversation zone. Max content width ~1100 px, as today.

### 7.2 Tablet (600–1023 px)

Single column, stacked: controls → status → transcript → ribbon → chips → (Engineer view: summary, then table). The transcript keeps a fixed height with internal scroll so the chips stay reachable. The per-turn table keeps its own horizontal scroll container; it is never allowed to widen the page. Touch targets ≥ 44 px.

### 7.3 Phone (< 600 px) — designed for a device at your ear

The governing assumption: **the phone is against the user's ear or face-down on a desk on speaker.** The screen is unwatched for most of the call. When it *is* looked at, it is a one-second glance, one-handed, to answer "is this still going and how do I stop it".

**What must be visible during a live call, in this order:**

1. **`End call`** — full-width, bottom of the viewport, in the thumb zone, fixed. It is the only thing someone reaches for in a hurry.
2. **Status word + elapsed timer** — one line, large, top. `Listening · 3:14`.
3. **Mute** — secondary, adjacent to `End call`.

**What is dropped on a phone during a live call — not reflowed, removed from the DOM:**

| Dropped | Where it goes | Why |
|---|---|---|
| **The three metric chips** | Post-call only | Nobody reads a cost figure with a phone at their ear. Keeping them costs the vertical space that `End call` needs. |
| **The entire Engineer view surface** (summary block, per-turn table) | Post-call, and `?view=engineer` still works post-call | A 12-column monospace table on a 375 px screen is not a compromise, it is a defect. An engineer evaluating on a phone is reviewing, not calling. |
| **The turn ribbon** | Post-call | Its live value is glanceable proportion; at 340 px wide with 20 turns the segments are sub-pixel. |
| **The transcript** | Collapsed to **the last coach line only**, one to three lines, non-scrolling | This is the sharpest call in the spec. A scrolling transcript on a phone invites you to *read* while you are supposed to be *speaking*, and reading your own words back mid-sentence derails an answer. Keeping the last coach line preserves the one genuine use — "what did it just ask me?". A `Show transcript` control expands the full scroll for someone who wants it. |
| **Language / question selects** | Pre-call only, as everywhere | Unchanged. |

**Post-call on a phone, everything returns**, in this order: coaching panel → full transcript → chips → Engineer view surfaces if enabled. Reviewing is a lean-back activity and the screen is now being looked at.

**Landscape phone:** treated as phone, not tablet — the constraint is context, not width.

### 7.4 Cross-cutting

- No horizontal page scroll at any width. Only the per-turn table scrolls horizontally, inside its own container.
- Never gate anything on hover. Every hover affordance (ribbon segment detail, metric definitions) has a tap/focus equivalent.
- The layout must not reflow when the LIVE substate changes at any breakpoint. Reserve the space that the longest status string needs.

---

## 8. Empty, loading, and failure states

### 8.1 Empty: metrics before the first turn

**When:** from connection until the first `EOUMetrics` — roughly the first 30–60 seconds of every session, since the coach asks its question and the candidate then talks at length.
**Sees:** the chips render with their labels and an em-dash value, plus one line: `Numbers appear after your first answer.` In Engineer view the table renders its header row and the same line in the body.
**Why:** the chips must occupy their final size from the start so nothing jumps when data lands. An explanation converts "broken" into "not yet".

### 8.2 Empty: no past sessions

`See a completed run` with an empty `GET /api/sessions`. Sees: `No past sessions on this server yet. Start a call and one will appear here.` The control is still shown, not hidden — hiding it would make the feature undiscoverable on a fresh deploy, which is exactly when an evaluator arrives.

### 8.3 Provider fell back to a secondary

**Detection, v1, no backend change:** the per-turn rows carry `llm_model`, `tts_model` and `stt_model`. When a value changes between turns within one session, a fallback occurred. This is late (one turn) and only covers legs that produce metrics, but it is real evidence and it is free.
**Sees, everyone:** an inline notice above the transcript — `The coach switched to a backup voice provider mid-session. The call continued.` — naming the leg. It is a notice, not an error: the point of `FallbackAdapter` is that this is a success.
**Sees, Engineer view:** the affected turn row marks the model change, and the summary block lists the models actually used.
**Better signal:** BC-3.

### 8.4 Cost ceiling exceeded

**Contract reality:** the ceiling (`COST_CEILING_USD`, default `$0.18`) lives in the worker's config and is only compared in `_finalize`, where it produces a `logger.warning`. The client is never told the ceiling and never told it was passed.
**v1 without a backend change:** the cost chip shows `total_cost_usd` with no ceiling comparison. Do **not** hardcode `0.18` in the client — a threshold in two places drifts, and a UI that silently lies about a budget is worse than one that does not mention it.
**With BC-4** (`cost_ceiling_usd` and an `over_ceiling` flag in the summary): the chip gains `of $0.18` and, when passed, `▲ over`.
**Behaviour is unambiguous either way: the call is never interrupted for money.** PRD §10 — exceeding the ceiling fails the benchmark, not the call. The copy says so explicitly (§9.5) so nobody hangs up out of caution.

### 8.5 Agent failed to join (`no-coach`)

**Detection:** connected, but no participant of kind AGENT after **10 seconds**.
**Sees:** the room is disconnected — a live room with no agent burns LiveKit minutes and teaches the user to talk to nothing. Then a block: what happened, that no charge or record of a conversation was made, `Try again`.
**Engineer view:** additionally shows the room name and the elapsed wait, since "did the worker pick up the dispatch" is the first thing an engineer debugging a deploy wants.

### 8.6 Score never arrives (`score-timeout`)

**When:** 45 seconds of polling `GET /api/sessions/{id}` with no `score` key.
**Sees:** `The score is taking longer than expected. Your transcript is saved.` plus `Check again` (restarts the poll for one more cycle) and the session id. The transcript stays fully readable. Never fabricate a partial score.

### 8.7 Session scored as `unscored`

`score.status === "unscored"` with a `reason` (empty transcript, or repeated invalid JSON). Distinguish the two in copy — an empty transcript is the user's situation to fix, a scorer failure is ours (§9.5). With BC-6, offer `Try scoring again`.

### 8.8 Unrecoverable session errors

`SessionConnectOptions(max_unrecoverable_errors=3)` closes the session. Today the client sees only `RoomEvent.Disconnected` and cannot distinguish "the coach finished" from "it fell over". **v1 accepts this ambiguity** and uses neutral end-of-call copy. BC-7 fixes it properly.

### 8.9 Loading states inventory

| Action | Treatment |
|---|---|
| `POST /api/token` + connect | Button label → `Connecting`, disabled. No spinner. Sub-2s in the normal case; a spinner for a sub-2s wait is more noticeable than the wait. |
| Waiting for the agent | Status `Waiting for the coach`. |
| Polling for the score | Labelled placeholder showing the five dimension names greyed out (the shape of the answer before the answer). |
| Loading a past session | Skeleton rows in the table and panel; a full-page loader would discard the layout the user is already looking at. |
| `DELETE /api/sessions/{id}` | Optimistic — the endpoint is idempotent and returns 204 either way. Immediate confirmation, no spinner. |

---

## 9. Copy

Voice: plain, confident, unhurried. Short sentences. No exclamation marks. No "Oops", "Whoops", "Uh oh", "Yay", "Awesome", "Sorry about that". Second person. Never blame the user. Say what happened, then what to do. Sentence case throughout, including buttons.

### 9.1 Pre-call

**Name:** `Interview Coach`
**Positioning line:** `System-design practice with a voice that pushes back.`

**Explainer (three lines, always visible):**
```
A senior engineer asks you one system-design question, then listens.
Talk for as long as you need. Interrupt it — it can tell the difference
between "mhm" and a real interjection.
At the end you get a scored breakdown and the transcript.
```

**Controls:**
- Label `Language` · options `English`, `हिन्दी / Hindi`
- Label `Question` · default option `Random question`
- Primary button `Start call`
- Secondary `See a completed run`
- Toggle `Engineer view`
- Microphone note, below the button: `Your microphone turns on when the call starts.`
- Privacy line: `No name, no email, no account. The transcript, the score and the numbers are stored against a random session id, deleted after 30 days, and you can erase them now with one button.`

### 9.2 State labels (the status line — these are the exact strings)

| State | String |
|---|---|
| idle | `Ready` |
| connecting | `Connecting` |
| waiting for agent | `Waiting for the coach` |
| listening | `Listening` |
| user speaking | `Hearing you` |
| thinking | `Thinking` |
| tool running (with BC-1) | `Looking something up` |
| coach speaking | `Coach speaking` |
| reconnecting | `Reconnecting` |
| ended | `Call ended` |
| scoring | `Scoring` |
| scored | `Scored` |
| error | `Call failed` |

### 9.3 Buttons

`Start call` · `End call` · `Mute` / `Unmute` · `Try again` · `Practise again` · `Practise this` (BC-5) · `Show transcript` / `Hide transcript` · `See a completed run` · `Back to a new call` · `Copy transcript` · `Copy as CSV` · `Copy score JSON` · `Find in transcript` · `Check again` · `Try scoring again` (BC-6) · `Delete this session` · `How this is scored`

Delete confirmation: title `Delete this session` · body `The transcript, the score and the numbers are removed from the server. This cannot be undone.` · buttons `Delete` / `Keep it`
After deletion: `Deleted. Nothing from this session remains on the server.`

### 9.4 Empty states

- Transcript, pre-first-turn: `The coach speaks first. Your answer appears here as you talk.`
- Metrics, pre-first-turn: `Numbers appear after your first answer.`
- Per-turn table, pre-first-turn: `One row per turn, from the first answer onward.`
- No past sessions: `No past sessions on this server yet. Start a call and one will appear here.`
- Score, still running: `Scoring your session. This takes a few seconds. Your transcript is below.`

### 9.5 Errors and notices

**Microphone permission denied**
> **The microphone is blocked**
> This browser is not letting the page use your microphone, so the coach cannot hear you.
> Allow microphone access in your browser's address bar, then try again.
> `[Try again]`

**No microphone found**
> **No microphone found**
> The browser cannot see an input device. Connect a microphone or headset and try again.
> `[Try again]`

**Token / connect failure**
> **The call could not start**
> The server did not return a room. Nothing was recorded.
> `[Try again]` · `Details ▾`

**Connect timeout**
> **The call could not start**
> The connection did not complete in time. This is usually the network.
> `[Try again]`

**Agent failed to join**
> **The coach did not pick up**
> The room opened but the coach never joined, so the call was ended. Nothing was recorded.
> `[Try again]`

**Reconnecting**
> `Reconnecting. Hold on before you carry on speaking.`

**Disconnected mid-call**
> **The call ended early**
> The connection dropped. Everything said up to that point was saved.
> `[Try again]`

**Provider fallback (a notice, not an error)**
> `The coach switched to a backup {speech | language | transcription} provider mid-session. The call carried on.`

**Cost ceiling exceeded (BC-4)**
> `This session cost $0.21, over the $0.18 target. Calls are never cut off over cost — the target is a benchmark, not a limit.`

**Score timed out**
> **The score is taking longer than expected**
> Your transcript is saved. Try again in a moment, or come back to this session id later.
> `[Check again]`

**Unscored — empty transcript**
> **Nothing to score**
> The call ended before you said anything the coach could score. Start another when you are ready.
> `[Start call]`

**Unscored — scorer failed**
> **The score did not come back**
> The session was recorded and the transcript is intact, but the scoring step failed. This is on our side.
> `[Try scoring again]` (BC-6) · `Details ▾`

### 9.6 Metrics copy

- `Reply gap` — *Time from you finishing to the coach starting to speak. Target: under 800 ms.*
- `Turn-taking` — *You interrupted {n} times and the coach stopped. You said "mhm" or "right" {m} times and it kept going.*
- `Cost` — *What this session cost in model and transport spend, from real token counts.*
- Engineer table headers: `#` `EOU` `Transcription` `LLM TTFT` `TTS TTFB` `e2e` `$` `in tok` `out tok` `cached` `TTS chars` `STT s` `models`
- Over budget marker: `▲ over`
- Live p95 caveat: `p95 over {n} turns so far`
- Reviewing banner: `You are looking at a recorded session, not a live call.`

### 9.7 Coaching panel headings

`Your session` · `What worked` · `How it scored` · `Where to go deeper` · `Moments to tighten` · `Next drill`
Meta line format: `{question} · {total} of 20 · {duration} · {language}`
Rubric legend: `0 absent · 1 named but not reasoned · 2 reasoned without numbers · 3 reasoned with numbers · 4 reasoned with numbers and an explicit tradeoff`

---

## 10. Accessibility

### 10.1 Keyboard

- Full operation without a pointer. Logical DOM order: controls → status → transcript → ribbon → chips → engineer surfaces → footer.
- Visible focus ring on every interactive element, never suppressed, meeting 3:1 against its background.
- **No single-key global shortcuts except `M` for mute**, and only when focus is not in a text field or select. The user's hands are usually off the keyboard; a rich shortcut scheme is cost without benefit here. `Escape` does **not** end a call — an accidental hang-up four minutes into an answer is unrecoverable.
- On call start, focus moves to `End call`. On the score arriving, focus moves to the coaching panel's heading (`tabindex="-1"`).
- Ribbon segments are a single composite widget: one tab stop, arrow keys move between segments, the focused segment's turn detail is exposed via `aria-describedby`. Twenty tab stops for twenty turns would be a keyboard trap in effect.
- The per-turn table scroll container gets `tabindex="0"` and an accessible name so a keyboard user can scroll it horizontally.

### 10.2 Screen reader: ARIA patterns, named

| Region | Pattern | Detail |
|---|---|---|
| **Status line** | `role="status"` (implicit `aria-live="polite"`, `aria-atomic="true"`) | Announces the state word only. **Debounced: a state must hold for 400 ms before it is written to the region.** Without this, `listening → thinking → speaking` flips flood the queue and make the page unusable. This is the single most important accessibility decision in the spec. |
| **Transcript** | `role="log"` on the container, `aria-live="polite"`, `aria-atomic="false"`, `aria-relevant="additions"` | Final segments only. Each line is a `<p>` whose speaker is a real visible label (`Coach` / `You`) read as part of the line — not a CSS-only or colour-only distinction. |
| **Provisional interim line** | `aria-hidden="true"` | Visual reassurance only. Speaking half-recognised text aloud is noise, and it is superseded within a second. |
| **Errors** | `role="alert"` (assertive) | Errors and only errors. Never for state changes. |
| **Fallback / ceiling notices** | `role="status"` (polite) | They are information, not emergencies; they must not interrupt. |
| **Metric chips** | `aria-live="off"`, each chip an `aria-describedby` target | Announcing a cost figure every turn while someone is mid-sentence is hostile. They are readable on demand by navigating to them. |
| **Coaching panel** | `<section aria-labelledby>` with a focusable heading | Focus moves there on render; the panel is not a live region — it appears once and should be explored, not narrated. |
| **Rubric rows** | Semantic `<table>` or a definition list; the numeral and the level wording are both real text | The bar is `aria-hidden="true"` decoration over data that is already in the DOM. |
| **Dialogs** (delete confirmation) | `role="dialog" aria-modal="true"`, focus trapped, `Escape` closes, focus returns to the trigger | Standard. |
| **Engineer view toggle** | `<button aria-pressed>` | It toggles a state, it does not navigate. |
| **Per-turn table** | Real `<table>` with `<caption>`, `<th scope="col">` | Never a div grid. Over-budget rows carry a visually-hidden `over budget` in the e2e cell so the marker is not visual-only. |
| **Timer** | `aria-live="off"`, updated text | Announcing every second is torture. Available on navigation. |

### 10.3 Reduced motion

Under `prefers-reduced-motion: reduce`: all transitions to 0 ms; the indicator changes form instantly; the ribbon appends without a grow animation; the transcript jumps to the bottom rather than smooth-scrolling; the coaching panel renders rather than fading. Nothing is removed — no information lives only in motion, which is the actual requirement.

### 10.4 Colour independence

Every state carries a **word**. `Listening`, `Thinking`, `Coach speaking` are text, not colours. The indicator's four forms differ in **shape and fill**, not hue alone.

- Over-budget: caret glyph `▲` + the word `over` + weight. Colour is the fourth carrier, never the first.
- Rubric bars: five discrete steps with the numeral always present; identical hue at every level.
- Transcript speakers: visible `Coach` / `You` labels plus alignment, not background colour alone.
- Interruption notches on the ribbon: a shape change, plus a count in the chip text.
- All text meets WCAG AA (4.5:1 body, 3:1 for large text and UI boundaries). Monospace figures at small sizes are held to body contrast, not large-text contrast.

### 10.5 Other

- `<html lang>` updates to `hi` when a Hindi session starts, so a screen reader pronounces the transcript correctly.
- Transcript lines carry `lang` when the language differs from the document (Hinglish is the realistic input; per-line language is not in the data contract, so v1 sets the document language from the session's `language` field and does not attempt per-line detection).
- Respects browser zoom to 200% with no loss of function; the per-turn table is the only element permitted to require scrolling.
- Non-text contrast 3:1 for the indicator, focus rings, and chip borders.

---

## 11. Priority

### P0 — must ship in v1

1. **State machine and status line covering all states in §2** with correct `lk.agent.state` wiring. *Without this the page lies about what the system is doing, which is fatal for a product whose thesis is turn-taking.*
2. **`Hearing you` local-audio threshold indicator** (§6.3). The highest anxiety in any voice product, answered.
3. **Transcript with an interim provisional line** for the local participant (§6.4).
4. **The three metric chips** with plain-language labels and target context (§5.2).
5. **`Engineer view` toggle, sticky + `?view=engineer`**, containing the summary block and the full per-turn table (§5.4).
6. **Client-side turn accumulation by `turn_index`** (§5.1). Without it, a >10-turn session shows a truncated table and the p95 claim is unauditable.
7. **The coaching panel** in the §4.3 order — strengths first, total demoted, rubric level wording, next drill last.
8. **Score polling** with the 45s bound and honest `scoring` / `score-timeout` / `unscored` states.
9. **Distinct microphone-permission and no-device states** with real remedies.
10. **Agent-failed-to-join detection** at 10s, with the room torn down.
11. **Phone live-call layout** with the drops in §7.3, `End call` fixed in the thumb zone.
12. **Accessibility floor:** `role="status"` debounced at 400 ms, `role="log"` transcript, `role="alert"` errors, full keyboard operation, visible focus, reduced motion, colour independence.
13. **Working `Delete this session`** with confirmation.
14. **Full copy deck from §9.**
15. **Empty states for metrics and transcript before the first turn.**

### P1 — should ship, cut only under real pressure

16. **`See a completed run` / `?session=<id>` reviewing mode** (§2.11). Ranked here rather than P0 only because it depends on stored sessions existing; for the portfolio launch it is effectively P0 and should ship in the same week.
17. **The turn ribbon**, static version (proportion + interruption notches).
18. **`Find in transcript`** from a hand-waving quote (§4.5). Turns the score from assertion into evidence for the cost of a substring match.
19. **Provider-fallback notice** inferred from model-field changes (§8.3).
20. **`Copy as CSV` / `Copy score JSON` / `Copy transcript`.**
21. **Rubric `How this is scored` disclosure**, open on first visit.
22. **Cost ceiling context on the chip** — needs BC-4.

### P2 — nice to have, explicitly deferred

23. Ribbon hover/focus → per-turn detail cross-highlight in the table.
24. Live tool-running indicator with tool names (needs BC-1).
25. Live per-event interruption markers in the transcript (needs BC-2).
26. `Practise this` mapping the next drill to a real question (needs BC-5).
27. `Try scoring again` (needs BC-6).
28. Sessions list / history browser beyond loading one past run.
29. Per-line language tagging for Hinglish transcripts.
30. Comparing two sessions side by side.

### Explicitly not in v1

Accounts and saved progress. Sharing a score to a public URL. Audio playback of the recorded call. Editing or annotating the transcript. Anything that themes, skins or customises the page. A separate mobile layout beyond the responsive rules in §7. Any onboarding tour.

---

## 12. Backend changes required

Everything above ships against the current contract except the following. Each names the field and where it would come from. None is a blocker for P0.

| ID | Signal needed | Field / shape | Source | Priority |
|---|---|---|---|---|
| **BC-1** | Tool running, with the tool's name | New data topic `coach.events`: `{"type":"tool","name":"lookup_concept","phase":"start"\|"end","call_id":"…","at":<ts>}` | `agent/main.py` — the framework already emits `tool_execution_updated` and `function_tools_executed` on `AgentSession` (see `livekit/agents/voice/events.py`). Currently neither is subscribed. Publish alongside `_publish_metrics`. | P2 — enables the live `Looking something up` state and the G3 proof chip |
| **BC-2** | Per-event interruption / backchannel, at the moment it happens | `coach.events`: `{"type":"interruption","kind":"interruption"\|"backchannel","turn_index":n,"at":<ts>}` | `agent/main.py` — the counters already arrive via `InterruptionMetrics`; the framework also emits `agent_false_interruption` and `overlapping_speech`. Today only cumulative totals reach the client, one turn late. | P2 — the flagship G2 claim currently has no live representation, and the client heuristic is too unreliable to ship |
| **BC-3** | Provider fallback, explicitly | `coach.events`: `{"type":"provider","leg":"llm"\|"tts"\|"stt","model":"…","available":false}` | `agent/main.py` — `FallbackAdapter` already emits `llm_availability_changed` / `tts_availability_changed` / `stt_availability_changed` with `AvailabilityChangedEvent`. Nothing subscribes. | P1 — the model-field inference in §8.3 works but is a turn late and misses legs that produce no metrics |
| **BC-4** | The cost ceiling and the latency budget, as data | Add to the `summary` dict in `MetricsSink.summary()`: `"cost_ceiling_usd": cfg.cost_ceiling_usd`, `"over_ceiling": bool`, `"latency_budget_seconds": 0.8` — or a `GET /api/config` returning both | `agent/metrics_sink.py` (needs the config passed in) or a new endpoint in `api/server.py` | P1 — today `LATENCY_BUDGET = 0.8` is hardcoded in `web/app.js` and the ceiling is not in the client at all; two sources of truth will drift |
| **BC-5** | Next drill mapped to a real question | Add `next_drill_question_id: str \| None` to `SessionScore` in `agent/scoring.py`, constrained to `questions.BY_ID` | `agent/scoring.py` — add the id list to `_RUBRIC` and the field to the Pydantic model | P2 — highest-value single addition for the candidate loop; turns the score's last line into one click |
| **BC-6** | Re-score a failed session | `POST /api/sessions/{id}/rescore` → re-runs `scoring.score_session` over the stored transcript, returns the new score | `api/server.py` + `agent/scoring.py` (both already take a transcript) | P2 — `unscored` is currently terminal for the user |
| **BC-7** | Why the session closed | `coach.events`: `{"type":"session_end","reason":"completed"\|"error"\|"max_errors"\|"participant_left"}` | `agent/main.py` — `session.on("error")` exists but only calls `logger.error`; `CloseReason` is available on the `close` event | P2 — today the client cannot tell a finished interview from a crash and must use neutral copy |
| **BC-8** | Turn-detector fell back to VAD endpointing | `coach.events`: `{"type":"turn_detector","mode":"vad","reason":"language_unsupported"}` | `agent/main.py` — PRD §11 says this is logged; it is not published | P2 — engineer-view honesty for Hindi sessions |
| **BC-9** | Score readiness without polling | `GET /api/sessions/{id}/score` → `200` with the score, `202` while pending, `404` if unknown | `api/server.py` | P2 — polling `GET /api/sessions/{id}` works; this only reduces payload size |

**Not a backend change, despite appearances:** the ten-row cap on the live `turns` payload (`sink.rows()[-10:]`). The client accumulates by `turn_index` (§5.1). Raising the cap would grow the data-channel payload on every turn to no benefit.

---

## 13. Open questions

1. **Is the coach's spoken closing summary distinguishable from the rest of the transcript?** It is the natural bridge into the coaching panel — "it just said this out loud, here it is written down". Nothing in the contract marks it. Worth a `save_note`-style tag or a `coach.events` marker if the panel feels abrupt in testing.
2. **Should `Delete this session` be offered *before* the score renders?** It is available, but a user who deletes at second 3 of scoring loses the thing they waited for. Current answer: allow it and cancel the poll. Watch whether anyone does it by accident.
3. **The `interruptions` / `backchannels` copy assumes the user caused them.** A coach false-interruption would be miscounted in that sentence. BC-2 would let the copy be exact.
4. **Hindi copy is out of scope for this draft.** The interface currently ships English chrome with a Hindi conversation, which is defensible for v1 (the rubric and score are English by design, PRD §11) but should be named as a known gap rather than discovered later.
