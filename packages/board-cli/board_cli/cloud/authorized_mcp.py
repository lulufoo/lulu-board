"""An MCP tool call as the logged-in user: the token is kept fresh, and a 401 gets one refresh and one retry.

A token that is expired, or ends within a minute, is refreshed before the call
(token_manager). A 401 sends the call through one refresh and one retry; a second
401 means the login is no longer valid.

When the login cannot be used the call ends with LoginRequired (exit 4), and it carries
the address to log in at, so the caller never waits and never guesses:
  * after a 401, the address in that 401 (or in the retry's 401);
  * with no token, a login that cannot be refreshed, or a refresh that was refused
    before any call, there is no 401 at hand, so one request without a token asks the
    server for it (find_login_address).
A refresh that fails for another reason (no network, a 5xx) stays an ordinary error.
"""
from __future__ import annotations

from board_cli.auth import token_manager
from board_cli.cloud import mcp_client
from board_cli.cloud.mcp_client import Unauthorized
from board_cli.core.cli_errors import LoginRequired


def point_to_login(failure: LoginRequired, address: str | None) -> LoginRequired:
    """The failure with the address to log in at: the one a 401 gave, or else the one the server names."""
    return failure.point_to(address or mcp_client.find_login_address())


def call_tool_as_user(name: str, arguments: dict) -> object:
    """Call one MCP tool with the stored login and return what it returned."""
    try:
        token = token_manager.get_access_token()
    except LoginRequired as failure:
        raise point_to_login(failure, None) from None
    try:
        return mcp_client.call_tool(name, arguments, token)
    except Unauthorized as refused:
        first = refused
    try:
        token = token_manager.get_access_token(rejected=token)
    except LoginRequired as failure:
        raise point_to_login(failure, first.metadata_url) from None
    try:
        return mcp_client.call_tool(name, arguments, token)
    except Unauthorized as refused:
        raise point_to_login(LoginRequired(token_manager.REFUSED), refused.metadata_url) from None
