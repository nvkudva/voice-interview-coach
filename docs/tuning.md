# Turn-taking tuning

The 800 ms target is not one setting. It is four stages, each with its own knob,
and one default that will quietly cost you 350 ms if you leave it alone.

## The default that costs 350 ms

`silero.VAD.load()` defaults to `min_silence_duration=0.55`. The audio
end-of-turn detector will not issue an inference until VAD reports silence, and
it enforces a **200 ms** floor of its own. So the plugin default puts a 550 ms
tax on every turn before the semantic model has even looked at the words.

```python
silero.VAD.load(min_silence_duration=0.2, min_speech_duration=0.05)
```

Set it to 0.2 and the EOT model, not the VAD, decides when the turn ends. This
is the single highest-leverage change in the whole config.

## Endpointing: why dynamic

Fixed endpointing waits the same time after "yes" as after "so the write path
would…". Dynamic endpointing scales the wait with the detector's confidence:

```python
"endpointing": {"mode": "dynamic", "min_delay": 0.3, "max_delay": 2.5}
```

- `min_delay 0.3` — the floor. A confident end-of-turn commits here.
- `max_delay 2.5` — the ceiling. A candidate thinking mid-sentence gets this
  long before the coach takes the floor anyway.

Raise `max_delay` if candidates report being cut off mid-thought. Lower
`min_delay` only if you have latency headroom to spare; below 0.2 s you start
committing on breath pauses.

## Interruption: adaptive versus VAD

`vad` mode sees energy. It cannot tell "mhm" from "wait, no". `adaptive` runs a
classifier that can:

```python
"interruption": {"mode": "adaptive", "min_duration": 0.5}
```

`InterruptionMetrics` reports `num_interruptions` and `num_backchannels`
separately. That split is the evidence for the requirement — if backchannels
are stopping the agent, the counter shows it.

Two related defaults worth knowing:

- `backchannel_boundary` defaults to `(1.0, 1.0)`: overlapping speech in the
  first and last second of an agent turn is treated as backchannel. This is why
  a quick "yeah" as the coach starts talking does not derail it.
- `resume_false_interruption` defaults to `True` with a 2 s timeout: if you
  interrupt and then say nothing, the agent picks up where it stopped.

## Preemptive generation

On by default, and it is most of the reason the measured total comes in below
the sum of the stage budgets: the LLM starts on a provisional transcript while
the user is still finishing.

`preemptive_tts` stays **off**. It cuts more latency, but every discarded draft
is TTS spend, and TTS is a real fraction of session cost. Turn it on only after
the cost ceiling has headroom.

## Measuring

Every number in the latency table comes from framework metrics, not a stopwatch:

| Stage | Metric |
|---|---|
| End of speech → EOT decision | `EOUMetrics.end_of_utterance_delay` |
| Final transcript | `EOUMetrics.transcription_delay` |
| LLM first token | `LLMMetrics.ttft` (`-1` means no tokens — do not average it) |
| TTS first byte | `TTSMetrics.ttfb` |

```
make bench          # p95 across every recorded session
python -m bench.latency --source sip --min-turns 20
```

The benchmark reports p95 by nearest rank with no interpolation, so the number
printed is a latency that actually happened on a real turn.

## Two scripts worth keeping

**Thinking out loud.** Read a system-design answer with 1.5 s pauses mid-sentence.
The coach must not take the floor. Failure mode: `max_delay` too low, or the VAD
committing before the semantic model votes.

**Backchannel versus interjection.** Ten "mhm"s during a coach turn should give
`num_interruptions == 0`. Ten "wait, that's wrong"s should give `10`.
