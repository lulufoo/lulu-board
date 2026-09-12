"""Document envelope: first non-empty line is `meta <base64>`.

Mermaid writes `%% meta …` so official preview treats it as a comment.
Board stays `meta …`. Both forms are accepted on read. Legacy `meta {…}`
JSON is accepted on read; write is always a single base64 token.
"""
from __future__ import annotations

import base64
import json
import re

META_LINE = re.compile(r"^(?:%%\s*)?meta\s+(\S+|{.*})\s*$")
STASH_STYLE_LINE = re.compile(r"^(?:%%\s*)?style\s+(\S+)\s*$", re.IGNORECASE)
ID_RE = {
    "board": re.compile(r"^b_[0-9a-f]{8}$"),
    "mermaid": re.compile(r"^m_[0-9a-f]{8}$"),
}


class DocumentMetaError(ValueError):
    """Hard-cut: document has no valid meta envelope."""


def encode_meta_payload(meta: dict) -> str:
    payload = {"id": str(meta["id"]), "version": int(meta["version"])}
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.b64encode(raw).decode("ascii")


def decode_meta_payload(token: str) -> dict:
    text = str(token or "").strip()
    if not text:
        raise DocumentMetaError("document meta required")
    try:
        if text.startswith("{"):
            data = json.loads(text)
        else:
            compact = re.sub(r"\s+", "", text)
            data = json.loads(base64.b64decode(compact, validate=True).decode("utf-8"))
    except (json.JSONDecodeError, ValueError, UnicodeDecodeError) as exc:
        raise DocumentMetaError("document meta required") from exc
    if not isinstance(data, dict):
        raise DocumentMetaError("document meta required")
    return data


def _comment_envelope(meta: dict, kind: str | None) -> bool:
    if kind == "board":
        return False
    if kind == "mermaid":
        return True
    return str(meta.get("id") or "").startswith("m_")


def _normalize_mermaid_style(body: str) -> str:
    lines = str(body or "").split("\n")
    idx = 0
    while idx < len(lines) and not lines[idx].strip():
        idx += 1
    if idx < len(lines):
        hit = STASH_STYLE_LINE.match(lines[idx].strip())
        if hit:
            lines[idx] = "%% style " + hit.group(1)
    return "\n".join(lines)


def join_document(meta: dict, body: str, kind: str | None = None) -> str:
    payload = {"id": str(meta["id"]), "version": int(meta["version"])}
    comment = _comment_envelope(meta, kind)
    prefix = "%% " if comment else ""
    line = prefix + "meta " + encode_meta_payload(payload)
    rest = str(body or "")
    if comment:
        rest = _normalize_mermaid_style(rest)
    if rest.startswith("\n"):
        return line + rest
    if rest:
        return line + "\n" + rest
    return line + "\n"


def split_document(text: str, kind: str | None = None) -> tuple[dict, str]:
    raw = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = raw.split("\n")
    idx = 0
    while idx < len(lines) and not lines[idx].strip():
        idx += 1
    found: list[dict] = []
    while idx < len(lines):
        hit = META_LINE.match(lines[idx].strip())
        if not hit:
            break
        try:
            found.append(validate_meta(decode_meta_payload(hit.group(1)), kind))
        except DocumentMetaError:
            pass
        idx += 1
        while idx < len(lines) and not lines[idx].strip():
            idx += 1
    if not found:
        raise DocumentMetaError("document meta required")
    meta = found[0]
    for cand in found[1:]:
        if cand["version"] > meta["version"]:
            meta = cand
    return meta, "\n".join(lines[idx:])


def validate_meta(data: dict, kind: str | None = None) -> dict:
    doc_id = str(data.get("id") or "").strip()
    version = data.get("version")
    if isinstance(version, bool) or not isinstance(version, int) or version < 1:
        raise DocumentMetaError("document meta required")
    expect = None
    if kind in ID_RE:
        expect = ID_RE[kind]
    elif doc_id.startswith("b_"):
        expect = ID_RE["board"]
    elif doc_id.startswith("m_"):
        expect = ID_RE["mermaid"]
    if expect is None or not expect.match(doc_id):
        raise DocumentMetaError("document meta required")
    return {"id": doc_id, "version": int(version)}


def has_envelope(text: str, kind: str | None = None) -> bool:
    try:
        split_document(text, kind)
        return True
    except DocumentMetaError:
        return False


def mint_envelope(text: str, kind: str, doc_id: str) -> tuple[str, dict]:
    """Inject envelope when minting. Existing valid meta is kept."""
    if has_envelope(text, kind):
        meta, body = split_document(text, kind)
        return join_document(meta, body, kind), meta
    expect = ID_RE[kind]
    sid = str(doc_id or "").strip()
    if not expect.match(sid):
        raise DocumentMetaError("document meta required")
    meta = {"id": sid, "version": 1}
    return join_document(meta, text, kind), meta


def strip_leading_meta_lines(text: str) -> str:
    """Drop leading envelope lines, including invalid legacy JSON."""
    raw = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = raw.split("\n")
    idx = 0
    while idx < len(lines) and not lines[idx].strip():
        idx += 1
    while idx < len(lines) and META_LINE.match(lines[idx].strip()):
        idx += 1
        while idx < len(lines) and not lines[idx].strip():
            idx += 1
    return "\n".join(lines[idx:])


def rewrite_envelope(text: str, kind: str | None = None) -> tuple[str, bool]:
    """Rewrite a valid envelope to the canonical token form. No version bump."""
    raw = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    if not has_envelope(raw, kind):
        return raw, False
    meta, body = split_document(raw, kind)
    out = join_document(meta, body, kind)
    return out, out != raw


def correct_missing(text: str, kind: str, doc_id: str) -> tuple[str, bool]:
    """One-shot correction: prepend version 1. No-op when envelope is already valid."""
    if has_envelope(text, kind):
        return text if text.endswith("\n") or not text else text, False
    stripped = strip_leading_meta_lines(text)
    out, _ = mint_envelope(stripped, kind, doc_id)
    return out, True


def correct_envelope(text: str, kind: str, doc_id: str) -> tuple[str, bool]:
    """Canonicalize if valid; otherwise strip leftover meta lines and mint."""
    out, changed = rewrite_envelope(text, kind)
    if has_envelope(out, kind):
        return out, changed
    return correct_missing(text, kind, doc_id)


def bump_document(text: str, kind: str, expected_id: str | None = None) -> tuple[str, dict]:
    meta, body = split_document(text, kind)
    if expected_id and meta["id"] != expected_id:
        raise DocumentMetaError("document id mismatch")
    nxt = {"id": meta["id"], "version": int(meta["version"]) + 1}
    return join_document(nxt, body, kind), nxt
