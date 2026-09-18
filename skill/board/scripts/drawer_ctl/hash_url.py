"""Encode BMD into a public URL fragment. Fragment stays off the server."""
from __future__ import annotations

import base64
import json
import zlib

PUBLIC_WEB_ORIGIN = "https://luluboard.app"


def encode_board_hash(text: str, version: int = 1) -> str:
    payload = json.dumps(
        {"bmd": str(text or ""), "version": int(version) if int(version) > 0 else 1},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    raw = zlib.compress(payload.encode("utf-8"), 9)
    token = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    return "z:" + token


def decode_board_hash(raw: str) -> dict:
    token = str(raw or "").removeprefix("#")
    if not token.startswith("z:"):
        raise ValueError("invalid board hash")
    pad = "=" * (-len(token[2:]) % 4)
    data = base64.urlsafe_b64decode(token[2:] + pad)
    if not data:
        raise ValueError("invalid board hash")
    payload = json.loads(zlib.decompress(data).decode("utf-8"))
    if not isinstance(payload, dict) or "bmd" not in payload:
        raise ValueError("invalid board hash")
    version = int(payload.get("version") or 1)
    if version < 1:
        version = 1
    return {"bmd": str(payload.get("bmd") or ""), "version": version}


def board_web_url(text: str, origin: str = PUBLIC_WEB_ORIGIN, version: int = 1) -> str:
    body = str(text or "")
    if not body.strip():
        return f"{origin.rstrip('/')}/"
    return f"{origin.rstrip('/')}/#{encode_board_hash(body, version)}"
