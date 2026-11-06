"""Calls to the Lulu Board MCP server: one tools/call, and its answer read from JSON or SSE.

The address is built in (core/mcp_address.py). The server speaks Streamable HTTP, so
every request accepts both reply types, and the reply is one JSON body or an SSE stream
whose events carry JSON-RPC messages. The call is sent as it is: no initialize
handshake, no session, and no MCP-Protocol-Version header (the SDK transport accepts a
request without one). Redirects are not followed.

Tokens are not handled here. A call takes the access token to send, or none; a 401 is
raised as Unauthorized, with the metadata address the server named in WWW-Authenticate.
"""
from __future__ import annotations

import json
import re

from board_cli.core import mcp_address
from board_cli.core.event_stream import read_event_data
from board_cli.core.http_json import Response, send_request

REQUEST_ID = 1
REASON_LIMIT = 120
CALL_HEADERS = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
METADATA_PARAM = re.compile(r'resource_metadata\s*=\s*"([^"]+)"')


class Unauthorized(RuntimeError):
    """The server answered 401. metadata_url is the address it named in WWW-Authenticate, or None."""

    def __init__(self, message: str, metadata_url: str | None) -> None:
        super().__init__(message)
        self.metadata_url = metadata_url


class ToolFailed(RuntimeError):
    """The tool ran and reported isError. reason is its text; the message is that text cut short."""

    def __init__(self, reason: str) -> None:
        super().__init__(f"the MCP tool failed: {reason[:REASON_LIMIT]}")
        self.reason = reason


def find_metadata_url(headers: dict) -> str | None:
    """The resource_metadata address in a WWW-Authenticate header (names in lower case), or None."""
    found = METADATA_PARAM.search(headers.get("www-authenticate", ""))
    return found.group(1) if found else None


def describe_failure(reply: Response) -> str:
    """HTTP status plus the server's short reason when its JSON body gives one."""
    body = reply.read_json() or {}
    error = body.get("error")
    reason = error.get("message") if isinstance(error, dict) else error
    return f"the MCP server answered HTTP {reply.status}" + (f": {reason[:REASON_LIMIT]}" if isinstance(reason, str) and reason else "")


def pick_reply(reply: Response) -> dict:
    """The JSON-RPC message that answers the call, from a JSON body or from the events of an SSE stream."""
    kind = reply.headers.get("content-type", "").split(";")[0].strip().lower()
    if kind == "application/json":
        candidates = [reply.text]
    elif kind == "text/event-stream":
        candidates = read_event_data(reply.text)
    else:
        raise RuntimeError(f"the MCP server answered with {kind or 'no content type'}, not JSON or an event stream")
    for text in candidates:
        try:
            message = json.loads(text)
        except ValueError:
            continue
        if isinstance(message, dict) and message.get("id") == REQUEST_ID and ("result" in message or "error" in message):
            return message
    raise RuntimeError("the MCP server's answer holds no reply to the call")


def read_tool_result(message: dict) -> object:
    """The JSON a tool returned in its one text content. A JSON-RPC error or isError is a RuntimeError."""
    if "error" in message:
        error = message["error"]
        reason = error.get("message") if isinstance(error, dict) else None
        raise RuntimeError(f"the MCP server refused the call: {str(reason)[:REASON_LIMIT]}")
    result = message["result"]
    items = result.get("content") if isinstance(result, dict) else None
    texts = [item["text"] for item in items or []
             if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str)]
    if isinstance(result, dict) and result.get("isError") is True:
        raise ToolFailed(" ".join(texts))
    if len(texts) != 1:
        raise RuntimeError("the MCP tool's answer does not hold exactly one text")
    try:
        return json.loads(texts[0])
    except ValueError:
        raise RuntimeError("the MCP tool's text is not JSON") from None


def call_tool(name: str, arguments: dict, token: str | None = None) -> object:
    """Call one MCP tool and return what it returned, the JSON in its text content.

    Raises Unauthorized on a 401, ToolFailed when the tool reports an error, and
    RuntimeError for any other failure: another HTTP status, a JSON-RPC error, or an
    answer that is not what the protocol says.
    """
    body = {"jsonrpc": "2.0", "id": REQUEST_ID, "method": "tools/call", "params": {"name": name, "arguments": arguments}}
    headers = dict(CALL_HEADERS)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    reply = send_request("POST", mcp_address.MCP_URL, headers, json.dumps(body, ensure_ascii=False).encode("utf-8"))
    if reply.status == 401:
        raise Unauthorized("the MCP server refused the login (HTTP 401)", find_metadata_url(reply.headers))
    if not 200 <= reply.status < 300:
        raise RuntimeError(describe_failure(reply))
    return read_tool_result(pick_reply(reply))
