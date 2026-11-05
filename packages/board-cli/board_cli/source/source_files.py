"""Reading a diagram source file for the commands that publish it.

The extension names the type and decides what is accepted. The viewer reads the
type from the source text itself (bodyKind in the drawer-app style-line module),
so the text of a .bmd or .mmd file is not compared with its extension. A .skt
file is parsed first: a damaged one, or one that holds another type, is never sent.
"""
from __future__ import annotations

from pathlib import Path

from board_cli.source import sketch_schema as schema
from board_cli.source.source_kind import BOXES_EXTENSION, MERMAID_EXTENSION, SKETCH_EXTENSION

SOURCE_EXTENSIONS = (SKETCH_EXTENSION, BOXES_EXTENSION, MERMAID_EXTENSION)


def check_extension(path: str, command: str) -> None:
    """Refuse a file that is not Sketch, Boxes, or Mermaid source by its extension."""
    if Path(path).suffix.lower() not in SOURCE_EXTENSIONS:
        hint = "; Sketch HTML goes through encode-source first" if path.lower().endswith(".html") else ""
        raise RuntimeError(f"{command} takes a .skt, .bmd, or .mmd file{hint}: {path}")


def read_checked_source(path: str, command: str) -> str:
    """The text of a source file the command may publish. Anything that would not publish raises."""
    check_extension(path, command)
    text = schema.read_file(path, "source")
    if Path(path).suffix.lower() == SKETCH_EXTENSION:
        schema.parse_source(text)
    return text
