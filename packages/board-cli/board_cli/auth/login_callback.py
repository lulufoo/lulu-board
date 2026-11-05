"""The local listener that receives the browser redirect at the end of login.

It binds 127.0.0.1 on a fixed port, because the authorization server accepts
only the redirect address registered for the client. A request that does not
carry the expected state is answered with 400 and ignored, so a stray request
cannot end the login.
"""
from __future__ import annotations

import http.server
import time
import urllib.parse

CALLBACK_PATH = "/callback"
DONE_PAGE = "<h3>Lulu Board CLI is authorized. You can close this tab.</h3>".encode("utf-8")


class CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        params = {name: values[0] for name, values in urllib.parse.parse_qs(parsed.query).items()}
        if parsed.path != CALLBACK_PATH or params.get("state") != self.server.expected_state:
            self.send_response(400)
            self.end_headers()
            return
        self.server.result = params
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(DONE_PAGE)

    def log_message(self, format: str, *args) -> None:
        """Keep the request line off stderr."""


class CallbackServer(http.server.HTTPServer):
    """Bind first, so a port that is taken fails before anything is registered."""

    def __init__(self, port: int, state: str) -> None:
        try:
            super().__init__(("127.0.0.1", port), CallbackHandler)
        except OSError as err:
            raise RuntimeError(
                f"callback port {port} is in use ({err.strerror}); close what holds it and run login again"
            ) from None
        self.expected_state = state
        self.result: dict | None = None

    def wait_for_result(self, seconds: float) -> dict | None:
        """The query parameters of the matching redirect, or None after the time is up."""
        self.timeout = 0.5
        deadline = time.monotonic() + seconds
        while self.result is None and time.monotonic() < deadline:
            self.handle_request()
        return self.result
