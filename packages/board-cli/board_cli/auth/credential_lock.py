"""A lock between board-cli processes, so only one refreshes the tokens at a time.

The server rotates refresh tokens, so two processes that refresh with the same
old token would fight over it. The lock is flock on credentials.lock in the
config directory. The operating system drops it when the holder exits, even if
it was killed, so a crashed process cannot leave it held. flock needs a Unix
system; macOS and Linux have it.
"""
from __future__ import annotations

import contextlib
import os
import time
from typing import Iterator

from board_cli.auth import credentials

LOCK_NAME = "credentials.lock"
POLL_SECONDS = 0.05


@contextlib.contextmanager
def hold_lock(wait_seconds: float) -> Iterator[None]:
    """Hold the lock for the with block. Fail with RuntimeError after wait_seconds."""
    try:
        import fcntl
    except ImportError:
        raise RuntimeError("refreshing the login needs flock, which this system does not have") from None
    path = credentials.ensure_config_dir() / LOCK_NAME
    fd = os.open(path, os.O_RDWR | os.O_CREAT, credentials.FILE_MODE)
    try:
        os.fchmod(fd, credentials.FILE_MODE)
        deadline = time.monotonic() + wait_seconds
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise RuntimeError(
                        f"another board-cli has held {path} for {wait_seconds:g} seconds; run it again"
                    ) from None
                time.sleep(POLL_SECONDS)
        yield
    finally:
        os.close(fd)
