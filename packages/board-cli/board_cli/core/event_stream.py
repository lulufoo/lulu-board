"""Read the events of a Server-Sent Events body.

An event is a run of lines ended by a blank line. A line that starts with a colon is
a comment (the server's keepalive), and a field this reader does not use (event, id,
retry) is skipped. The data lines of one event are joined with a line feed.
"""
from __future__ import annotations


def read_event_data(text: str) -> list[str]:
    """The data of every event in an SSE body, in order. An event that has no data is left out."""
    events: list[str] = []
    data_lines: list[str] = []

    def end_event() -> None:
        data = "\n".join(data_lines)
        data_lines.clear()
        if data:
            events.append(data)

    for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if not line:
            end_event()
        elif not line.startswith(":"):
            field, _, value = line.partition(":")
            if field == "data":
                data_lines.append(value[1:] if value.startswith(" ") else value)
    end_event()  # a stream that ends without its last blank line still delivers that event
    return events
