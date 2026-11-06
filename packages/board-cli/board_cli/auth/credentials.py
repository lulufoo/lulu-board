"""The local credential file: access token, refresh token, the OAuth client_id, and the token endpoint.

The file is ~/.config/lulu-board/credentials.json, one JSON object. The
directory is 0700 and the file 0600, set in code and not left to the umask. A
write goes to a temporary file in the same directory and then replaces the real
file, so an interrupted write never leaves a half-written credential file.

HOME decides where ~ is; tests point HOME at a temporary directory.
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

ACCESS_TOKEN = "access_token"
REFRESH_TOKEN = "refresh_token"
CLIENT_ID = "client_id"
TOKEN_ENDPOINT = "token_endpoint"
FIELDS = (ACCESS_TOKEN, REFRESH_TOKEN, CLIENT_ID, TOKEN_ENDPOINT)

DIR_MODE = 0o700
FILE_MODE = 0o600
FILE_NAME = "credentials.json"


def locate_config_dir() -> Path:
    """~/.config/lulu-board."""
    return Path.home() / ".config" / "lulu-board"


def locate_credentials() -> Path:
    """The credential file inside the config directory."""
    return locate_config_dir() / FILE_NAME


def read_credentials() -> dict | None:
    """The stored fields, or None when there is no credential file.

    A file that is not a JSON object, or whose known fields are not strings, is
    damaged and raises RuntimeError. Fields this version does not know are kept.
    """
    path = locate_credentials()
    try:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
    except FileNotFoundError:
        return None
    except ValueError:  # bad JSON or bad UTF-8
        raise RuntimeError(describe_damage(path)) from None
    known_ok = all(isinstance(data.get(name, ""), str) for name in FIELDS) if isinstance(data, dict) else False
    if not known_ok:
        raise RuntimeError(describe_damage(path))
    return data


def describe_damage(path: Path) -> str:
    """The one-line error for a credential file that cannot be used."""
    return f"credentials file is damaged: {path}; run login to replace it"


def update_credentials(fields: dict) -> None:
    """Merge fields into the stored credentials and write the file atomically.

    Only the known fields are accepted, each a non-empty string. A damaged
    file holds nothing usable, so it is replaced instead of failing the update.
    """
    for name, value in fields.items():
        if name not in FIELDS or not isinstance(value, str) or not value:
            raise RuntimeError(f"cannot store credential field {name!r}")
    try:
        merged = dict(read_credentials() or {})
    except RuntimeError:
        merged = {}
    merged.update(fields)
    write_atomically(merged)


def ensure_config_dir() -> Path:
    """The config directory, made when missing and set to 0700 in code, not by the umask."""
    directory = locate_config_dir()
    directory.mkdir(parents=True, exist_ok=True, mode=DIR_MODE)
    os.chmod(directory, DIR_MODE)
    return directory


def write_atomically(data: dict) -> None:
    """Write data to a temporary file next to the credential file, then replace it."""
    directory = ensure_config_dir()
    handle, temp_name = tempfile.mkstemp(dir=directory, prefix=".credentials-", suffix=".tmp")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as out:
            os.fchmod(out.fileno(), FILE_MODE)
            json.dump(data, out, indent=2)
            out.write("\n")
            out.flush()
            os.fsync(out.fileno())
        os.replace(temp_name, directory / FILE_NAME)
    except BaseException:
        Path(temp_name).unlink(missing_ok=True)
        raise
