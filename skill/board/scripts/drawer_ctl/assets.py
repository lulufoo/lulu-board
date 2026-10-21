"""Sync vocab/icons from the web: md5 of local cache vs the live manifest, every run.

Output (stdout, one JSON object):
  {"ok": true, "online": bool, "dir": "<cache dir>",
   "files": {"<name>": {"path": "<local path>", "status": "<status>"}}}

status:
  fresh    local md5 matches the manifest; no download
  updated  missing or mismatched locally (mismatch is deleted first); downloaded and verified
  offline  manifest unreachable; using the existing local copy as is

Exit 1 (no JSON) when a file cannot be obtained: download fails or its md5 does not
match the manifest, or offline with no local cache.
"""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
import urllib.request
from pathlib import Path

from drawer_ctl import paths

DEFAULT_BASE_URL = "https://preview.luluvela.app/skill-assets"
BASE_URL_ENV = "BOARD_ASSETS_BASE_URL"  # tests / staging override
TIMEOUT = 5
KNOWN_FILES = ("vocab.md", "icons.json")
# Cloudflare answers 403 to the default Python-urllib agent
USER_AGENT = "lulu-board-skill/1 (drawer_control assets)"


def assets_dir() -> Path:
    return paths.STATE_DIR / "assets"


def base_url() -> str:
    return (os.environ.get(BASE_URL_ENV) or DEFAULT_BASE_URL).rstrip("/")


def md5_bytes(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def md5_file(path: Path) -> str | None:
    try:
        return md5_bytes(path.read_bytes())
    except OSError:
        return None


def _fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read()


def _safe_name(name: str) -> bool:
    return bool(name) and name == Path(name).name and not name.startswith(".")


def _atomic_write(dest: Path, data: bytes) -> None:
    fd, tmp = tempfile.mkstemp(dir=dest.parent, prefix=f".{dest.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        os.replace(tmp, dest)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def sync_assets() -> dict:
    """Return {"ok", "online", "dir", "files": {name: {"path", "status"}}}.

    Status meanings: see the module docstring.
    Raises RuntimeError when a file has no usable copy.
    """
    root = assets_dir()
    root.mkdir(parents=True, exist_ok=True)
    base = base_url()
    try:
        manifest = json.loads(_fetch(f"{base}/manifest.json").decode("utf-8"))
        files = manifest["files"]
        if not isinstance(files, dict):
            raise ValueError("files is not an object")
    except Exception as exc:  # offline, timeout, bad JSON
        cached = {n: root / n for n in KNOWN_FILES if (root / n).is_file()}
        if not cached:
            raise RuntimeError(f"assets: manifest unreachable ({exc}) and no local cache in {root}")
        return {
            "ok": True,
            "online": False,
            "dir": str(root),
            "files": {n: {"path": str(p), "status": "offline"} for n, p in cached.items()},
        }

    out: dict = {}
    for name, entry in sorted(files.items()):
        if not _safe_name(name):
            continue
        want = str((entry or {}).get("md5") or "").lower()
        dest = root / name
        if md5_file(dest) == want:
            out[name] = {"path": str(dest), "status": "fresh"}
            continue
        dest.unlink(missing_ok=True)  # mismatched cache counts as no cache
        try:
            data = _fetch(f"{base}/{name}")
        except Exception as exc:
            data, err = None, f"download failed: {exc}"
        else:
            err = None if md5_bytes(data) == want else "downloaded md5 mismatch"
        if err is None:
            _atomic_write(dest, data)
            out[name] = {"path": str(dest), "status": "updated"}
        else:
            raise RuntimeError(f"assets: {name}: {err}")
    return {"ok": True, "online": True, "dir": str(root), "files": out}
