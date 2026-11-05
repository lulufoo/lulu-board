"""assets: keep the Boxes vocabulary and icon table in a local cache.

Each run compares the md5 of the local copies with the live manifest. A copy
that is missing or differs is downloaded and checked. board_control.py
documents the contract.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
import urllib.request
from pathlib import Path

from board_cli.core.cli_output import emit
from board_cli.core.version import VERSION

DEFAULT_BASE_URL = "https://luluboard.app/skill-assets"
BASE_URL_ENV = "BOARD_ASSETS_BASE_URL"  # tests and staging replace the address
TIMEOUT = 5
KNOWN_FILES = ("vocab.md", "icons.json")
# Cloudflare answers 403 to the default Python-urllib agent.
USER_AGENT = f"board-cli/{VERSION} (assets)"


def locate_assets_dir() -> Path:
    """~/.cache/board/assets. Read the home at call time, so a test can move it."""
    return Path.home() / ".cache" / "board" / "assets"


def read_base_url() -> str:
    return (os.environ.get(BASE_URL_ENV) or DEFAULT_BASE_URL).rstrip("/")


def hash_bytes(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def hash_file(path: Path) -> str | None:
    """The md5 of the file, or None when it cannot be read."""
    try:
        return hash_bytes(path.read_bytes())
    except OSError:
        return None


def fetch_bytes(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.read()


def is_safe_name(name: str) -> bool:
    """A plain file name: no directory part and no leading dot."""
    return bool(name) and name == Path(name).name and not name.startswith(".")


def write_atomically(dest: Path, data: bytes) -> None:
    fd, temp = tempfile.mkstemp(dir=dest.parent, prefix=f".{dest.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
        os.replace(temp, dest)
    except BaseException:
        Path(temp).unlink(missing_ok=True)
        raise


def read_manifest(base: str) -> dict:
    """The manifest's files object. Raises when it is unreachable or malformed."""
    files = json.loads(fetch_bytes(f"{base}/manifest.json").decode("utf-8"))["files"]
    if not isinstance(files, dict):
        raise ValueError("files is not an object")
    return files


def report_offline(root: Path, reason: Exception) -> dict:
    """Use the local copies as they are. Fails when there are none."""
    cached = {name: root / name for name in KNOWN_FILES if (root / name).is_file()}
    if not cached:
        raise RuntimeError(f"assets: manifest unreachable ({reason}) and no local cache in {root}")
    files = {name: {"path": str(path), "status": "offline"} for name, path in cached.items()}
    return {"ok": True, "online": False, "dir": str(root), "files": files}


def update_file(root: Path, name: str, base: str, want: str) -> dict:
    """Make root/name match the manifest md5. Fails when the download cannot."""
    dest = root / name
    if hash_file(dest) == want:
        return {"path": str(dest), "status": "fresh"}
    dest.unlink(missing_ok=True)  # a copy that differs counts as no copy
    try:
        data = fetch_bytes(f"{base}/{name}")
    except Exception as err:
        raise RuntimeError(f"assets: {name}: download failed: {err}") from err
    if hash_bytes(data) != want:
        raise RuntimeError(f"assets: {name}: downloaded md5 mismatch")
    write_atomically(dest, data)
    return {"path": str(dest), "status": "updated"}


def sync_assets() -> dict:
    root = locate_assets_dir()
    root.mkdir(parents=True, exist_ok=True)
    base = read_base_url()
    try:
        manifest = read_manifest(base)
    except Exception as err:  # offline, timeout, bad JSON
        return report_offline(root, err)
    files = {}
    for name, entry in sorted(manifest.items()):
        if is_safe_name(name):
            want = str((entry or {}).get("md5") or "").lower()
            files[name] = update_file(root, name, base, want)
    return {"ok": True, "online": True, "dir": str(root), "files": files}


def run_assets(args: argparse.Namespace) -> None:
    emit(sync_assets())


def register_commands(sub: "argparse._SubParsersAction") -> None:
    assets = sub.add_parser("assets", help="sync the Boxes vocabulary and icon table to the local cache")
    assets.set_defaults(run=run_assets)
