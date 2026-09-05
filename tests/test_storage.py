import time

import pytest

from agent import storage


def test_round_trip():
    storage.save("s1", {"session_id": "s1", "language": "en"})
    assert storage.load("s1")["language"] == "en"


def test_merge_preserves_earlier_fields():
    storage.merge("s1", language="hi")
    storage.merge("s1", question_id="url_shortener")
    record = storage.load("s1")
    assert record["language"] == "hi"
    assert record["question_id"] == "url_shortener"


def test_delete_is_idempotent():
    storage.save("s1", {"session_id": "s1"})
    assert storage.delete("s1") is True
    assert storage.delete("s1") is False
    assert storage.load("s1") is None


def test_path_traversal_is_refused():
    with pytest.raises(ValueError):
        storage.load("../../etc/passwd")


def test_sweep_removes_only_expired_records():
    now = time.time()
    storage.save("old", {"session_id": "old", "created_at": now - 40 * 86400})
    storage.save("new", {"session_id": "new", "created_at": now})
    removed = storage.sweep_expired(now=now)
    assert removed == ["old"]
    assert storage.load("new") is not None
