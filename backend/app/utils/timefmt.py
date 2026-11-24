"""Timezone-safe datetime serialization.

MySQL DATETIME columns store naive UTC wall-clock values. Serializing those
with a bare ``isoformat()`` produces ``2026-11-24T06:22:00`` — a string
JavaScript interprets as the *viewer's* local time, so every timestamp
(chat messages, "joined" times, history, the room timer) rendered hours
off for anyone not sitting in UTC. Attaching the explicit UTC offset makes
browsers convert to the viewer's locale correctly.
"""

from datetime import datetime, timezone


def iso_utc(value: datetime | None) -> str | None:
    """Serialize a datetime as ISO-8601 with an explicit ``+00:00`` offset.

    Accepts both naive (assumed UTC, as stored by MySQL) and aware values.
    Returns ``None`` for ``None`` so call sites stay expression-length.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()
