"""One HTTP request with the CLI's own User-Agent. Redirects are never followed.

Cloudflare in front of the luluboard.app hosts has answered Python's default
User-Agent with 403 (error 1010), so every request sets its own.
"""
from __future__ import annotations

import http.client
import json
import urllib.error
import urllib.parse
import urllib.request
from typing import NamedTuple

from board_cli.core.version import VERSION

USER_AGENT = f"lulu-board-cli/{VERSION} (+https://luluboard.app)"
TIMEOUT_SECONDS = 20


class Response(NamedTuple):
    status: int
    headers: dict  # names in lower case
    text: str

    def read_json(self) -> dict | None:
        """The body as a JSON object, or None when it is not one."""
        try:
            data = json.loads(self.text)
        except ValueError:
            return None
        return data if isinstance(data, dict) else None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def build_response(status: int, headers, body: bytes) -> Response:
    lowered = {name.lower(): value for name, value in headers.items()}
    return Response(status, lowered, body.decode("utf-8", "replace"))


def send_request(method: str, url: str, headers: dict | None = None, data: bytes | None = None) -> Response:
    """Send one request. A non-2xx status is returned, not raised; no answer raises RuntimeError."""
    merged = {"User-Agent": USER_AGENT, **(headers or {})}
    request = urllib.request.Request(url, data=data, method=method, headers=merged)
    try:
        with OPENER.open(request, timeout=TIMEOUT_SECONDS) as reply:
            return build_response(reply.status, reply.headers, reply.read())
    except urllib.error.HTTPError as err:
        try:
            return build_response(err.code, err.headers, err.read())
        finally:
            err.close()
    except (urllib.error.URLError, http.client.HTTPException, OSError) as err:
        reason = getattr(err, "reason", err)
        raise RuntimeError(f"cannot reach {urllib.parse.urlparse(url).netloc}: {reason}") from None
