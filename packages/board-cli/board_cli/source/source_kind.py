"""Which file extension a diagram source gets, read from the source text itself.

The viewer decides a diagram's type from its first statement (bodyKind in the
drawer-app style-line module), because the server stores no type. This follows
the same rule, so a file named .bmd is a diagram the viewer shows as Boxes.
"""
from __future__ import annotations

import re

SKETCH_EXTENSION = ".skt"
BOXES_EXTENSION = ".bmd"
MERMAID_EXTENSION = ".mmd"

# A style line: `style <token>`, or `%% style <token>` in Mermaid.
STYLE_LINE = re.compile(r"^(?:%%\s*)?style\s+(\S+)\s*$", re.IGNORECASE)
# re.ASCII keeps \b and \s as ASCII, like the viewer's JavaScript patterns.
BOXES_START = re.compile(r"^boxes\s+", re.IGNORECASE | re.ASCII)
SKETCH_START = re.compile(r"^sketch\b", re.IGNORECASE | re.ASCII)


def first_statement(source: str) -> str:
    """The first line that is a statement: not blank, a comment, meta, a front-matter fence, or a style line."""
    for raw in re.split(r"\r?\n", source):
        line = raw.strip()
        if not line or line.startswith(("#", "//", "%%", "meta ", "---")):
            continue
        if STYLE_LINE.match(line):
            continue
        return line
    return ""


def detect_extension(source: str) -> str:
    """.bmd for Boxes, .skt for Sketch, and .mmd for anything else (Mermaid)."""
    line = first_statement(source)
    if BOXES_START.match(line):
        return BOXES_EXTENSION
    if SKETCH_START.match(line):
        return SKETCH_EXTENSION
    return MERMAID_EXTENSION
