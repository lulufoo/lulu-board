"""get-diagram, get-group, and search-diagrams: the cloud commands that only read.

They call the API as the logged-in user (api_client), so a missing or refused
login is exit 4. get-diagram writes the source to a file; no output holds the
source. board_control.py documents the contract.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from board_cli.cloud.api_client import call_api
from board_cli.cloud.diagram_model import (
    DIAGRAM_ID, check_diagram_id, check_group_id, check_reply, diagram_info, diagram_url,
)
from board_cli.core.cli_output import emit
from board_cli.core.http_json import Response
from board_cli.source import sketch_schema as schema
from board_cli.source.source_kind import detect_extension

# A member with no usable sort_order goes last, as in the MCP server (JavaScript's MAX_SAFE_INTEGER).
LAST_RANK = 9007199254740991
MINE = "mine"


def read_list(reply: Response, what: str) -> list:
    """The reply body as a JSON list."""
    try:
        data = json.loads(reply.text)
    except ValueError:
        data = None
    if not isinstance(data, list):
        raise RuntimeError(f"the API answered {what} with something other than a list")
    return data


def valid_diagram_id(raw: object) -> str | None:
    """The id when it is a well-formed diagram id, else None."""
    text = str(raw or "").strip()
    return text if DIAGRAM_ID.fullmatch(text) else None


def rank_of(raw: object) -> float:
    """A sort_order as a number; a missing or unusable one ranks last."""
    if isinstance(raw, bool) or not isinstance(raw, (int, float)) or not math.isfinite(raw):
        return LAST_RANK
    return raw


def fetch_row(diagram_id: str) -> dict:
    """The cloud row of a diagram, source included. A missing diagram is an ordinary error."""
    reply = call_api("GET", "/graphs", query={"diagram_id": diagram_id})
    check_reply(reply, not_found=f"cloud diagram not found: {diagram_id}")
    row = reply.read_json()
    if row is None:
        raise RuntimeError("the API answered the diagram with something other than an object")
    return row


def run_get_diagram(args: argparse.Namespace) -> None:
    diagram_id = check_diagram_id(args.diagram_id)
    row = fetch_row(diagram_id)
    source = row.get("bmd")
    if not isinstance(source, str):
        raise RuntimeError(f"the API returned no source for {diagram_id}")
    info = diagram_info(diagram_id, row)  # checks the row first, so a bad one leaves no file behind
    path = Path(args.out).resolve() / (diagram_id + detect_extension(source))
    schema.write_file(path, source)
    emit({**info, "file": str(path)})


def collect_group(diagram_id: str, rows: list) -> dict:
    """The group of diagram_id and its members in display order, from the /groups/shells rows."""
    group_id = ""
    found = False
    pending = []
    for row in rows:
        member_id = valid_diagram_id(row.get("graph_id")) if isinstance(row, dict) else None
        if not member_id:
            continue
        raw_group = str(row.get("group_id") or "").strip()
        if member_id == diagram_id:
            found, group_id = True, raw_group
        pending.append({"diagram_id": member_id, "title": row.get("title") or "",
                        "sort_order": rank_of(row.get("sort_order")), "group_id": raw_group})
    if not found:
        raise RuntimeError(f"cloud diagram not found: {diagram_id}")
    group_id = check_group_id(group_id)
    members = [{"diagram_id": item["diagram_id"], "title": item["title"],
                "sort_order": item["sort_order"], "url": diagram_url(item["diagram_id"])}
               for item in pending if item["group_id"] == group_id]
    members.sort(key=lambda member: (member["sort_order"], member["diagram_id"]))
    return {"group_id": group_id, "members": members}


def run_get_group(args: argparse.Namespace) -> None:
    diagram_id = check_diagram_id(args.diagram_id)
    reply = call_api("POST", "/groups/shells", body={"diagram_id": diagram_id})
    check_reply(reply, not_found=f"cloud diagram not found: {diagram_id}")
    emit(collect_group(diagram_id, read_list(reply, "the group")))


def run_search_diagrams(args: argparse.Namespace) -> None:
    query = args.query.strip()
    if not query:
        raise RuntimeError("--query must not be empty")
    reply = call_api("POST", "/search", body={"query": query})
    check_reply(reply)
    results = []
    for row in read_list(reply, "the search"):
        diagram_id = valid_diagram_id(row.get("graph_id")) if isinstance(row, dict) else None
        if diagram_id and row.get("category") == MINE:
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
