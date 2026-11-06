"""OAuth against the authorization server the MCP server names: the calls login makes.

Authorization code with PKCE (S256). The client is a public client with no secret,
registered anew for every login. Both the authorization request and the token request
name the MCP server as the resource the token is for (RFC 8707). The server's
endpoints come from resource_discovery.py; nothing here is built in.
"""
from __future__ import annotations

import base64
import hashlib
import json
import secrets
import urllib.parse

from board_cli.core import mcp_address
from board_cli.core.http_json import Response, send_request

CLIENT_NAME = "Lulu Board CLI"
SCOPE = "openid email offline_access"
FORM_HEADERS = {"Content-Type": "application/x-www-form-urlencoded"}
JSON_HEADERS = {"Content-Type": "application/json"}


class RefreshRejected(RuntimeError):
    """The server refuses this refresh token. Only a new login can fix it."""


def describe_failure(reply: Response) -> str:
    """HTTP status plus the server's short reason when the body gives one."""
    body = reply.read_json() or {}
    reason = body.get("error_description") or body.get("msg") or body.get("error")
    return f"HTTP {reply.status}" + (f": {str(reason)[:120]}" if reason else "")


def register_client(metadata: dict, redirect_uri: str) -> str:
    """Register a new public client for this login and return its client_id."""
    payload = {
        "client_name": CLIENT_NAME,
        "redirect_uris": [redirect_uri],
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "none",
    }
    reply = send_request("POST", metadata["registration_endpoint"], JSON_HEADERS, json.dumps(payload).encode())
    info = reply.read_json() if reply.status in (200, 201) else None
    if not info or not isinstance(info.get("client_id"), str):
        raise RuntimeError(f"client registration was refused: {describe_failure(reply)}")
    return info["client_id"]


def make_pkce() -> tuple[str, str]:
    """A fresh PKCE pair: the verifier, and its S256 challenge."""
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(48)).rstrip(b"=").decode("ascii")
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return verifier, base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def build_authorize_url(metadata: dict, client_id: str, redirect_uri: str, challenge: str, state: str) -> str:
    """The address the user opens to approve the CLI."""
    query = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": state,
        "scope": SCOPE,
        "resource": mcp_address.MCP_URL,
    }
    return metadata["authorization_endpoint"] + "?" + urllib.parse.urlencode(query)


def exchange_code(metadata: dict, client_id: str, redirect_uri: str, code: str, verifier: str) -> dict:
    """Trade the authorization code for tokens. Both an access and a refresh token are required."""
    form = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "code_verifier": verifier,
        "resource": mcp_address.MCP_URL,
    }).encode()
    reply = send_request("POST", metadata["token_endpoint"], FORM_HEADERS, form)
    tokens = reply.read_json() if reply.status == 200 else None
    if tokens is None:
        raise RuntimeError(f"token exchange failed: {describe_failure(reply)}")
    for name in ("access_token", "refresh_token"):
        if not isinstance(tokens.get(name), str) or not tokens[name]:
            raise RuntimeError(f"token exchange gave no {name.replace('_', ' ')}")
    return tokens


def refresh_tokens(token_endpoint: str, client_id: str, refresh_token: str) -> dict:
    """Trade a refresh token for a new access token.

    The server rotates refresh tokens, so the reply usually holds a new one that
    must replace the old one. A 400 or 401 means this refresh token is refused
    (RefreshRejected). Any other failure is an ordinary error: the token may be fine.
    """
    form = urllib.parse.urlencode({
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
        "resource": mcp_address.MCP_URL,
    }).encode()
    reply = send_request("POST", token_endpoint, FORM_HEADERS, form)
    if reply.status in (400, 401):
        raise RefreshRejected(f"the server refused the refresh token: {describe_failure(reply)}")
    tokens = reply.read_json() if reply.status == 200 else None
    if tokens is None:
        raise RuntimeError(f"token refresh failed: {describe_failure(reply)}")
    if not isinstance(tokens.get("access_token"), str) or not tokens["access_token"]:
        raise RuntimeError("token refresh gave no access token")
    return tokens
