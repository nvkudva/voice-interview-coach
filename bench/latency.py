"""Turn stored session records into the README latency table.

    python -m bench.latency                  # every session on disk
    python -m bench.latency --source sip     # SIP calls only
    python -m bench.latency --min-turns 20   # gate a milestone-3 run

Exits non-zero when p95 breaches the 800 ms budget or the cost ceiling, so it
works as a CI gate as well as a report generator.
"""

from __future__ import annotations

import argparse
import statistics
import sys
from typing import Any

from agent import storage

BUDGET_S = 0.8
STAGES = [
    ("eou_delay", "End of speech -> EOT decision", 0.300),
    ("transcription_delay", "Final transcript", 0.100),
    ("llm_ttft", "LLM time-to-first-token", 0.250),
    ("tts_ttfb", "TTS time-to-first-byte", 0.120),
    ("e2e_latency", "Total", 0.800),
]


def collect(source: str | None) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    turns, sessions = [], []
    for session_id in storage.list_ids():
        record = storage.load(session_id) or {}
        if source and record.get("source") != source:
            continue
        sessions.append(record)
        turns.extend(record.get("turns", []))
    return turns, sessions


def pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = max(1, min(len(ordered), round(p / 100 * len(ordered))))
    return ordered[rank - 1]


def table(turns: list[dict[str, Any]]) -> str:
    lines = [
        "| Stage | Budget | p50 | p95 | max |",
        "|---|---|---|---|---|",
    ]
    for key, label, budget in STAGES:
        values = [t[key] for t in turns if t.get(key)]
        if not values:
            lines.append(f"| {label} | {budget * 1000:.0f} ms | — | — | — |")
            continue
        lines.append(
            f"| {label} | {budget * 1000:.0f} ms | {pct(values, 50) * 1000:.0f} ms "
            f"| {pct(values, 95) * 1000:.0f} ms | {max(values) * 1000:.0f} ms |"
        )
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=["web", "sip"], default=None)
    ap.add_argument("--min-turns", type=int, default=0)
    ap.add_argument("--cost-ceiling", type=float, default=0.18)
    args = ap.parse_args()

    turns, sessions = collect(args.source)
    if not turns:
        print("no turns recorded; run a session first", file=sys.stderr)
        return 1

    print(f"# Latency ({len(turns)} turns across {len(sessions)} sessions)\n")
    print(table(turns))

    e2e = [t["e2e_latency"] for t in turns if t.get("e2e_latency")]
    p95 = pct(e2e, 95)
    interruptions = sum((s.get("summary") or {}).get("interruptions", 0) for s in sessions)
    backchannels = sum((s.get("summary") or {}).get("backchannels", 0) for s in sessions)
    costs = [(s.get("summary") or {}).get("total_cost_usd", 0.0) for s in sessions]

    print(f"\nInterruptions: {interruptions} · backchannels ignored: {backchannels}")
    if costs:
        print(f"Cost per session: mean ${statistics.mean(costs):.4f} · max ${max(costs):.4f}")

    failures = []
    if len(turns) < args.min_turns:
        failures.append(f"only {len(turns)} turns, need {args.min_turns}")
    if p95 > BUDGET_S:
        failures.append(f"p95 {p95 * 1000:.0f} ms over the {BUDGET_S * 1000:.0f} ms budget")
    if costs and max(costs) > args.cost_ceiling:
        failures.append(f"session cost ${max(costs):.4f} over ${args.cost_ceiling:.2f}")

    if failures:
        print("\nFAIL: " + "; ".join(failures), file=sys.stderr)
        return 1
    print("\nPASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
