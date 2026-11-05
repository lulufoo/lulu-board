"""Calls to the Lulu Board API with the stored login.

call_api returns the server's answer for any status except 401, so a command can
read its own failures (a 409 conflict, a 404) from the reply. A 401 sends the
call through one refresh and one retry; a second 401 means the login is no
longer valid.
"""
from __future__ import annotations

import json
import urllib.parse

from board_cli import token_manager
from board_cli.cli_errors import LoginRequired
from board_cli.http_json import Response, send_request

API_HOST = "https://api.luluboard.app"


def build_url(path: str, query: dict | None) -> str:
    """API_HOST plus path, plus the query when there is one."""
    if not query:
        return API_HOST + path
    return API_HOST + path + "?" + urllib.parse.urlencode(query)


def call_api(method: str, path: str, query: dict | None = None, body: dict | None = None) -> Response:
    """One API call as the logged-in user. body, when given, is sent as JSON."""
    url = build_url(path, query)
    data = json.dumps(body).encode("utf-8") if body is not None else None

    def send(token: str) -> Response:
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        return send_request(method, url, headers, data)

    token = token_manager.get_access_token()
    reply = send(token)
    if reply.status != 401:
        return reply
    reply = send(token_manager.get_access_token(rejected=token))
    if reply.status == 401:
        raise LoginRequired(token_manager.REFUSED)
    return reply
