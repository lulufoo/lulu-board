"""login: approve the CLI in the browser and store the tokens.

The callback port is bound first. Then the metadata address the caller gave is
checked and followed to the authorization server, a new client is registered, and
the browser opens. board_control.py documents the contract.
"""
from __future__ import annotations

import argparse
import secrets
import sys
import webbrowser

from board_cli.auth import credentials, oauth_client, resource_discovery
from board_cli.auth.account_commands import pick_identity
from board_cli.auth.login_callback import CALLBACK_PATH, CallbackServer
from board_cli.core.cli_output import emit

CALLBACK_PORT = 48621
WAIT_SECONDS = 300


def build_redirect_uri() -> str:
    """The redirect address the client is registered with."""
    return f"http://127.0.0.1:{CALLBACK_PORT}{CALLBACK_PATH}"


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
        metadata = resource_discovery.discover_authorization_server(args.resource_metadata_url)
        verifier, challenge = oauth_client.make_pkce()
        client_id = oauth_client.register_client(metadata, build_redirect_uri())
        open_browser(oauth_client.build_authorize_url(metadata, client_id, build_redirect_uri(), challenge, state))
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
        credentials.CLIENT_ID: client_id,
        credentials.TOKEN_ENDPOINT: metadata["token_endpoint"],
    })
    emit({"logged_in": True, **pick_identity(credentials.read_credentials())})


def register_commands(sub: "argparse._SubParsersAction") -> None:
    login = sub.add_parser("login", help="approve the CLI in the browser and store the tokens")
    login.add_argument("--resource-metadata-url", required=True,
                       help="the resource_metadata address from the MCP server's 401 answer (https)")
    login.set_defaults(run=run_login)
