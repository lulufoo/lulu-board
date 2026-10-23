"""Document persist helpers: strip leftover envelope; identity lives beside the file."""
from __future__ import annotations

import json
from pathlib import Path

from document_meta import leftover_envelope, strip_leading_meta_lines
from drawer_ctl import util


def _sidecar_path(path: Path) -> Path:
    return path.with_suffix(".json")


def _read_sidecar(path: Path) -> dict:
    side = _sidecar_path(path)
    try:
        data = json.loads(side.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, OSError, json.JSONDecodeError, TypeError, ValueError):
        return {}


def _write_sidecar(path: Path, meta: dict) -> None:
    _sidecar_path(path).write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def _sidecar_live(path: Path) -> dict:
    data = _read_sidecar(path)
    out: dict = {}
    sid = str(data.get("id") or "").strip()
    if sid:
        out["id"] = sid
    ver = data.get("version", data.get("rev"))
    try:
        n = int(ver)
    except (TypeError, ValueError):
        n = 0
    if n > 0:
        out["version"] = n
    return out


def envelope_live_fields(path: Path, kind: str) -> dict:
    """Identity from sidecar; leftover envelope is fallback only."""
    live = _sidecar_live(path)
    leftover: dict = {}
    try:
        leftover = leftover_envelope(path.read_text(encoding="utf-8"), kind) or {}
    except OSError:
        leftover = {}
    out: dict = {}
    if live.get("id"):
        out["id"] = live["id"]
    elif leftover.get("id"):
        out["id"] = leftover["id"]
    if live.get("version"):
        out["version"] = live["version"]
    elif leftover.get("version"):
        out["version"] = leftover["version"]
    return out


def persist_document(rec: Path, text: str, kind: str, expected_id: str | None = None) -> dict:
    """Write stripped body. Bump version on the sidecar. Never require an envelope."""
    body = strip_leading_meta_lines(text)
    if body and not body.endswith("\n"):
        body += "\n"
    live = envelope_live_fields(rec, kind)
    want = str(expected_id or "").strip() or str(live.get("id") or "").strip()
    if not want:
        want = util.new_board_id()
    have = str(live.get("id") or "").strip()
    if expected_id and have and have != str(expected_id).strip():
        raise RuntimeError("document id mismatch")
    nxt = {"id": want, "version": int(live.get("version") or 1) + 1}
    util.write_text_atomic(rec, body)
    side = _read_sidecar(rec)
    side["id"] = nxt["id"]
    side["version"] = nxt["version"]
    _write_sidecar(rec, side)
    return nxt


def stale_document_text(path: Path | None, kind: str, base_rev: int | None) -> str | None:
    if base_rev is None or path is None or not path.is_file():
        return None
    live = envelope_live_fields(path, kind)
    ver = live.get("version")
    if ver is None:
        return None
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return None
    if int(ver) != int(base_rev):
        return raw
    return None
