"""Read the claims of a JWT access token without verifying it.

The CLI reads only its own stored token, to show the account and to see when the
token ends. The server is what trusts or rejects a token.
"""
from __future__ import annotations

import base64
import json
import time


def read_claims(token: str) -> dict:
    """The payload of a JWT, or {} when the token is not a readable JWT."""
    parts = token.split(".")
    if len(parts) != 3:
        return {}
    segment = parts[1]
    try:
        raw = base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4))
        claims = json.loads(raw.decode("utf-8"))
    except ValueError:  # bad base64, bad UTF-8, or bad JSON
        return {}
    return claims if isinstance(claims, dict) else {}


def has_expired(claims: dict, margin_seconds: float = 0) -> bool:
    """True when exp is a number that is past, or within margin_seconds of now.

    A token with no readable exp counts as live: only the server can say otherwise.
    """
    expiry = claims.get("exp")
    if isinstance(expiry, bool) or not isinstance(expiry, (int, float)):
        return False
    return expiry <= time.time() + margin_seconds
