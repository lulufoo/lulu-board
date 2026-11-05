"""preview-diagram: publish one source file as an anonymous short link.

The extension names the type and decides what is accepted. The viewer reads the
type from the source text itself (bodyKind in the drawer-app style-line module),
so the text of a .bmd or .mmd file is not compared with its extension. A .skt
file is parsed first: a damaged one, or one that holds another type, never
becomes a link. board_control.py documents the contract.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from board_cli import sketch_schema as schema
from board_cli.cli_output import emit
from board_cli.short_link import create_short_url

SKETCH_EXTENSION = ".skt"
SOURCE_EXTENSIONS = (SKETCH_EXTENSION, ".bmd", ".mmd")


def check_extension(path: str) -> None:
    """Refuse a file that is not Sketch, Boxes, or Mermaid source by its extension."""
    if Path(path).suffix.lower() not in SOURCE_EXTENSIONS:
        hint = "; Sketch HTML goes through encode-source first" if path.lower().endswith(".html") else ""
        raise RuntimeError("preview-diagram takes a .skt, .bmd, or .mmd file" + hint + f": {path}")


def run_preview_diagram(args: argparse.Namespace) -> None:
    check_extension(args.file)
    text = schema.read_file(args.file, "source")
    if Path(args.file).suffix.lower() == SKETCH_EXTENSION:
        schema.parse_source(text)
    emit({"url": create_short_url(text)})


def register_commands(sub: "argparse._SubParsersAction") -> None:
    preview = sub.add_parser("preview-diagram", help="publish a source file as an anonymous short link")
    preview.add_argument("--file", required=True, help="source file: .skt (Sketch), .bmd (Boxes), or .mmd (Mermaid)")
    preview.set_defaults(run=run_preview_diagram)
