import pytest

from agent import scoring

VALID = """```json
{"scores": {"requirements_clarification": 3, "high_level_design": 3,
 "data_modeling": 2, "scaling_and_tradeoffs": 3, "communication": 3},
 "strengths": ["Asked about the read/write ratio first."],
 "gaps": ["Never sized the database."],
 "hand_waving": [{"quote": "we would just cache it", "why": "no eviction policy"}],
 "next_drill": "Capacity estimation."}
```"""


class FakeStream:
    def __init__(self, text):
        self._text = text

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False

    async def __aiter__(self):
        from livekit.agents.llm import ChatChunk, ChoiceDelta

        yield ChatChunk(id="1", delta=ChoiceDelta(role="assistant", content=self._text))


class FakeLLM:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = 0

    def chat(self, **_):
        self.calls += 1
        return FakeStream(self.replies.pop(0))


TRANSCRIPT = [
    {"role": "assistant", "text": "Design a URL shortener."},
    {"role": "user", "text": "First, what is the read to write ratio?"},
]


@pytest.mark.asyncio
async def test_scores_a_transcript():
    result = await scoring.score_session(FakeLLM(VALID), TRANSCRIPT)
    assert result["status"] == "scored"
    assert result["total"] == 14
    assert result["hand_waving"][0]["quote"] == "we would just cache it"


@pytest.mark.asyncio
async def test_retries_once_on_bad_json_then_succeeds():
    model = FakeLLM("sorry, here is my analysis in prose", VALID)
    result = await scoring.score_session(model, TRANSCRIPT)
    assert result["status"] == "scored"
    assert model.calls == 2


@pytest.mark.asyncio
async def test_unscorable_session_is_recorded_not_lost():
    result = await scoring.score_session(FakeLLM("nope", "still nope"), TRANSCRIPT)
    assert result["status"] == "unscored"
    assert result["reason"]


@pytest.mark.asyncio
async def test_empty_transcript_skips_the_llm_call():
    model = FakeLLM(VALID)
    result = await scoring.score_session(model, [])
    assert result["status"] == "unscored"
    assert model.calls == 0


@pytest.mark.asyncio
async def test_provider_error_does_not_raise():
    class Broken:
        def chat(self, **_):
            raise RuntimeError("provider down")

    result = await scoring.score_session(Broken(), TRANSCRIPT, retries=0)
    assert result["status"] == "unscored"


def test_out_of_range_score_is_rejected():
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        scoring.Scores(
            requirements_clarification=9, high_level_design=1, data_modeling=1,
            scaling_and_tradeoffs=1, communication=1,
        )
