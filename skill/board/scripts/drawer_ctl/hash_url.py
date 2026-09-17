"""Encode BMD into a public URL fragment. Fragment stays off the server."""
from __future__ import annotations

import base64
import zlib

PUBLIC_WEB_ORIGIN = "https://luluboard.app"


def encode_board_hash(text: str) -> str:
    raw = zlib.compress(str(text or "").encode("utf-8"), 9)
    token = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    return "z:" + token


def decode_board_hash(raw: str) -> str:
    token = str(raw or "").removeprefix("#")
    if not token.startswith("z:"):
        raise ValueError("invalid board hash")
    pad = "=" * (-len(token[2:]) % 4)
    data = base64.urlsafe_b64decode(token[2:] + pad)
    if not data:
        raise ValueError("invalid board hash")
    return zlib.decompress(data).decode("utf-8")


def board_web_url(text: str, origin: str = PUBLIC_WEB_ORIGIN) -> str:
    return f"{origin.rstrip('/')}/#{encode_board_hash(text)}"
