#!/usr/bin/env python3
"""Sketch CLI: publish one Sketch, and convert SKT Source to and from HTML.

  preview --html FILE --title TEXT
      Publish the HTML fragment in FILE as an anonymous short link.
      stdout: {"url": "<short url>"}

  encode --html FILE --title TEXT [--style TOKEN]
      Write the SKT Source for FILE beside it as <name>.skt, for the cloud
      diagram tools.
      stdout: {"skt": "<path of the .skt file>"}

  decode --skt FILE
      Write the HTML in the SKT Source FILE beside it as <name>.html.
      stdout: {"title": "...", "style": "...", "html": "<path of the .html file>"}

--title is required. A double quote in it becomes a single quote and a line
break becomes a space. --style is the token decode returned: pass it back
unchanged on an update, or omit it (or pass "") when there is none. decode
fails when the content is damaged. A file that is the wrong kind is refused.
On failure one line goes to stderr, stdout stays empty, and the exit code is 1.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_here = Path(__file__).resolve().parent
_scripts = _here.parents[1] / "scripts"
for _path in (_here, _scripts):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

import sketch_schema as schema
from short_link import create_short_url


def emit(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False))


def run_preview(args: argparse.Namespace) -> None:
    source = schema.build_file_source(args.html, args.title)
    emit({"url": create_short_url(source)})


def run_encode(args: argparse.Namespace) -> None:
    emit({"skt": str(schema.encode_file(args.html, args.title, args.style))})


def run_decode(args: argparse.Namespace) -> None:
    emit(schema.decode_file(args.skt))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sketch_control",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="cmd", required=True)
    preview = sub.add_parser("preview", help="publish an HTML file as a short link")
    preview.add_argument("--html", required=True, help="HTML fragment file")
    preview.add_argument("--title", required=True, help="short title that names the diagram")
    encode = sub.add_parser("encode", help="write the SKT file for an HTML file")
    encode.add_argument("--html", required=True, help="HTML fragment file")
    encode.add_argument("--title", required=True, help="short title that names the diagram")
    encode.add_argument("--style", default="", help="style token from decode; omit when none")
    decode = sub.add_parser("decode", help="write the HTML file for a SKT file")
    decode.add_argument("--skt", required=True, help="SKT Source file")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    runners = {"preview": run_preview, "encode": run_encode, "decode": run_decode}
    try:
        runners[args.cmd](args)
    except (RuntimeError, OSError) as err:
        print(str(err), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
