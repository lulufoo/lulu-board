from __future__ import annotations

import json
import os
import re
import shutil
import time
from datetime import datetime
from pathlib import Path

from document_meta import (
    DocumentMetaError,
    bump_document,
    correct_missing,
    has_envelope,
    join_document,
    mint_envelope,
    split_document,
)
from drawer_ctl import paths
from drawer_ctl import util
from drawer_ctl import titles
from drawer_ctl.document import persist_document, stale_document_text, envelope_live_fields
from drawer_ctl import document

def write_export_file(data: bytes, stem: str | None, suffix: str) -> Path:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = paths.export_dir() / f"{ts}-{util.sanitize_stem(stem)}{suffix}"
    dest.write_bytes(data)
    return dest.resolve()


def write_export_svg(text: str, stem: str | None = None) -> Path:
    return write_export_file(text.encode("utf-8"), stem, ".svg")


def write_export_png(data: bytes, stem: str | None = None) -> Path:
    return write_export_file(data, stem, ".png")


def create_mermaid_record(
    text: str,
    rev: int,
    via: str,
    label: str | None = None,
    diagram_id: str | None = None,
    title: str | None = None,
) -> Path:
    """Create a new history/mermaid record (+ sidecar). Editable SSOT entry."""
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    dtitle = (title or "").strip() or titles.derive_diagram_title(text, label)
    stem = util.sanitize_stem(label or dtitle)
    base = f"{ts}-{stem}"
    dest = paths.history_dir() / f"{base}.mmd"
    n = 1
    while dest.exists():
        dest = paths.history_dir() / f"{base}-{n}.mmd"
        n += 1
    did = diagram_id or util.new_diagram_id()
    text, doc = mint_envelope(text, "mermaid", did)
    did = doc["id"]
    util.write_text_atomic(dest, text)
    payload = {
        "title": dtitle,
        "kind": titles.derive_diagram_kind(text),
        "via": via,
        "label": label or util.sanitize_stem(dtitle),
        "created_at": ts,
    }
    _write_history_sidecar(dest, payload)
    return dest


def archive_snapshot(
    text: str,
    rev: int,
    via: str,
    label: str | None = None,
    diagram_id: str | None = None,
    title: str | None = None,
) -> str:
    """Back-compat: create a Mermaid history record and return its path."""
    return str(create_mermaid_record(text, rev, via, label=label, diagram_id=diagram_id, title=title))



