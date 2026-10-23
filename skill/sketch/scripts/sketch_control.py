#!/usr/bin/env python3
"""Encode a Sketch source into a public viewer URL."""
from __future__ import annotations

import argparse
import base64
import json
import sys
import zlib
from pathlib import Path

PUBLIC_WEB_ORIGIN = "https://luluboard.app"


def encode_hash(text: str, version: int = 1) -> str:
    payload = json.dumps(
        {"bmd": str(text or ""), "version": int(version) if int(version) > 0 else 1},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    raw = zlib.compress(payload.encode("utf-8"), 9)
    token = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    return "z:" + token


def web_url(text: str) -> str:
    body = str(text or "")
    if not body.strip():
        return f"{PUBLIC_WEB_ORIGIN}/"
    return f"{PUBLIC_WEB_ORIGIN}/#{encode_hash(body)}"


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
    text = read_source(path)
    url = web_url(text)
    print(json.dumps({"ok": True, "kind": "sketch", "url": url}, ensure_ascii=False))


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
