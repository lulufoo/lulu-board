#!/usr/bin/env python3
"""Create a Sketch short viewer URL.

preview stdout is the returned short url only.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

_root = Path(__file__).resolve().parents[2]
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from short_link import PUBLIC_WEB_ORIGIN, create_short_url


def web_url(text: str) -> str:
    body = str(text or "")
    if not body.strip():
        return f"{PUBLIC_WEB_ORIGIN}/"
    return create_short_url(body)


def read_source(path: str | None) -> str:
    if path:
        text = Path(path).read_text(encoding="utf-8")
    else:
        text = sys.stdin.read()
    if not str(text).strip():
        raise RuntimeError("sketch source must not be empty")
    return text


def preview(path: str | None, kind: str) -> None:
    if kind != "sketch":
        raise RuntimeError("invalid --kind (expected sketch)")
    print(web_url(read_source(path)))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="sketch_control")
    sub = parser.add_subparsers(dest="cmd", required=True)
    show = sub.add_parser("preview")
    show.add_argument("--kind", default="sketch")
    show.add_argument("--file", default="")
    args = parser.parse_args(argv)
    try:
        preview(args.file or None, args.kind)
    except RuntimeError as err:
        print(str(err), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