def _read_history_sidecar(mmd: Path) -> dict:
    side = mmd.with_suffix(".json")
    meta: dict = {}
    if side.is_file():
        try:
            data = json.loads(side.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                meta = data
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            meta = {}
    return meta


def _write_history_sidecar(mmd: Path, meta: dict) -> None:
    side = mmd.with_suffix(".json")
    side.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def ensure_history_entry_meta(mmd: Path, meta: dict | None = None) -> dict:
    """Backfill id + title on a history sidecar (and keep label)."""
    meta = dict(meta or _read_history_sidecar(mmd))
    text = util.read_text_capped(mmd)
    stem = mmd.stem
    parts = stem.split("-")
    created = str(meta.get("created_at") or "")
    rev = meta.get("rev")
    label = meta.get("label")
    if not created or rev is None or not label:
        if len(parts) >= 3 and parts[2].startswith("r"):
            if not created:
                created = f"{parts[0]}-{parts[1]}"
            if rev is None:
                try:
                    rev = int(parts[2][1:])
                except ValueError:
                    rev = None
            if not label:
                label = "-".join(parts[3:]) or "diagram"
    title = str(meta.get("title") or "").strip()
    if not title:
        title = titles.derive_diagram_title(text, str(label or "") or None)
    try:
        doc, _ = split_document(text, "mermaid")
        did = doc["id"]
    except DocumentMetaError:
        did = str(meta.get("id") or "").strip()
        if not did:
            did = util.new_diagram_id()
    kind = str(meta.get("kind") or "").strip()
    if not kind:
        kind = titles.derive_diagram_kind(text)
    out = {
        "id": did,
        "title": title,
        "kind": kind,
        "rev": rev,
        "via": meta.get("via") or "",
        "label": label or util.sanitize_stem(title),
        "created_at": created,
    }
    for k, v in meta.items():
        if k not in out and v is not None and k != "live":
            out[k] = v
    if out != meta:
        _write_history_sidecar(mmd, out)
    return out


def _mermaid_history_resolved(path: Path) -> Path | None:
    try:
        real = path.expanduser().resolve()
        real.relative_to(paths.history_dir().resolve())
    except (OSError, ValueError):
        return None
    return real if real.is_file() and real.suffix == ".mmd" else None


def rel_mermaid_current(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(paths.STATE_DIR.resolve()))
    except ValueError:
        return str(path.resolve())


def mermaid_record_path_from_meta(meta: dict | None = None) -> Path | None:
    meta = meta or read_meta_raw()
    raw = str(meta.get("current") or meta.get("archive") or "").strip()
    if not raw:
        return None
    p = Path(raw)
    if not p.is_absolute():
        p = paths.STATE_DIR / p
    return _mermaid_history_resolved(p)


def find_mermaid_record_by_id(diagram_id: str) -> Path | None:
    """Newest matching history/mermaid record for a stable m_… id, or None."""
    want = str(diagram_id or "").strip()
    if not want:
        return None
    hits = []
    for mmd in paths.mermaid_history_records():
        if not mmd.is_file():
            continue
        try:
            meta, _ = split_document(mmd.read_text(encoding="utf-8"), "mermaid")
        except (OSError, DocumentMetaError):
            continue
        if meta["id"] == want:
            hits.append(mmd)
    if not hits:
        return None
    hits.sort(key=lambda p: p.name, reverse=True)
    return hits[0]


def mermaid_source_text_for_id(diagram_id: str) -> str:
    rec = find_mermaid_record_by_id(diagram_id)
    if rec is None:
        raise RuntimeError(f"unknown mermaid id {diagram_id}")
    return rec.read_text(encoding="utf-8")


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


def write_mermaid_record(
    rec: Path,
    text: str,
    via: str,
    current: dict,
    label: str | None = None,
    title: str | None = None,
    diagram_id: str | None = None,
) -> dict:
    """Overwrite one Mermaid history record and point current at it."""
    dtitle = (title or "").strip() or titles.derive_diagram_title(text, label or current.get("label"))
    doc = document.persist_document(rec, text, "mermaid", diagram_id)
    entry = ensure_history_entry_meta(rec)
    entry.pop("id", None)
    entry.pop("rev", None)
    entry["via"] = via or "ui"
    if dtitle:
        entry["title"] = dtitle
    entry["kind"] = titles.derive_diagram_kind(text)
    _write_history_sidecar(rec, entry)
    new_meta = {
        "rev": doc["version"],
        "version": doc["version"],
        "updated_at": int(time.time()),
        "via": via or "ui",
        "id": doc["id"],
        "title": entry.get("title") or dtitle,
        "kind": entry.get("kind") or titles.derive_diagram_kind(text),
        "current": rel_mermaid_current(rec),
        "label": label or entry.get("label") or current.get("label") or util.sanitize_stem(dtitle),
    }
    write_meta(new_meta)
    refresh_diagram_mmd_alias(rec)
    return new_meta


def refresh_diagram_mmd_alias(record: Path | None) -> None:
    """Optional convenience: diagram.mmd → current record. meta.current is protocol SSOT."""
    link = paths.source_path()
    try:
        if link.exists() or link.is_symlink():
            link.unlink()
    except OSError:
        pass
    if record is None:
        return
    try:
        target = os.path.relpath(str(record.resolve()), start=str(link.parent))
    except ValueError:
        target = str(record.resolve())
    try:
        os.symlink(target, link)
    except OSError:
        pass


def read_meta_raw() -> dict:
    """Read diagram.meta.json without migrating/pointer side effects."""
    try:
        data = json.loads(paths.meta_path().read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return default_meta()
        rev = int(data.get("rev", 0))
        out = {
            "rev": max(0, rev),
            "updated_at": data.get("updated_at", 0),
            "via": str(data.get("via") or "unknown"),
        }
        current = data.get("current") or data.get("archive")
        if current:
            out["current"] = str(current)
        if data.get("label"):
            out["label"] = str(data["label"])
        if data.get("id"):
            out["id"] = str(data["id"])
        if data.get("title"):
            out["title"] = str(data["title"])
        if data.get("kind"):
            out["kind"] = str(data["kind"])
        return out
    except (FileNotFoundError, OSError, json.JSONDecodeError, TypeError, ValueError):
        return default_meta()



def mermaid_history_has_records() -> bool:
    return any(paths.mermaid_history_records())


def seed_default_mermaid_if_empty() -> Path | None:
    """If history/mermaid is empty, seed every packed example under assets/templates/mermaid.

    Points current at mermaid-state/checkout when present.
    """
    if mermaid_history_has_records():
        return None
    live = paths.source_path()
    if live.is_file() and not live.is_symlink():
        try:
            if live.read_text(encoding="utf-8").strip():
                return None
        except OSError:
            pass
    sources = paths.mermaid_example_template_sources()
    if not sources:
        return None
    paths.STATE_DIR.mkdir(parents=True, exist_ok=True)
    preferred = (paths.mermaid_example_template_dir() / "checkout.mmd").resolve()
    current_dest: Path | None = None
    current_label = "checkout"
    current_body = ""
    for src in sources:
        body = src.read_text(encoding="utf-8")
        if not body.strip():
            continue
        label = util.sanitize_stem(src.stem) or "mermaid"
        dest = create_mermaid_record(body, rev=1, via="template", label=label)
        if src.resolve() == preferred or current_dest is None:
            current_dest = dest
            current_label = label
            current_body = body
    if current_dest is None:
        return None
    side = ensure_history_entry_meta(current_dest)
    live_fields = envelope_live_fields(current_dest, "mermaid")
    meta = read_meta_raw()
    meta.update(
        {
            "rev": int(live_fields.get("version") or 1),
            "version": int(live_fields.get("version") or 1),
            "updated_at": int(time.time()),
            "via": "template",
            "kind": side.get("kind") or titles.derive_diagram_kind(current_body),
            "current": rel_mermaid_current(current_dest),
            "label": current_label,
            "id": live_fields.get("id") or side.get("id") or util.new_diagram_id(),
            "title": side.get("title") or titles.derive_diagram_title(current_body, current_label),
        }
    )
    meta.pop("archive", None)
    write_meta(meta)
    refresh_diagram_mmd_alias(current_dest)
    return current_dest


def ensure_mermaid_pointer_model(meta: dict | None = None) -> dict:
    """Migrate legacy live diagram.mmd copy → pointer to a history record."""
    __import__("drawer_ctl.migrate", fromlist=["migrate_document_envelopes"]).migrate_document_envelopes()
    cur = dict(meta or read_meta_raw())
    live = paths.source_path()

    # 1) Regular live file wins over stale archive/current.
    if live.is_file() and not live.is_symlink():
        try:
            body = live.read_text(encoding="utf-8")
        except OSError:
            body = ""
        if body.strip():
            rev = max(1, int(cur.get("rev") or 0) or 1)
            did = str(cur.get("id") or "").strip() or util.new_diagram_id()
            dtitle = str(cur.get("title") or "").strip() or titles.derive_diagram_title(body, cur.get("label"))
            dest = create_mermaid_record(
                body,
                rev=rev,
                via=str(cur.get("via") or "migrate"),
                label=cur.get("label") or util.sanitize_stem(dtitle),
                diagram_id=did,
                title=dtitle,
            )
            try:
                live.unlink()
            except OSError:
                pass
            cur.update(
                {
                    "rev": rev,
                    "updated_at": int(time.time()),
                    "via": cur.get("via") or "migrate",
                    "id": did,
                    "title": dtitle,
                    "kind": titles.derive_diagram_kind(body),
                    "current": rel_mermaid_current(dest),
                    "label": cur.get("label") or util.sanitize_stem(dtitle),
                }
            )
            cur.pop("archive", None)
            write_meta(cur)
            refresh_diagram_mmd_alias(dest)
            return cur

    if not str(cur.get("current") or "").strip() and cur.get("archive"):
        cur["current"] = str(cur["archive"])
    cur.pop("archive", None)

    rec = mermaid_record_path_from_meta(cur)
    if rec is not None:
        side = ensure_history_entry_meta(rec)
        changed = False
        rel = rel_mermaid_current(rec)
        if cur.get("current") != rel:
            cur["current"] = rel
            changed = True
        if side.get("id") and cur.get("id") != side.get("id"):
            cur["id"] = side["id"]
            changed = True
        if side.get("title") and not str(cur.get("title") or "").strip():
            cur["title"] = side["title"]
            changed = True
        kind = side.get("kind") or titles.derive_diagram_kind(rec.read_text(encoding="utf-8") if rec.is_file() else "")
        if kind and cur.get("kind") != kind:
            cur["kind"] = kind
            changed = True
        if changed:
            write_meta(cur)
        refresh_diagram_mmd_alias(rec)
        return cur

    refresh_diagram_mmd_alias(None)
    return cur


def list_mermaid_history(limit: int = 80) -> list[dict]:
    """Newest-first Mermaid history records (editable SSOTs)."""
    meta = ensure_mermaid_pointer_model()
    current_name = Path(str(meta.get("current") or "")).name
    items: list[dict] = []
    for mmd in paths.mermaid_history_records():
        text = util.read_text_capped(mmd)
        entry = ensure_history_entry_meta(mmd)
        try:
            size = mmd.stat().st_size
        except OSError:
            size = 0
        try:
            doc, _ = split_document(text, "mermaid")
        except DocumentMetaError:
            doc = {"id": entry.get("id"), "version": None}
        items.append(
            {
                "id": doc.get("id"),
                "title": entry.get("title") or "diagram",
                "kind": entry.get("kind") or "",
                "name": mmd.name,
                "path": str(mmd),
                "version": doc.get("version"),
                "label": entry.get("label") or "diagram",
                "via": entry.get("via") or "",
                "created_at": entry.get("created_at") or "",
                "bytes": size,
                "current": mmd.name == current_name,
            }
        )
        if len(items) >= max(1, int(limit)):
            break
    return items



def delete_mermaid_history(name: str) -> bool:
    """Delete one Mermaid history record (+ sidecar). Retarget if it was current."""
    raw = Path(str(name or "")).name
    if not raw or "/" in str(name) or "\\" in str(name) or ".." in raw:
        return False
    if raw.endswith(".bmd") or raw.endswith(".dsl"):
        return False
    if not raw.endswith(".mmd"):
        raw = f"{raw}.mmd"
    target = paths.history_dir() / raw
    if not target.is_file():
        return False
    side = target.with_suffix(".json")
    meta = ensure_mermaid_pointer_model()
    was_current = Path(str(meta.get("current") or "")).name == raw
    try:
        target.unlink()
    except OSError:
        return False
    if side.is_file():
        try:
            side.unlink()
        except OSError:
            pass
    if was_current:
        rest = list_mermaid_history(limit=1)
        if rest:
            nxt = paths.history_dir() / rest[0]["name"]
            entry = ensure_history_entry_meta(nxt)
            meta["current"] = rel_mermaid_current(nxt)
            meta["id"] = entry.get("id") or meta.get("id")
            meta["title"] = entry.get("title") or meta.get("title")
            meta["kind"] = entry.get("kind") or meta.get("kind")
            meta["via"] = "history"
            meta["updated_at"] = int(time.time())
            meta.pop("archive", None)
            write_meta(meta)
            refresh_diagram_mmd_alias(nxt)
        else:
            meta.pop("current", None)
            meta.pop("archive", None)
            meta["via"] = "history"
            meta["updated_at"] = int(time.time())
            write_meta(meta)
            refresh_diagram_mmd_alias(None)
    return True


def public_diagram_meta(meta: dict | None = None) -> dict:
    """Meta for HTTP: include absolute `path` of the current record (not persisted)."""
    out = dict(meta if meta is not None else read_meta())
    rec = mermaid_record_path_from_meta(out)
    if rec is not None and rec.exists():
        out["path"] = str(rec.resolve())
    elif paths.source_path().exists():
        out["path"] = str(paths.source_path().resolve())
    return out


def default_meta() -> dict:
    return {"rev": 0, "updated_at": 0, "via": "init"}


def write_meta(meta: dict) -> None:
    temp = paths.meta_path().with_suffix(".json.tmp")
    temp.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(paths.meta_path())


def read_meta() -> dict:
    """Public meta read: ensure pointer model, expose current (archive alias for old UI)."""
    cur = ensure_mermaid_pointer_model()
    out = dict(cur)
    if out.get("current") and not out.get("archive"):
        out["archive"] = out["current"]  # back-compat for older clients
    return out


def read_source_text() -> str:
    meta = ensure_mermaid_pointer_model()
    rec = mermaid_record_path_from_meta(meta)
    if rec is not None:
        try:
            return rec.read_text(encoding="utf-8")
        except OSError:
            return ""
    try:
        return paths.source_path().read_text(encoding="utf-8")
    except (FileNotFoundError, OSError):
        return ""


def commit_source(
    text: str,
    via: str,
    base_rev: int | None = None,
    label: str | None = None,
    archive: bool = True,
    diagram_id: str | None = None,
    title: str | None = None,
    history_file: str | None = None,
) -> tuple[dict, str | None]:
    """Mermaid SSOT protocol (same as Board):

    - history/mermaid/*.mmd are editable records.
    - meta.current points at the active record; UI writes through (archive=False).
    - CLI without diagram_id mints a new record and retargets.
    - CLI with diagram_id writes that record in place and retargets.
    - History click (via=history) only retargets meta.current.
    """
    paths.STATE_DIR.mkdir(parents=True, exist_ok=True)
    current = ensure_mermaid_pointer_model()

    # —— Switch pointer ——
    if via == "history" and history_file:
        raw = Path(str(history_file)).name
        if raw.endswith(".bmd") or raw.endswith(".dsl"):
            return current, read_source_text()
        if not raw.endswith(".mmd"):
            raw = f"{raw}.mmd"
        if ".." in raw or "/" in str(history_file) or "\\" in str(history_file):
            return current, read_source_text()
        candidate = paths.history_dir() / raw
        if not candidate.is_file():
            return current, read_source_text()
        entry = ensure_history_entry_meta(candidate)
        body = candidate.read_text(encoding="utf-8")
        live = document.envelope_live_fields(candidate, "mermaid")
        ver = int(live.get("version") or 1)
        new_meta = {
            "rev": ver,
            "version": ver,
            "updated_at": int(time.time()),
            "via": "history",
            "id": live.get("id") or diagram_id or entry.get("id") or util.new_diagram_id(),
            "title": (title or "").strip() or entry.get("title") or "diagram",
            "kind": entry.get("kind") or titles.derive_diagram_kind(body),
            "current": rel_mermaid_current(candidate),
            "label": label or entry.get("label") or util.sanitize_stem(entry.get("title") or "diagram"),
        }
        write_meta(new_meta)
        refresh_diagram_mmd_alias(candidate)
        return new_meta, None

    if diagram_id:
        rec = find_mermaid_record_by_id(diagram_id)
        if rec is None:
            raise RuntimeError(f"unknown mermaid id {diagram_id}")
        if not str(text).strip():
            raise RuntimeError("mermaid source must not be empty")
        stale = document.stale_document_text(rec, "mermaid", base_rev)
        if stale is not None:
            return current, stale
        return write_mermaid_record(
            rec, text, via, current, label=label, title=title, diagram_id=diagram_id
        ), None

    dtitle = (title or "").strip() or titles.derive_diagram_title(text, label or current.get("label"))
    create_new = bool(archive) and via not in ("ui", "history")

    # —— Preview / CLI: new record ——
    if create_new or via == "cli":
        if not str(text).strip():
            return current, read_source_text()
        text, doc = mint_envelope(text, "mermaid", util.new_diagram_id())
        dest = create_mermaid_record(
            text,
            rev=doc["version"],
            via="preview" if via == "cli" else via,
            label=label or util.sanitize_stem(dtitle),
            diagram_id=doc["id"],
            title=dtitle,
        )
        new_meta = {
            "rev": doc["version"],
            "version": doc["version"],
            "updated_at": int(time.time()),
            "via": via,
            "id": doc["id"],
            "title": dtitle,
            "kind": titles.derive_diagram_kind(text),
            "current": rel_mermaid_current(dest),
            "label": label or util.sanitize_stem(dtitle),
        }
        write_meta(new_meta)
        refresh_diagram_mmd_alias(dest)
        return new_meta, None

    # —— UI write-through ——
    rec = mermaid_record_path_from_meta(current)
    if rec is None:
        text, doc = mint_envelope(text, "mermaid", diagram_id or current.get("id") or util.new_diagram_id())
        dest = create_mermaid_record(
            text,
            rev=doc["version"],
            via=via or "ui",
            label=label or current.get("label") or util.sanitize_stem(dtitle),
            diagram_id=doc["id"],
            title=dtitle,
        )
        new_meta = {
            "rev": doc["version"],
            "version": doc["version"],
            "updated_at": int(time.time()),
            "via": via or "ui",
            "id": doc["id"],
            "title": dtitle,
            "kind": titles.derive_diagram_kind(text),
            "current": rel_mermaid_current(dest),
            "label": label or util.sanitize_stem(dtitle),
        }
        write_meta(new_meta)
        refresh_diagram_mmd_alias(dest)
        return new_meta, None

    stale = document.stale_document_text(rec, "mermaid", base_rev)
    if stale is not None:
        return current, stale
    return write_mermaid_record(
        rec, text, via or "ui", current, label=label, title=title, diagram_id=diagram_id
    ), None


