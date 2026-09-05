# Cost

Rates live in `agent/pricing.py` with an `AS_OF` date. They drift. The table is
data, so correcting a price never touches agent code.

## Where the money goes

A 5-minute session, coach persona, prompt caching on, ~1,200 characters spoken:

| Leg | Sonnet stack | Haiku stack | Note |
|---|---|---|---|
| LLM | $0.0675 | $0.0225 | dominated by cumulative input tokens |
| TTS | $0.0288 | $0.0288 | per character synthesized |
| STT | $0.0385 | $0.0385 | per minute of audio, whether or not anyone speaks |
| Transport | $0.0150 | $0.0150 | 2 participants × 5 min |
| **Total** | **$0.150** | **$0.105** | ceiling: **$0.18** |

## The levers, in order

1. **Swap the LLM.** `LLM_MODEL=anthropic/claude-haiku-4-5` buys 30% of the
   total. Nothing else comes close.
2. **Keep prompt caching on.** `anthropic.LLM(caching="ephemeral")` is already
   set in `config.py`. Without it the LLM leg roughly triples over 20 turns,
   because the whole transcript is re-sent every turn.
3. **Keep the persona terse.** Output tokens cost 5× input, and every output
   token also becomes TTS characters. A coach that lectures is a coach that
   costs double.
4. **Leave `PREEMPTIVE_TTS=false`.** Every discarded draft is billed audio.

STT is a floor, not a lever: it bills wall-clock audio regardless of who talks.

## Enforcement

The worker logs a warning when a session exceeds `COST_CEILING_USD` — it never
cuts a caller off. `python -m bench.latency` exits non-zero when any recorded
session breaches it, which is where CI should catch a regression.
