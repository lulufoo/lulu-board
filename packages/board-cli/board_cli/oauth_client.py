"""OAuth against the Lulu Board authorization server (Supabase Auth): the calls login makes.

Authorization code with PKCE (S256). The client is a public client, registered
once per machine, so it has no secret.
"""
from __future__ import annotations

import base64
import hashlib
import json
import secrets
import urllib.parse

from board_cli.http_json import Response, send_request

AUTH_HOST = "https://xjwlxxuafhsfzksxxmtu.supabase.co"
METADATA_URL = AUTH_HOST + "/.well-known/oauth-authorization-server/auth/v1"
CLIENT_NAME = "Lulu Board CLI"
SCOPE = "openid email offline_access"
ENDPOINTS = ("authorization_endpoint", "token_endpoint", "registration_endpoint")
FORM_HEADERS = {"Content-Type": "application/x-www-form-urlencoded"}
JSON_HEADERS = {"Content-Type": "application/json"}


class ClientRejected(RuntimeError):
    """The server does not accept this client_id or redirect address. Registering again can fix it."""


class RefreshRejected(RuntimeError):
    """The server refuses this refresh token. Only a new login can fix it."""


def describe_failure(reply: Response) -> str:
    """HTTP status plus the server's short reason when the body gives one."""
    body = reply.read_json() or {}
    reason = body.get("error_description") or body.get("msg") or body.get("error")
    return f"HTTP {reply.status}" + (f": {str(reason)[:120]}" if reason else "")


def fetch_metadata() -> dict:
    """The server's endpoints, from its metadata document."""
    reply = send_request("GET", METADATA_URL)
    metadata = reply.read_json() if reply.status == 200 else None
    if not metadata or any(not isinstance(metadata.get(name), str) for name in ENDPOINTS):
        raise RuntimeError(f"authorization server metadata unavailable: HTTP {reply.status}")
    return metadata


def register_client(metadata: dict, redirect_uri: str) -> str:
    """Register this machine as a public client and return its client_id."""
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
    }
    return metadata["authorization_endpoint"] + "?" + urllib.parse.urlencode(query)


def check_authorize(url: str) -> None:
    """Ask the authorize endpoint without a browser. Return when it would send the user on.

    An unknown client_id, or a redirect address that is not the registered one,
    raises ClientRejected. Any other refusal raises RuntimeError.
    """
    reply = send_request("GET", url)
    if reply.status in (301, 302, 303):
        where = urllib.parse.urlparse(reply.headers.get("location", ""))
        if "error" not in urllib.parse.parse_qs(where.query):
            return
    body = reply.read_json() or {}
    if reply.status == 400 and (body.get("error_code") == "oauth_client_not_found"
                                or "redirect_uri" in str(body.get("msg", ""))):
        raise ClientRejected(f"authorization server does not accept the client: {describe_failure(reply)}")
    raise RuntimeError(f"authorization server refused the request: {describe_failure(reply)}")


def exchange_code(metadata: dict, client_id: str, redirect_uri: str, code: str, verifier: str) -> dict:
    """Trade the authorization code for tokens. Both an access and a refresh token are required."""
    form = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "code_verifier": verifier,
    }).encode()
    reply = send_request("POST", metadata["token_endpoint"], FORM_HEADERS, form)
    tokens = reply.read_json() if reply.status == 200 else None
    if tokens is None:
        raise RuntimeError(f"token exchange failed: {describe_failure(reply)}")
    for name in ("access_token", "refresh_token"):
        if not isinstance(tokens.get(name), str) or not tokens[name]:
            raise RuntimeError(f"token exchange gave no {name.replace('_', ' ')}")
    return tokens


def refresh_tokens(metadata: dict, client_id: str, refresh_token: str) -> dict:
    """Trade a refresh token for a new access token.

    The server rotates refresh tokens, so the reply usually holds a new one that
    must replace the old one. A 400 or 401 means this refresh token is refused
    (RefreshRejected). Any other failure is an ordinary error: the token may be fine.
    """
    form = urllib.parse.urlencode({
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
    }).encode()
    reply = send_request("POST", metadata["token_endpoint"], FORM_HEADERS, form)
    if reply.status in (400, 401):
        raise RefreshRejected(f"the server refused the refresh token: {describe_failure(reply)}")
    tokens = reply.read_json() if reply.status == 200 else None
    if tokens is None:
        raise RuntimeError(f"token refresh failed: {describe_failure(reply)}")
    if not isinstance(tokens.get("access_token"), str) or not tokens["access_token"]:
        raise RuntimeError("token refresh gave no access token")
    return tokens
