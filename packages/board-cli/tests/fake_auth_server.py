"""A fake Lulu Board authorization server and a fake browser, for the login tests.

The server speaks the endpoints login uses, over real HTTP on a loopback port.
It answers like the real one does where that was checked: an unknown client_id
and a redirect address that was not registered are both 400. The test runner
skips this file.
"""
from __future__ import annotations

import base64
import hashlib
import json
import threading
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from board_cli_support import make_token

FUTURE = 4102444800  # 2100-01-01
METADATA_PATH = "/.well-known/oauth-authorization-server/auth/v1"
CLIENT_NOT_FOUND = {"code": 400, "error_code": "oauth_client_not_found", "msg": "invalid client_id"}
BAD_REDIRECT = {"code": 400, "error_code": "validation_failed", "msg": "invalid redirect_uri"}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        """Keep the request line off stderr."""

    def reply(self, status: int, body: dict | None = None, headers: dict | None = None) -> None:
        payload = json.dumps(body).encode() if body is not None else b""
        self.send_response(status)
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:
        fake = self.server.fake
        fake.requests.append(("GET", self.path, self.headers.get("User-Agent")))
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == METADATA_PATH:
            self.reply(*fake.reply_metadata())
        elif parsed.path == "/auth/v1/oauth/authorize":
            query = {name: values[0] for name, values in urllib.parse.parse_qs(parsed.query).items()}
            self.reply(*fake.reply_authorize(query))
        else:
            self.reply(404, {"msg": "not found"})

    def do_POST(self) -> None:
        fake = self.server.fake
        fake.requests.append(("POST", self.path, self.headers.get("User-Agent")))
        raw = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        path = urllib.parse.urlparse(self.path).path
        if path == "/auth/v1/oauth/clients/register":
            self.reply(*fake.reply_register(json.loads(raw)))
        elif path == "/auth/v1/oauth/token":
            form = {name: values[0] for name, values in urllib.parse.parse_qs(raw.decode()).items()}
            self.reply(*fake.reply_token(form))
        else:
            self.reply(404, {"msg": "not found"})


class FakeAuthServer:
    def __init__(self) -> None:
        self.clients: dict[str, list] = {}   # client_id -> registered redirect addresses
        self.registrations: list[dict] = []  # every registration payload
        self.requests: list[tuple] = []      # (method, path, user agent)
        self.authorize_queries: list[dict] = []
        self.codes: dict[str, dict] = {}     # issued code -> what it was issued for
        self.token_forms: list[dict] = []
        self.access_claims = {"email": "me@example.com", "sub": "user-123", "exp": FUTURE}
        self.refuse_registration = False
        self.refuse_token = False
        self.omit_refresh_token = False
        self.force_authorize_status: int | None = None
        self.issued = 0
        self.http = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.http.fake = self
        self.base = f"http://127.0.0.1:{self.http.server_address[1]}"
        self.thread = threading.Thread(target=self.http.serve_forever, args=(0.01,), daemon=True)

    def start(self) -> "FakeAuthServer":
        self.thread.start()
        return self

    def stop(self) -> None:
        self.http.shutdown()
        self.http.server_close()
        self.thread.join(timeout=5)

    def forget_clients(self) -> None:
        """What the server does when its clients are cleared."""
        self.clients.clear()

    def reply_metadata(self) -> tuple:
        return 200, {
            "issuer": self.base + "/auth/v1",
            "authorization_endpoint": self.base + "/auth/v1/oauth/authorize",
            "token_endpoint": self.base + "/auth/v1/oauth/token",
            "registration_endpoint": self.base + "/auth/v1/oauth/clients/register",
        }

    def reply_register(self, payload: dict) -> tuple:
        self.registrations.append(payload)
        if self.refuse_registration:
            return 400, {"code": 400, "msg": "registration is closed"}
        client_id = f"client-{len(self.registrations)}"
        self.clients[client_id] = list(payload["redirect_uris"])
        return 201, {"client_id": client_id}

    def reply_authorize(self, query: dict) -> tuple:
        self.authorize_queries.append(query)
        if self.force_authorize_status:
            return self.force_authorize_status, {"msg": "boom"}
        client_id = query.get("client_id", "")
        if client_id not in self.clients:
            return 400, CLIENT_NOT_FOUND
        if query.get("redirect_uri") not in self.clients[client_id]:
            return 400, BAD_REDIRECT
        return 302, None, {"Location": "https://luluboard.app/oauth/consent?authorization_id=fake"}

    def approve(self, url: str) -> str:
        """What the consent page does on approval: issue a code bound to this request."""
        query = {name: values[0] for name, values in urllib.parse.parse_qs(urllib.parse.urlparse(url).query).items()}
        self.issued += 1
        code = f"code-{self.issued}"
        self.codes[code] = {"client_id": query["client_id"], "redirect_uri": query["redirect_uri"],
                            "challenge": query["code_challenge"]}
        return code

    def reply_token(self, form: dict) -> tuple:
        self.token_forms.append(form)
        issued = self.codes.get(form.get("code", ""))
        digest = hashlib.sha256(form.get("code_verifier", "").encode()).digest()
        challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
        valid = (form.get("grant_type") == "authorization_code" and issued is not None
                 and issued["client_id"] == form.get("client_id")
                 and issued["redirect_uri"] == form.get("redirect_uri")
                 and issued["challenge"] == challenge)
        if self.refuse_token or not valid:
            return 400, {"error": "invalid_grant", "error_description": "code or verifier does not match"}
        body = {"access_token": make_token(self.access_claims), "expires_in": 3600, "token_type": "bearer"}
        if not self.omit_refresh_token:
            body["refresh_token"] = f"refresh-{len(self.token_forms)}"
        return 200, body


class FakeBrowser:
    """Stands in for webbrowser.open. It plays what the browser does after the user decides."""

    def __init__(self, fake: FakeAuthServer, outcome: str = "approve") -> None:
        self.fake = fake
        self.outcome = outcome   # approve | deny | stray_then_approve | nothing
        self.opened: list[str] = []
        self.threads: list[threading.Thread] = []

    def __call__(self, url: str) -> bool:
        self.opened.append(url)
        if self.outcome != "nothing":
            thread = threading.Thread(target=self.visit_callback, args=(url,), daemon=True)
            thread.start()
            self.threads.append(thread)
        return True

    def visit_callback(self, url: str) -> None:
        query = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        redirect, state = query["redirect_uri"][0], query["state"][0]
        if self.outcome == "deny":
            self.get(redirect, {"error": "access_denied", "error_description": "the user said no", "state": state})
            return
        if self.outcome == "stray_then_approve":
            self.get(redirect, {"code": "stray", "state": "not-the-state"})
            self.get(redirect.replace("/callback", "/elsewhere"), {"code": "stray", "state": state})
        self.get(redirect, {"code": self.fake.approve(url), "state": state})

    @staticmethod
    def get(redirect: str, params: dict) -> None:
        try:
            urllib.request.urlopen(redirect + "?" + urllib.parse.urlencode(params), timeout=10).read()
        except OSError:
            pass  # a 400 for a stray request is expected

    def finish(self) -> None:
        for thread in self.threads:
            thread.join(timeout=10)
