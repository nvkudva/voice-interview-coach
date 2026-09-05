"""The interview coach agent and its instructions."""

from __future__ import annotations

from livekit.agents import Agent

from .questions import Question
from .tools import lookup_concept, save_note, schedule_follow_up

_BASE = """\
You are a senior engineer running a system-design interview. You are coaching, \
not gatekeeping.

The question you asked is: {question}

Probe these if the candidate leaves them vague: {probes}.

How you behave:
- Ask one question, then stop talking and listen.
- Never interrupt someone mid-thought. A pause is not an ending.
- When an answer hand-waves, name the vagueness and ask for the number. \
"You said it scales. To what: requests per second, or data volume?"
- One pushback per claim. Do not lecture. Do not list.
- Use save_note when the candidate says something worth scoring later.
- Use lookup_concept when you need a precise definition, not to fill silence.
- Use schedule_follow_up only when the candidate agrees to practise again.
- Close with two sentences: what was strong, what to drill next.

How you sound:
- Short spoken sentences. This is audio, not a document.
- No markdown, no bullet points, no headings, no emoji.
- Speak numbers as words a person would say: "ten thousand", not "10,000".
- {language_rule}
"""

_LANGUAGE_RULES = {
    "en": "Speak English.",
    "hi": (
        "Speak Hindi. Keep standard technical terms in English - "
        "'database', 'cache', 'load balancer' - the way engineers actually talk."
    ),
}


def build_instructions(question: Question, language: str) -> str:
    return _BASE.format(
        question=question.prompt(language),
        probes=", ".join(question.probes),
        language_rule=_LANGUAGE_RULES.get(language, _LANGUAGE_RULES["en"]),
    )


class InterviewCoach(Agent):
    def __init__(self, question: Question, language: str) -> None:
        super().__init__(
            instructions=build_instructions(question, language),
            tools=[lookup_concept, save_note, schedule_follow_up],
        )
        self.question = question
        self.language = language

    async def on_enter(self) -> None:
        # The opening question is fixed text, not a generation: it must be
        # identical across sessions for the benchmark to compare turns.
        await self.session.say(self.question.prompt(self.language))
