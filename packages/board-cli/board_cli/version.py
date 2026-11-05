"""The CLI version: one constant, read by --version, the build, and the release check.

Dotted integers (0.1.0), so a caller can compare it with a minimum version.
"""
from __future__ import annotations

import argparse

from board_cli.cli_output import emit

VERSION = "0.1.0"


class VersionAction(argparse.Action):
    """--version: print {"version": ...} and exit 0, before any command is required."""

    def __init__(self, option_strings, dest=argparse.SUPPRESS, default=argparse.SUPPRESS, help=None):
        super().__init__(option_strings, dest=dest, default=default, nargs=0, help=help)

    def __call__(self, parser, namespace, values, option_string=None):
        emit({"version": VERSION})
        parser.exit()
