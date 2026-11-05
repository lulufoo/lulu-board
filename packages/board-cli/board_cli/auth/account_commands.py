"""whoami: report the login state from the local credential file. No network.

Whether a stored token still works is found out by the cloud commands when they
use it, not here. board_control.py documents the contract.
"""
from __future__ import annotations

import argparse

from board_cli.auth import credentials
from board_cli.auth.token_claims import has_expired, read_claims
from board_cli.core.cli_output import emit


def check_login(stored: dict | None) -> bool:
    """A refresh token means logged in even when the access token has expired.

    Without one, only an access token that has not expired counts. A file that
    holds just the client_id is not a login.
    """
    if not stored:
        return False
    if stored.get(credentials.REFRESH_TOKEN):
        return True
    access = stored.get(credentials.ACCESS_TOKEN)
    return bool(access) and not has_expired(read_claims(access))


def pick_identity(stored: dict) -> dict:
    """email and user_id from the stored access token; a field it lacks is left out."""
    claims = read_claims(stored.get(credentials.ACCESS_TOKEN) or "")
    identity = {}
    for key, claim in (("email", "email"), ("user_id", "sub")):
        value = claims.get(claim)
        if isinstance(value, str) and value:
            identity[key] = value
    return identity


def run_whoami(args: argparse.Namespace) -> None:
    stored = credentials.read_credentials()
    if not check_login(stored):
        emit({"logged_in": False})
        return
    emit({"logged_in": True, **pick_identity(stored)})


def register_commands(sub: "argparse._SubParsersAction") -> None:
    whoami = sub.add_parser("whoami", help="report whether this machine is logged in (local only)")
    whoami.set_defaults(run=run_whoami)
