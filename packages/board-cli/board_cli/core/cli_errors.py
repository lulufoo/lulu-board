"""Failures that board_control.main turns into their own exit code and stdout object.

Anything else that is a RuntimeError or OSError is an ordinary error, exit 1.
"""
from __future__ import annotations


class SpecialExit(RuntimeError):
    """A failure with its own exit code. The message is the one stderr line; payload is the stdout object."""

    code = 1

    def __init__(self, message: str, payload: dict) -> None:
        super().__init__(message)
        self.payload = payload


class VersionConflict(SpecialExit):
    """The cloud holds another version than the one the caller saved against: exit 3. Nothing was saved."""

    code = 3

    def __init__(self, message: str, diagram_id: str, latest_version: int) -> None:
        super().__init__(message, {"conflict": True, "diagram_id": diagram_id, "latest_version": latest_version})


class LoginRequired(SpecialExit):
    """No usable login: exit 4. The message tells the user to run login."""

    code = 4

    def __init__(self, message: str) -> None:
        super().__init__(message, {"login_required": True})
