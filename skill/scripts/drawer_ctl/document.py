"""Document envelope persist helpers."""
from __future__ import annotations

from pathlib import Path

from document_meta import DocumentMetaError, has_envelope, join_document, split_document
from drawer_ctl import paths
from drawer_ctl import util

def persist_document(rec: Path, text: str, kind: str, expected_id: str | None = None) -> dict:
    """Require envelope, keep id, bump version, write the file."""
    if not has_envelope(text, kind):
        raise RuntimeError("document meta required")
    incoming, body = split_document(text, kind)
    try:
        old, _ = split_document(rec.read_text(encoding="utf-8"), kind)
    except (OSError, DocumentMetaError) as exc:
        raise RuntimeError("document meta required") from exc
    want = str(expected_id or incoming["id"]).strip()
    if incoming["id"] != want or old["id"] != want:
        raise RuntimeError("document id mismatch")
    nxt = {"id": old["id"], "version": int(old["version"]) + 1}
    util.write_text_atomic(rec, join_document(nxt, body, kind))
    return nxt


def stale_document_text(path: Path | None, kind: str, base_rev: int | None) -> str | None:
    if base_rev is None or path is None or not path.is_file():
        return None
    try:
        raw = path.read_text(encoding="utf-8")
        meta, _ = split_document(raw, kind)
    except (OSError, DocumentMetaError):
        return None
    if int(meta["version"]) != int(base_rev):
        return raw
    return None


def envelope_live_fields(path: Path, kind: str) -> dict:
    try:
        doc, _ = split_document(path.read_text(encoding="utf-8"), kind)
        return {"id": doc["id"], "version": doc["version"]}
    except (OSError, DocumentMetaError):
        return {}


