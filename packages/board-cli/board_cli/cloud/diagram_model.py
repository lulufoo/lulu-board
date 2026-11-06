"""What the cloud commands share about a diagram: its ids, its link, its public fields, and the shape of a tool's answer.

The rules follow the MCP server (packages/board-mcp/src/graphs.js and index.js), so
a command here answers as the tool it calls.
"""
from __future__ import annotations

import math
import re

WEB_ORIGIN = "https://luluboard.app"
DIAGRAM_ID = re.compile(r"b_[0-9a-f]{8}")
GROUP_ID = re.compile(r"g_[0-9a-f]{8}")


def check_diagram_id(raw: str) -> str:
    """The id with its outer spaces removed, or RuntimeError when it is not b_ and 8 lowercase hex digits."""
    diagram_id = str(raw or "").strip()
    if not DIAGRAM_ID.fullmatch(diagram_id):
        raise RuntimeError(f"invalid diagram id {raw!r}: expected b_ and 8 lowercase hex digits")
    return diagram_id


def check_group_argument(raw: str) -> str:
    """A group id the caller typed: g_ and 8 lowercase hex digits, outer spaces removed."""
    group_id = str(raw or "").strip()
    if not GROUP_ID.fullmatch(group_id):
        raise RuntimeError(f"invalid group id {raw!r}: expected g_ and 8 lowercase hex digits")
    return group_id


def check_group_id(raw: object) -> str:
    """A group id from the server: g_ and 8 lowercase hex digits."""
    group_id = str(raw or "").strip()
    if not group_id:
        raise RuntimeError("the MCP server gave no group id")
    if not GROUP_ID.fullmatch(group_id):
        raise RuntimeError(f"the MCP server gave an invalid group id {group_id!r}")
    return group_id


def diagram_url(diagram_id: str) -> str:
    """The address that opens the diagram in the web app."""
    return f"{WEB_ORIGIN}/#b:{diagram_id}"


def read_object(data: object, what: str) -> dict:
    """What a tool returned, as a JSON object."""
    if not isinstance(data, dict):
        raise RuntimeError(f"the MCP server answered {what} with something other than an object")
    return data


def read_list(data: object, what: str) -> list:
    """What a tool returned, as a JSON list."""
    if not isinstance(data, list):
        raise RuntimeError(f"the MCP server answered {what} with something other than a list")
    return data


def coerce_version(raw: object) -> int:
    """The version as a whole number of at least 1; anything else counts as 1, as the MCP server does."""
    if isinstance(raw, bool) or not isinstance(raw, (int, float)) or not math.isfinite(raw):
        return 1
    return int(raw) if raw >= 1 else 1


def diagram_info(diagram_id: str, row: dict) -> dict:
    """The public fields of a diagram row: everything but the source."""
    return {
        "diagram_id": diagram_id,
        "title": row.get("title") or "",
        "version": coerce_version(row.get("version")),
        "updated_at": row.get("updated_at") or "",
        "group_id": check_group_id(row.get("group_id")),
        "url": diagram_url(diagram_id),
    }
