"""preview-diagram: publish one source file as an anonymous short link.

What a file must be to publish is decided in source_files. board_control.py
documents the contract.
"""
from __future__ import annotations

import argparse

from board_cli.core.cli_output import emit
from board_cli.source.short_link import create_short_url
from board_cli.source.source_files import read_checked_source


def run_preview_diagram(args: argparse.Namespace) -> None:
    emit({"url": create_short_url(read_checked_source(args.file, "preview-diagram"))})


def register_commands(sub: "argparse._SubParsersAction") -> None:
    preview = sub.add_parser("preview-diagram", help="publish a source file as an anonymous short link")
    preview.add_argument("--file", required=True, help="source file: .skt (Sketch), .bmd (Boxes), or .mmd (Mermaid)")
    preview.set_defaults(run=run_preview_diagram)
