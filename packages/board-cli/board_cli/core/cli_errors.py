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
    """No usable login: exit 4. reason says why.

    resource_metadata is the address the caller gives to login. With it, the stderr line
    says to run login with that address and stdout is {"login_required": true,
    "resource_metadata": ADDRESS}. Without it (the address is not known yet) the line is
    the reason alone and stdout is {"login_required": true}.
    """

    code = 4

    def __init__(self, reason: str, resource_metadata: str | None = None) -> None:
        self.reason = reason
        self.resource_metadata = resource_metadata
        if resource_metadata:
            super().__init__(f"{reason}; run login --resource-metadata-url {resource_metadata}",
                             {"login_required": True, "resource_metadata": resource_metadata})
        else:
            super().__init__(reason, {"login_required": True})

    def point_to(self, resource_metadata: str) -> "LoginRequired":
        """The same failure, with the address to log in at."""
        return LoginRequired(self.reason, resource_metadata)
