"""encode-source and decode-source: Sketch HTML to and from SKT Source files.

Both commands create one new file in --out and leave their input alone. The file
is named by the local time down to the millisecond, so a diagram that has no id
yet can use them. board_control.py documents the contract.
"""
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

import sketch_schema as schema
from cli_output import emit


def read_clock() -> datetime:
    """Local time now; tests replace it to fix a file name."""
    return datetime.now()


def build_stamp() -> str:
    """The local time as YYYYMMDD-HHMMSS-mmm, to the millisecond."""
    moment = read_clock()
    return moment.strftime("%Y%m%d-%H%M%S-") + f"{moment.microsecond // 1000:03d}"


def require_extension(path: str, extension: str, command: str) -> None:
    """Refuse an input file whose extension is not the one the command takes."""
    if Path(path).suffix.lower() != extension:
        raise schema.SketchError(f"{command} takes a {extension} file: {path}")


def locate_output(out_dir: str, extension: str) -> Path:
    """The path of the new file in out_dir. Its name is the current time stamp."""
    return Path(out_dir).resolve() / (build_stamp() + extension)


def run_encode_source(args: argparse.Namespace) -> None:
    require_extension(args.file, ".html", "encode-source")
    emit(schema.encode_to(args.file, args.title, args.style, locate_output(args.out, ".skt")))


def run_decode_source(args: argparse.Namespace) -> None:
    require_extension(args.file, ".skt", "decode-source")
    emit(schema.decode_to(args.file, locate_output(args.out, ".html")))


def register_commands(sub: "argparse._SubParsersAction") -> None:
    encode = sub.add_parser("encode-source", help="pack a Sketch HTML file into a new .skt file")
    encode.add_argument("--file", required=True, help="Sketch HTML fragment file (.html)")
    encode.add_argument("--out", required=True, help="output directory")
    encode.add_argument("--title", required=True, help="short title that names the diagram")
    encode.add_argument("--style", default="", help="style token from decode-source; omit when none")
    encode.set_defaults(run=run_encode_source)
    decode = sub.add_parser("decode-source", help="unpack a .skt file into a new .html file")
    decode.add_argument("--file", required=True, help="SKT Source file (.skt)")
    decode.add_argument("--out", required=True, help="output directory")
    decode.set_defaults(run=run_decode_source)
