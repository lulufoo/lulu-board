"""The access token a cloud command calls the API with, refreshed when it must be.

A token that is expired, or ends within REFRESH_MARGIN_SECONDS, is refreshed
before the call. The server rotates refresh tokens, so the new one is written
back to the credential file at once.

Refreshing happens under a lock. After taking it, the credential file is read
again: when another process already stored a fresh token, that one is used and
the old refresh token is not spent a second time.

A refresh the server refuses does not delete the stored tokens: the refusal could
come from a request fault, and a login replaces them anyway.
"""
from __future__ import annotations

from board_cli import credential_lock, credentials, oauth_client
from board_cli.cli_errors import LoginRequired
from board_cli.token_claims import has_expired, read_claims

# A call can take TIMEOUT_SECONDS (20) and the clocks of two machines differ a little.
REFRESH_MARGIN_SECONDS = 60
# The holder spends at most two requests under the lock, each up to 20 seconds.
LOCK_WAIT_SECONDS = 90

NOT_LOGGED_IN = "not logged in; run login first"
REFUSED = "the login is no longer valid; run login again"
INCOMPLETE = "the stored login cannot be refreshed; run login again"


def read_stored() -> dict:
    """The stored credentials. No file, or no token in it, means a login is needed."""
    stored = credentials.read_credentials()
    if not stored or not (stored.get(credentials.ACCESS_TOKEN) or stored.get(credentials.REFRESH_TOKEN)):
        raise LoginRequired(NOT_LOGGED_IN)
    return stored


def is_fresh(token: str) -> bool:
    """A token that is there and does not end within the margin."""
    return bool(token) and not has_expired(read_claims(token), REFRESH_MARGIN_SECONDS)


def refresh(stored: dict) -> str:
    """Exchange the stored refresh token, store the result, and return the new access token."""
    refresh_token = stored.get(credentials.REFRESH_TOKEN)
    client_id = stored.get(credentials.CLIENT_ID)
    if not refresh_token or not client_id:
        raise LoginRequired(INCOMPLETE)
    metadata = oauth_client.fetch_metadata()
    try:
        tokens = oauth_client.refresh_tokens(metadata, client_id, refresh_token)
    except oauth_client.RefreshRejected:
        raise LoginRequired(REFUSED) from None
    new_refresh = tokens.get("refresh_token")
    credentials.update_credentials({
        credentials.ACCESS_TOKEN: tokens["access_token"],
        # The reply may leave the refresh token as it was; then the old one stays valid.
        credentials.REFRESH_TOKEN: new_refresh if isinstance(new_refresh, str) and new_refresh else refresh_token,
    })
    return tokens["access_token"]


def get_access_token(rejected: str | None = None) -> str:
    """An access token to call the API with.

    rejected is the token the server just answered 401 for. It is not used again,
    and a refresh is forced unless another process has already replaced it.
    Raises LoginRequired when there is no login, or the refresh is refused.
    """
    access = read_stored().get(credentials.ACCESS_TOKEN, "")
    if rejected is None and is_fresh(access):
        return access
    with credential_lock.hold_lock(LOCK_WAIT_SECONDS):
        stored = read_stored()
        access = stored.get(credentials.ACCESS_TOKEN, "")
        if access != rejected and is_fresh(access):
            return access
        return refresh(stored)
