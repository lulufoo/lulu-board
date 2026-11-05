"""Lulu Board CLI.

Sketch source files and short links for now. Python 3.9 or newer, standard
library only.

  --version
      stdout: {"version": "X.Y.Z"}. Dotted integers, so a caller can compare it
      with a minimum version.

  preview-diagram --file FILE
      Publish the source in FILE as an anonymous short link. No login.
      The extension names the type: .skt (Sketch), .bmd (Boxes), .mmd (Mermaid).
      Any other extension fails, including .html: run encode-source first.
      A .skt file must parse as SKT Source; .bmd and .mmd go up as written.
      stdout: {"url": "<short link>"}

  encode-source --file FILE.html --out DIR --title TEXT [--style TOKEN]
      Pack the Sketch HTML fragment in FILE into SKT Source.
      stdout: {"title": "...", "style": "...", "file": "<path of the new .skt file>"}

  decode-source --file FILE.skt --out DIR
      Unpack SKT Source into its HTML fragment.
      stdout: {"title": "...", "style": "...", "file": "<path of the new .html file>"}

encode-source and decode-source serve Sketch only. Each creates one new file in
DIR (made when missing) and leaves FILE alone. The file name is the local time
down to the millisecond, YYYYMMDD-HHMMSS-mmm, plus .skt or .html. It does not
depend on the input name, so a diagram that has no id yet can use them. A name
that already exists fails; run again.

--title is required. A double quote in it becomes a single quote and a line
break becomes a space. --style is the token decode-source returned: pass it back
unchanged on an update, or omit it (or pass "") when there is none. The title,
style, and file that decode-source returns fit encode-source's --title, --style,
and --file. A title that decodes empty needs a new one before encode-source.
decode-source fails when the content is damaged.

Output
  stdout is one JSON object and never holds source text.
  exit 0  success
  exit 1  ordinary error: one line on stderr, stdout empty
  exit 2  command-line usage error: usage on stderr, stdout empty
"""
from __future__ import annotations

import argparse
import sys

from board_cli import preview_commands, source_commands
from board_cli.version import VersionAction


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="board-cli",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--version", action=VersionAction, help="print the version as JSON and exit")
    sub = parser.add_subparsers(dest="command", required=True)
    preview_commands.register_commands(sub)
    source_commands.register_commands(sub)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        args.run(args)
    except (RuntimeError, OSError) as err:
        print(str(err), file=sys.stderr)
        return 1
    return 0


def run() -> None:
    """Entry for python3 -m board_cli and the .pyz: exit with main()'s code."""
    raise SystemExit(main())
