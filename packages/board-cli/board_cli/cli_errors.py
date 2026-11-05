"""Failures that board_control.main turns into their own exit code.

Anything else that is a RuntimeError or OSError is an ordinary error, exit 1.
"""
from __future__ import annotations


class LoginRequired(RuntimeError):
    """No usable login: exit 4, with {"login_required": true} on stdout.

    The message is the one stderr line, and tells the user to run login.
    """
