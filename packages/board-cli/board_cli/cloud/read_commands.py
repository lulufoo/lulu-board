"""get-diagram, get-group, and search-diagrams: the cloud commands that only read.

They call the MCP server's tools as the logged-in user (authorized_mcp), so a missing
or refused login is exit 4. get-diagram writes the source to a file; no output holds
the source. board_control.py documents the contract.
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

from board_cli.cloud.authorized_mcp import call_tool_as_user
from board_cli.cloud.diagram_model import (
    DIAGRAM_ID, check_diagram_id, check_group_id, diagram_info, diagram_url, read_list, read_object,
)
from board_cli.cloud.mcp_client import ToolFailed
from board_cli.core.cli_output import emit
from board_cli.source import sketch_schema as schema
from board_cli.source.source_kind import detect_extension

# A member with no usable sort_order goes last, as in the MCP server (JavaScript's MAX_SAFE_INTEGER).
LAST_RANK = 9007199254740991
# What get_diagram and get_group fail with for a diagram that is not there (packages/board-mcp/src/graphs.js).
NOT_FOUND = "Cloud board not found"


def valid_diagram_id(raw: object) -> str | None:
    """The id when it is a well-formed diagram id, else None."""
    text = str(raw or "").strip()
    return text if DIAGRAM_ID.fullmatch(text) else None


def rank_of(raw: object) -> float:
    """A sort_order as a number; a missing or unusable one ranks last."""
    if isinstance(raw, bool) or not isinstance(raw, (int, float)) or not math.isfinite(raw):
        return LAST_RANK
    return raw


def call_diagram_tool(name: str, diagram_id: str) -> object:
    """Call a tool that takes one diagram id. The server's not-found text becomes the CLI's own."""
    try:
        return call_tool_as_user(name, {"diagram_id": diagram_id})
    except ToolFailed as failure:
        if failure.reason == NOT_FOUND:
            raise RuntimeError(f"cloud diagram not found: {diagram_id}") from None
        raise


def run_get_diagram(args: argparse.Namespace) -> None:
    diagram_id = check_diagram_id(args.diagram_id)
    row = read_object(call_diagram_tool("get_diagram", diagram_id), "the diagram")
    source = row.get("bmd")
    if not isinstance(source, str):
        raise RuntimeError(f"the MCP server returned no source for {diagram_id}")
    info = diagram_info(diagram_id, row)  # checks the row first, so a bad one leaves no file behind
    path = Path(args.out).resolve() / (diagram_id + detect_extension(source))
    schema.write_file(path, source)
    emit({**info, "file": str(path)})


def collect_group(answer: object) -> dict:
    """The group and its members as get_group returned them, already in display order."""
    group = read_object(answer, "the group")
    members = []
    for row in read_list(group.get("members"), "the group's members"):
        member_id = valid_diagram_id(row.get("diagram_id")) if isinstance(row, dict) else None
        if member_id:
            members.append({"diagram_id": member_id, "title": row.get("title") or "",
                            "sort_order": rank_of(row.get("sort_order")), "url": diagram_url(member_id)})
    return {"group_id": check_group_id(group.get("group_id")), "members": members}


def run_get_group(args: argparse.Namespace) -> None:
    diagram_id = check_diagram_id(args.diagram_id)
    emit(collect_group(call_diagram_tool("get_group", diagram_id)))


def run_search_diagrams(args: argparse.Namespace) -> None:
    query = args.query.strip()
    if not query:
        raise RuntimeError("--query must not be empty")
    results = []
    for row in read_list(call_tool_as_user("search_diagrams", {"query": query}), "the search"):
        diagram_id = valid_diagram_id(row.get("diagram_id")) if isinstance(row, dict) else None
        if diagram_id:
            results.append({"diagram_id": diagram_id, "title": row.get("title") or "", "url": diagram_url(diagram_id)})
    emit({"results": results})


def register_commands(sub: "argparse._SubParsersAction") -> None:
    get = sub.add_parser("get-diagram", help="write one cloud diagram's source to a file (login needed)")
    get.add_argument("--diagram-id", required=True, help="cloud diagram id: b_ and 8 lowercase hex digits")
    get.add_argument("--out", required=True, help="output directory")
    get.set_defaults(run=run_get_diagram)
    group = sub.add_parser("get-group", help="list the diagrams in the group of a diagram (login needed)")
    group.add_argument("--diagram-id", required=True, help="id of a diagram in the group")
    group.set_defaults(run=run_get_group)
    search = sub.add_parser("search-diagrams", help="search your own cloud diagrams (login needed)")
    search.add_argument("--query", required=True, help="search text; must not be blank")
    search.set_defaults(run=run_search_diagrams)
