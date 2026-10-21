#!/usr/bin/env python3
"""CLI entry for the Mermaid public preview controller."""
from __future__ import annotations

import argparse
import json
import sys

from drawer_ctl.commands import preview, status


def parser():
    p = argparse.ArgumentParser(description="Preview Lulu Vela flowchart source.")
    commands = p.add_subparsers(dest="command", required=True)
    commands.add_parser("status", help="print mermaid preview status as JSON")
    prev_p = commands.add_parser("preview", help="emit the public hash URL without writing history")
    prev_p.add_argument("--file", help="read UTF-8 source from a file; otherwise read stdin")
    prev_p.add_argument("--kind", choices=["flowchart"], default="flowchart", help="which live source to encode")
    prev_p.add_argument("--id", dest="source_id", help="leftover; ignored")
    prev_p.add_argument("--no-open", action="store_true", help="do not open any browser")
    prev_p.add_argument("--open-system", action="store_true", help="open in the macOS/default browser instead")
    return p


def main(argv=None) -> int:
    args = parser().parse_args(argv)
    try:
        if args.command == "status":
            print(json.dumps(status(), ensure_ascii=False))
        elif args.command == "preview":
            if args.no_open:
                mode = "none"
            elif getattr(args, "open_system", False):
                mode = "system"
            else:
                mode = "ide"
            preview(
                args.file,
                should_open=mode != "none",
                open_mode=mode,
                kind=getattr(args, "kind", "flowchart"),
                source_id=getattr(args, "source_id", None),
            )
        return 0
    except Exception as exc:
        print(f"drawer: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
