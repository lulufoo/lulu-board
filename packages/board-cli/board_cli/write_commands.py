"""create-diagram and save-diagram: the cloud commands that write.

The file goes up exactly as written. The server drops leading meta lines and takes
the title from the source itself, and falls back to Untitled. The reply carries
the source back; it is dropped, so no output holds it. A save that finds another
version in the cloud saves nothing and exits 3 (VersionConflict). board_control.py
documents the contract.
"""
from __future__ import annotations

import argparse
import re

from board_cli.api_client import call_api
from board_cli.cli_errors import LoginRequired, VersionConflict
from board_cli.cli_output import emit
from board_cli.diagram_model import (
    check_diagram_id, check_group_argument, check_reply, coerce_version, diagram_info,
)
from board_cli.http_json import Response
from board_cli.read_commands import fetch_row, valid_diagram_id
from board_cli.source_files import read_checked_source

WHOLE_NUMBER = re.compile(r"[0-9]+")
# Past this a number no longer survives the server's JSON reading unchanged.
MAX_VERSION = 9007199254740991


def check_expected_version(raw: str) -> int:
    """The version as a whole number from 1 up. Nothing is rounded: 0, -1, 1.5, and words fail."""
    text = str(raw).strip()
    if not WHOLE_NUMBER.fullmatch(text) or not 1 <= int(text) <= MAX_VERSION:
        raise RuntimeError(f"--expected-version must be a whole number from 1 to {MAX_VERSION}, not {raw!r}")
    return int(text)


def read_saved(reply: Response, action: str) -> dict:
    """The public fields of the diagram the API answered with. The source in the reply is left out."""
    row = reply.read_json()
    diagram_id = valid_diagram_id(row.get("diagram_id")) if row else None
    if not diagram_id:
        raise RuntimeError(f"the API's reply to {action} holds no diagram id")
    return diagram_info(diagram_id, row)


def find_conflict(diagram_id: str, expected: int) -> VersionConflict:
    """The exit-3 result for a save the server turned down, with the version the cloud holds now."""
    try:
        latest = coerce_version(fetch_row(diagram_id).get("version"))
    except LoginRequired:
        raise
    except RuntimeError as err:
        raise RuntimeError(f"version conflict on {diagram_id}, and the latest version could not be read: {err}") from None
    return VersionConflict(
        f"version conflict: {diagram_id} is at version {latest}, not {expected}; run get-diagram for the latest source",
        diagram_id, latest,
    )


def run_create_diagram(args: argparse.Namespace) -> None:
    body: dict = {}
    if args.diagram_id is not None:
        body["diagram_id"] = check_diagram_id(args.diagram_id)
    if args.group_id is not None:
        body["group_id"] = check_group_argument(args.group_id)
    body["bmd"] = read_checked_source(args.file, "create-diagram")
    reply = call_api("POST", "/graphs", body=body)
    check_reply(reply)
    emit(read_saved(reply, "create-diagram"))


def run_save_diagram(args: argparse.Namespace) -> None:
    diagram_id = check_diagram_id(args.diagram_id)
    expected = check_expected_version(args.expected_version)
    source = read_checked_source(args.file, "save-diagram")
    reply = call_api("PATCH", "/graphs", body={"diagram_id": diagram_id, "bmd": source, "expected_version": expected})
    if reply.status == 409:
        raise find_conflict(diagram_id, expected)
    check_reply(reply)
    emit(read_saved(reply, "save-diagram"))


def register_commands(sub: "argparse._SubParsersAction") -> None:
    create = sub.add_parser("create-diagram", help="upload a source file as a new cloud diagram (login needed)")
    create.add_argument("--file", required=True, help="source file: .skt (Sketch), .bmd (Boxes), or .mmd (Mermaid)")
    create.add_argument("--diagram-id", help="id for the new diagram: b_ and 8 lowercase hex digits; the server picks one when omitted")
    create.add_argument("--group-id", help="put the diagram in this group of yours: g_ and 8 lowercase hex digits")
    create.set_defaults(run=run_create_diagram)
    save = sub.add_parser("save-diagram", help="replace the source of a cloud diagram (login needed)")
    save.add_argument("--diagram-id", required=True, help="cloud diagram id: b_ and 8 lowercase hex digits")
    save.add_argument("--file", required=True, help="source file: .skt (Sketch), .bmd (Boxes), or .mmd (Mermaid)")
    save.add_argument("--expected-version", required=True, help="the version you read last: a whole number from 1")
    save.set_defaults(run=run_save_diagram)
