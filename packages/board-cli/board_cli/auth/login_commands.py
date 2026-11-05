"""login: approve the CLI in the browser and store the tokens.

The callback port is bound first, then the client is settled, then the browser
opens. board_control.py documents the contract.
"""
from __future__ import annotations

import argparse
import secrets
import sys
import webbrowser

from board_cli.auth import credentials, oauth_client
from board_cli.auth.account_commands import pick_identity
from board_cli.auth.login_callback import CALLBACK_PATH, CallbackServer
from board_cli.core.cli_output import emit

CALLBACK_PORT = 48621
WAIT_SECONDS = 300


def build_redirect_uri() -> str:
    """The one redirect address the client is registered with."""
    return f"http://127.0.0.1:{CALLBACK_PORT}{CALLBACK_PATH}"


def read_stored_client() -> str | None:
    """The client_id kept from an earlier login. A damaged file holds none."""
    try:
        stored = credentials.read_credentials() or {}
    except RuntimeError:
        return None
    return stored.get(credentials.CLIENT_ID) or None


def settle_client(metadata: dict, challenge: str, state: str) -> tuple[str, str]:
    """Return a client_id the server accepts and the address to open.

    The stored client is tried first. When the server no longer knows it, or the
    callback port changed since it was registered, a new client is registered
    and kept. A refusal of the new client is a real failure.
    """
    redirect_uri = build_redirect_uri()
    client_id = read_stored_client()
    if client_id:
        url = oauth_client.build_authorize_url(metadata, client_id, redirect_uri, challenge, state)
        try:
            oauth_client.check_authorize(url)
            return client_id, url
        except oauth_client.ClientRejected:
            pass
    client_id = oauth_client.register_client(metadata, redirect_uri)
    credentials.update_credentials({credentials.CLIENT_ID: client_id})
    url = oauth_client.build_authorize_url(metadata, client_id, redirect_uri, challenge, state)
    oauth_client.check_authorize(url)
    return client_id, url


def open_browser(url: str) -> None:
    """Print the link, then try the browser. The link is there in case it does not open."""
    print(f"Open this link to approve Lulu Board CLI: {url}", file=sys.stderr, flush=True)
    try:
        webbrowser.open(url)
    except webbrowser.Error:
        pass


def run_login(args: argparse.Namespace) -> None:
    state = secrets.token_hex(16)
    server = CallbackServer(CALLBACK_PORT, state)
    try:
        metadata = oauth_client.fetch_metadata()
        verifier, challenge = oauth_client.make_pkce()
        client_id, url = settle_client(metadata, challenge, state)
        open_browser(url)
        result = server.wait_for_result(WAIT_SECONDS)
    finally:
        server.server_close()
    if result is None:
        raise RuntimeError(f"no authorization within {WAIT_SECONDS} seconds; run login again")
    if "error" in result:
        raise RuntimeError(f"authorization was refused: {result.get('error_description') or result['error']}")
    if not result.get("code"):
        raise RuntimeError("the redirect carried no authorization code")
    tokens = oauth_client.exchange_code(metadata, client_id, build_redirect_uri(), result["code"], verifier)
    credentials.update_credentials({
        credentials.ACCESS_TOKEN: tokens["access_token"],
        credentials.REFRESH_TOKEN: tokens["refresh_token"],
    })
    emit({"logged_in": True, **pick_identity(credentials.read_credentials())})


def register_commands(sub: "argparse._SubParsersAction") -> None:
    login = sub.add_parser("login", help="approve the CLI in the browser and store the tokens")
    login.set_defaults(run=run_login)
