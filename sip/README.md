# SIP inbound (milestone 6)

Inbound only. Outbound calling is out of scope for v1.

## 1. Buy a number and point it at LiveKit

Any SIP trunk provider works (Twilio, Telnyx). Point its origination URI at
`sip.livekit.cloud`.

## 2. Create the inbound trunk

```bash
lk sip inbound create sip/trunk.json
```

Note the returned trunk id and put it in `dispatch-rule.json`.

## 3. Create the dispatch rule

```bash
lk sip dispatch-rule create sip/dispatch-rule.json
```

The rule puts each caller in their own room and dispatches the
`interview-coach` agent into it. The room name becomes the session id, exactly
as it does for browser calls, so nothing downstream needs to know how the call
arrived.

## 4. Verify

```bash
python -m agent.main dev      # worker must be running
# call the number
python -m bench.latency --source sip
```

## What differs from a browser call

- **Audio is 8 kHz narrowband.** STT accuracy drops and TTS sounds duller. The
  benchmark reports `--source sip` separately for exactly this reason; do not
  average the two.
- **Latency has a PSTN leg** the metrics cannot see. Framework numbers measure
  from the media server inward, so the caller's experienced latency is higher
  than the table by whatever the carrier adds.
- **Caller ID is PII.** `agent/main.py` records `source: "sip"` and nothing
  else. If you ever need the number, hash it — the privacy contract says no PII
  beyond the transcript.
