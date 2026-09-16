#!/usr/bin/env python3
"""CLI entry for the local Drawer controller.

Implementation: `drawer_ctl/` package.
Import surface for tests/macros: `import drawer_control as dc`.

For tests that swap the cache dir, assign `drawer_ctl.paths.STATE_DIR`
(not `dc.STATE_DIR` — star-import would snapshot a stale Path).
"""
from __future__ import annotations

import argparse
import json
import sys

from drawer_ctl import paths as _paths
from drawer_ctl.paths import *  # noqa: F403
from drawer_ctl.util import *  # noqa: F403
from drawer_ctl.titles import *  # noqa: F403
from drawer_ctl.document import *  # noqa: F403
from drawer_ctl.export import *  # noqa: F403
from drawer_ctl.board import *  # noqa: F403
from drawer_ctl.migrate import migrate_document_envelopes  # noqa: F401
from drawer_ctl.server import *  # noqa: F403
from drawer_ctl.commands import *  # noqa: F403

# Drop star-imported snapshot so `dc.STATE_DIR` reads stay live.
del STATE_DIR  # noqa: F821


def __getattr__(name: str):
    if name == "STATE_DIR":
        return _paths.STATE_DIR
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__():
    return sorted(set(globals()) | {"STATE_DIR"})


def parser():
    p = argparse.ArgumentParser(description="Mount and control the Lulu Board viewer.")
    commands = p.add_subparsers(dest="command", required=True)
    mount_p = commands.add_parser("mount", help="start or reuse the local viewer")
    mount_p.add_argument("--port", type=int, default=0, help="loopback port; 0 = fixed default (paths.DEFAULT_PORT)")
    mount_p.add_argument("--open", action="store_true", dest="should_open", help="open in Cursor/VS Code Simple Browser")
    mount_p.add_argument("--open-system", action="store_true", help="open in the macOS/default browser instead")
    commands.add_parser("status", help="print viewer status as JSON")
    commands.add_parser("stop", help="stop viewer and clear server state")
    prev_p = commands.add_parser("preview", help="mount, set-source, and open browser")
    prev_p.add_argument("--file", help="read UTF-8 source from a file; otherwise read stdin")
    prev_p.add_argument("--kind", choices=["board"], default="board", help="which live source to write")
    prev_p.add_argument("--id", dest="source_id", help="BMD ID (b_…); omit to mint")
    prev_p.add_argument("--port", type=int, default=0, help="loopback port; 0 = fixed default (paths.DEFAULT_PORT)")
    prev_p.add_argument("--no-open", action="store_true", help="do not open any browser")
    prev_p.add_argument("--open-system", action="store_true", help="open in the macOS/default browser instead")
    source_p = commands.add_parser("set-source", help="write Board source")
    source_p.add_argument("--file", help="read UTF-8 source from a file; otherwise read stdin")
    source_p.add_argument("--kind", choices=["board"], default="board", help="which live source to write")
    source_p.add_argument("--id", dest="source_id", help="BMD ID (b_…); omit to mint")
    get_p = commands.add_parser("get-source", help="print BMD Source for --id")
    get_p.add_argument("--kind", choices=["board"], default="board", help="which live source to print")
    get_p.add_argument("--id", dest="source_id", help="BMD ID (b_…); required")
    serve_p = commands.add_parser(SERVE_COMMAND, help=argparse.SUPPRESS)
    serve_p.add_argument("--port", type=int, default=0)
    return p


def main(argv=None) -> int:
    args = parser().parse_args(argv)
    try:
        if args.command == "mount":
            mode = "none"
            if getattr(args, "open_system", False):
                mode = "system"
            elif args.should_open:
                mode = "ide"
            print(mount(args.port, should_open=False, open_mode=mode))
        elif args.command == "status":
            print(json.dumps(status(), ensure_ascii=False))
        elif args.command == "stop":
            stop_server()
        elif args.command == "preview":
            if args.no_open:
                mode = "none"
            elif getattr(args, "open_system", False):
                mode = "system"
            else:
                mode = "ide"
            preview(
                args.file,
                args.port,
                should_open=mode != "none",
                open_mode=mode,
                kind=getattr(args, "kind", "board"),
                source_id=getattr(args, "source_id", None),
            )
        elif args.command == "set-source":
            set_source(
                args.file,
                kind=getattr(args, "kind", "board"),
                source_id=getattr(args, "source_id", None),
            )
        elif args.command == "get-source":
            get_source(
                kind=getattr(args, "kind", "board"),
                source_id=getattr(args, "source_id", None),
            )
        elif args.command == SERVE_COMMAND:
            return run_serve(resolve_port(args.port))
        return 0
    except Exception as exc:
        print(f"drawer: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
