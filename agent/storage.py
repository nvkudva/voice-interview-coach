"""Session records on disk.

One JSON file per session under ``DATA_DIR``. Deliberately boring: the record
shape is still moving, and a file is trivially deletable — which is what the
privacy requirement actually needs.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

DATA_DIR = Path(os.getenv("DATA_DIR", "data/sessions"))
RETENTION_DAYS = int(os.getenv("RETENTION_DAYS", "30"))


def _path(session_id: str) -> Path:
    if "/" in session_id or ".." in session_id:
        raise ValueError(f"unsafe session id: {session_id!r}")
    return DATA_DIR / f"{session_id}.json"


def load(session_id: str) -> dict[str, Any] | None:
    path = _path(session_id)
    if not path.exists():
        return None
    return json.loads(path.read_text())


def save(session_id: str, record: dict[str, Any]) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = _path(session_id)
    # Write-then-rename so a crash mid-write never truncates an existing record.
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(record, indent=2, ensure_ascii=False))
    tmp.replace(path)
    return path


def merge(session_id: str, **fields: Any) -> dict[str, Any]:
    record = load(session_id) or {"session_id": session_id, "created_at": time.time()}
    record.update(fields)
    record["updated_at"] = time.time()
    save(session_id, record)
    return record


def delete(session_id: str) -> bool:
    """Remove a session record. Idempotent — returns whether a file was removed."""
    path = _path(session_id)
    if not path.exists():
        return False
    path.unlink()
    return True


def list_ids() -> list[str]:
    if not DATA_DIR.exists():
        return []
    return sorted(p.stem for p in DATA_DIR.glob("*.json"))


def sweep_expired(now: float | None = None) -> list[str]:
    """Delete records past the retention window. Run at worker start."""
    now = now or time.time()
    cutoff = now - RETENTION_DAYS * 86400
    removed = []
    for session_id in list_ids():
        record = load(session_id) or {}
        if record.get("created_at", now) < cutoff:
            delete(session_id)
            removed.append(session_id)
    return removed
