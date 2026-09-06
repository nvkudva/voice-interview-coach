# Cost

Rates live in `agent/pricing.py` with an `AS_OF` date. They drift. The table is
data, so correcting a price never touches agent code.

## Where the money goes

A 5-minute session, coach persona, prompt caching on, ~1,200 characters spoken:

| Leg | Voice only | + lemonslice | + tavus | Note |
|---|---|---|---|---|
| LLM | $0.0675 | $0.0675 | $0.0675 | dominated by cumulative input tokens |
| TTS | $0.0288 | $0.0288 | $0.0288 | per character synthesized |
| STT | $0.0385 | $0.0385 | $0.0385 | per minute of audio, whoever is talking |
| Transport | $0.0150 | $0.0150 | $0.0150 | 2 participants × 5 min |
| Avatar video | — | $0.500 | $1.850 | **per minute of wall-clock, including silence** |
| **Total** | **$0.150** | **$0.650** | **$1.985** | ceiling: **$0.85** with video |

## Video changed which lever matters

Every voice-side optimisation below together saves about **$0.04**. One minute
of avatar video costs three times that. So the honest ordering is:

1. **Do you need video at all?** `AVATAR_ENABLED=false` takes a session from
   $0.65 to $0.15 — a 77% cut, larger than every other lever combined. This is
   the cost decision; everything after it is rounding.
2. **Which avatar provider.** lemonslice at $0.10/min against tavus at
   $0.37/min is a $1.34 difference per session. Tavus cannot fit the $0.85
   ceiling at all — a 5-minute call is $1.99. It is supported because it looks
   the best, and choosing it means choosing to breach the ceiling knowingly.
3. **Keep sessions short.** Video bills wall-clock. A candidate who thinks in
   silence for ninety seconds is billed for ninety seconds of video. Nothing in
   the voice stack behaves this way, and it is the easiest cost surprise here.

## The voice levers, in order

1. **Swap the LLM.** `LLM_MODEL=anthropic/claude-haiku-4-5` buys 30% of the
   voice subtotal — and about 7% of a session with video on.
2. **Keep prompt caching on.** `anthropic.LLM(caching="ephemeral")` is already
   set in `config.py`. Without it the LLM leg roughly triples over 20 turns,
   because the whole transcript is re-sent every turn.
3. **Keep the persona terse.** Output tokens cost 5× input, and every output
   token also becomes TTS characters. A coach that lectures is a coach that
   costs double.
4. **Leave `PREEMPTIVE_TTS=false`.** Every discarded draft is billed audio.

STT is a floor, not a lever: it bills wall-clock audio regardless of who talks.
Avatar video is the same shape, twelve times the price.

## Enforcement

The worker logs a warning when a session exceeds `COST_CEILING_USD` — it never
cuts a caller off. `python -m bench.latency` exits non-zero when any recorded
session breaches it, which is where CI should catch a regression.
