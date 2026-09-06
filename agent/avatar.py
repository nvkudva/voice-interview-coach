"""Photoreal avatar video for the interview room.

The avatar worker joins the room as its own participant, receives the agent's
TTS audio over a data stream, and publishes lip-synced video **and** audio on
the agent's behalf. So the browser subscribes to the avatar participant, not
the agent, once one is running.

Providers are swappable from ``.env`` on the same ``provider/model`` pattern as
STT, LLM and TTS. Plugins are imported lazily: a provider you do not use is a
dependency you do not install.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from livekit.agents import inference
from livekit.agents.voice.avatar import AvatarSession

logger = logging.getLogger(__name__)

# Avatar video is billed per minute of session wall-clock, and it dominates
# everything else in the stack. Rates are list prices in USD/minute.
AVATAR_RATES: dict[str, float] = {
    "lemonslice": 0.10,
    "simli": 0.10,
    "bey": 0.15,
    "anam": 0.18,
    "tavus": 0.37,
    "bithuman": 0.06,
}
DEFAULT_AVATAR_RATE = 0.20


@dataclass(frozen=True)
class AvatarSpec:
    provider: str
    avatar_id: str | None

    @property
    def rate_per_minute(self) -> float:
        return AVATAR_RATES.get(self.provider, DEFAULT_AVATAR_RATE)


def parse_spec(model: str) -> AvatarSpec:
    """``"tavus/r665388ec672"`` -> provider ``tavus``, id ``r665388ec672``."""
    provider, _, avatar_id = model.partition("/")
    provider = provider.strip().lower()
    if not provider:
        raise ValueError(f"AVATAR_MODEL must be 'provider' or 'provider/<id>', got {model!r}")
    return AvatarSpec(provider=provider, avatar_id=avatar_id.strip() or None)


def build_avatar(model: str, *, persona_name: str = "Interview Coach") -> AvatarSession:
    """Construct an avatar session. Raises with a usable message if the
    provider's plugin is not installed."""
    spec = parse_spec(model)

    if spec.provider == "lemonslice":
        # Served by the LiveKit inference gateway — no extra plugin, no second
        # API key. The id, when given, selects a pre-built agent.
        return inference.AvatarSession(
            model if spec.avatar_id else "lemonslice",
            avatar_participant_name=persona_name,
        )

    if spec.provider == "tavus":
        tavus = _plugin("tavus")
        kwargs: dict = {"avatar_participant_name": persona_name}
        if spec.avatar_id:
            kwargs["replica_id"] = spec.avatar_id
        return tavus.AvatarSession(**kwargs)

    if spec.provider == "bey":
        bey = _plugin("bey")
        kwargs = {"avatar_participant_name": persona_name}
        if spec.avatar_id:
            kwargs["avatar_id"] = spec.avatar_id
        return bey.AvatarSession(**kwargs)

    if spec.provider == "simli":
        simli = _plugin("simli")
        return simli.AvatarSession(avatar_participant_name=persona_name)

    raise ValueError(
        f"unsupported avatar provider {spec.provider!r}. "
        f"Supported: lemonslice, tavus, bey, simli."
    )


def _plugin(name: str):
    try:
        return __import__(f"livekit.plugins.{name}", fromlist=["AvatarSession"])
    except ImportError as exc:
        raise ImportError(
            f"AVATAR_MODEL selects {name!r} but livekit-plugins-{name} is not installed. "
            f'Install it with: uv pip install "livekit-plugins-{name}==1.8.0"'
        ) from exc


def avatar_cost(model: str, session_seconds: float) -> float:
    """Avatar spend for a session. Billed on wall-clock, not on speech."""
    return round(session_seconds / 60.0 * parse_spec(model).rate_per_minute, 6)
