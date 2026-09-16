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

def default_board_meta() -> dict:
    return {"rev": 0, "updated_at": 0, "via": "init", "kind": "board"}


def write_board_meta(meta: dict) -> None:
    temp = paths.board_meta_path().with_suffix(".json.tmp")
    temp.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(paths.board_meta_path())


def read_board_meta() -> dict:
    try:
        data = json.loads(paths.board_meta_path().read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return default_board_meta()
        out = {
            "rev": max(0, int(data.get("rev", 0))),
            "updated_at": data.get("updated_at", 0),
            "via": str(data.get("via") or "unknown"),
        }
        # Pointer to the editable history record (SSOT). Legacy key: archive.
        current = data.get("current") or data.get("archive")
        if current:
            out["current"] = str(current)
        if data.get("label"):
            out["label"] = str(data["label"])
        if data.get("id"):
            out["id"] = str(data["id"])
        if data.get("title"):
            out["title"] = str(data["title"])
        out["kind"] = str(data.get("kind") or "board")
        return out
    except (FileNotFoundError, OSError, json.JSONDecodeError, TypeError, ValueError):
        return default_board_meta()


def _board_history_resolved(path: Path) -> Path | None:
    """Return path if it resolves to a *.bmd file under history/."""
    try:
        real = path.expanduser().resolve()
        real.relative_to(paths.board_history_dir().resolve())
    except (OSError, ValueError):
        return None
    return real if real.is_file() and real.suffix == ".bmd" else None


def rel_board_current(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(paths.STATE_DIR.resolve()))
    except ValueError:
        return str(path.resolve())


def board_record_path_from_meta(meta: dict | None = None) -> Path | None:
    meta = meta or read_board_meta()
    raw = str(meta.get("current") or "").strip()
    if not raw:
        return None
    p = Path(raw)
    if not p.is_absolute():
        p = paths.STATE_DIR / p
    return _board_history_resolved(p)


def public_board_meta(meta: dict | None = None) -> dict:
    """Meta for HTTP: include absolute `path` of the current record (not persisted)."""
    out = dict(meta if meta is not None else read_board_meta())
    rec = board_record_path_from_meta(out)
    if rec is not None and rec.exists():
        out["path"] = str(rec.resolve())
    elif paths.board_source_path().exists():
        out["path"] = str(paths.board_source_path().resolve())
    return out


def refresh_board_dsl_alias(record: Path | None) -> None:
    """Optional convenience: board.bmd → current record. Meta.current is the protocol SSOT."""
    link = paths.board_source_path()
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
        # Alias is best-effort; readers use meta.current.
        pass


def create_board_record(
    text: str,
    rev: int,
    via: str,
    label: str | None = None,
    board_id: str | None = None,
    title: str | None = None,
) -> Path:
    """Create a new history record (+ sidecar). This is the editable SSOT entry."""
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    dtitle = (title or "").strip() or titles.derive_board_title(text, label)
    stem = util.sanitize_stem(label or dtitle or "board")
    base = f"{ts}-{stem}"
    dest = paths.board_history_dir() / f"{base}.bmd"
    n = 1
    while dest.exists():
        dest = paths.board_history_dir() / f"{base}-{n}.bmd"
        n += 1
    did = board_id or util.new_board_id()
    text, doc = mint_envelope(text, "board", did)
    util.write_text_atomic(dest, text)
    payload = {
        "title": dtitle,
        "kind": "board",
        "via": via,
        "label": label or util.sanitize_stem(dtitle),
        "created_at": ts,
    }
    _write_board_history_sidecar(dest, payload)
    return dest


def default_board_template_path() -> Path:
    return paths.default_board_template_path()


def board_history_has_records() -> bool:
    return any(paths.board_history_records())


def _point_board_current(dest: Path, label: str, body: str) -> None:
    side = ensure_board_history_entry_meta(dest)
    live = document.envelope_live_fields(dest, "board")
    meta = read_board_meta()
    meta.update(
        {
            "rev": int(live.get("version") or 1),
            "version": int(live.get("version") or 1),
            "updated_at": int(time.time()),
            "via": "template",
            "kind": "board",
            "current": rel_board_current(dest),
            "label": label,
            "id": live.get("id") or side.get("id") or util.new_board_id(),
            "title": side.get("title") or titles.derive_board_title(body, label),
        }
    )
    meta.pop("archive", None)
    write_board_meta(meta)
    refresh_board_dsl_alias(dest)


def seed_default_board_if_empty() -> Path | None:
    """If history/ is empty, seed every packed example under assets/templates/board.

    Points current at onboarding.bmd when present. AI-only demo.bmd under
    board/templates/ is not seeded.
    """
    __import__("drawer_ctl.migrate", fromlist=["lift_nested_board_history"]).lift_nested_board_history()
    if board_history_has_records():
        return None
    live = paths.board_source_path()
    if live.is_file() and not live.is_symlink():
        try:
            if live.read_text(encoding="utf-8").strip():
                return None
        except OSError:
            pass
    sources = paths.board_example_template_sources()
    if not sources:
        return None
    paths.STATE_DIR.mkdir(parents=True, exist_ok=True)
    preferred = paths.default_board_template_path().resolve()
    current_dest: Path | None = None
    current_label = "onboarding"
    current_body = ""
    for src in sources:
        body = src.read_text(encoding="utf-8")
        if not body.strip():
            continue
        label = util.sanitize_stem(src.stem) or "board"
        dest = create_board_record(body, rev=1, via="template", label=label)
        if src.resolve() == preferred or current_dest is None:
            current_dest = dest
            current_label = label
            current_body = body
    if current_dest is None:
        return None
    _point_board_current(current_dest, current_label, current_body)
    return current_dest


# Back-compat name used by older call sites / docs mental model.
def archive_board_snapshot(
    text: str,
    rev: int,
    via: str,
    label: str | None = None,
    board_id: str | None = None,
    title: str | None = None,
) -> str:
    return str(create_board_record(text, rev, via, label=label, board_id=board_id, title=title))


def _read_board_history_sidecar(dsl: Path) -> dict:
    side = dsl.with_suffix(".json")
    try:
        data = json.loads(side.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, OSError, json.JSONDecodeError, TypeError, ValueError):
        return {}


def _write_board_history_sidecar(dsl: Path, meta: dict) -> None:
    side = dsl.with_suffix(".json")
    side.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def ensure_board_history_entry_meta(dsl: Path, meta: dict | None = None) -> dict:
    """Backfill id + title + kind on a board history sidecar."""
    meta = dict(meta or _read_board_history_sidecar(dsl))
    text = util.read_text_capped(dsl)
    changed = False
    try:
        doc, _ = split_document(text, "board")
        if str(meta.get("id") or "").strip() != doc["id"]:
            meta["id"] = doc["id"]
            changed = True
    except DocumentMetaError:
        if not str(meta.get("id") or "").strip():
            meta["id"] = util.new_board_id()
            changed = True
    title = str(meta.get("title") or "").strip()
    if not title:
        meta["title"] = titles.derive_board_title(text, meta.get("label"))
        changed = True
    if str(meta.get("kind") or "").strip() != "board":
        meta["kind"] = "board"
        changed = True
    if not meta.get("created_at"):
        m = re.match(r"^(\d{8}-\d{6})", dsl.name)
        if m:
            meta["created_at"] = m.group(1)
            changed = True
    if changed:
        _write_board_history_sidecar(dsl, meta)
    return meta


def ensure_board_pointer_model(meta: dict | None = None) -> dict:
    """Migrate legacy live board.dsl copy → pointer to a history record.

    Protocol: meta.current names the editable record under history/.
    board.dsl is only an optional symlink alias.

    If board.dsl is still a regular file with content, that content is the SSOT
    and is promoted into a record (stale meta.current/archive must not win).
    """
    __import__("drawer_ctl.migrate", fromlist=["migrate_document_envelopes"]).migrate_document_envelopes()
    cur = dict(meta or read_board_meta())
    live = paths.board_source_path()

    # 1) Legacy regular live file wins over stale archive/current pointers.
    if live.is_file() and not live.is_symlink():
        try:
            text = live.read_text(encoding="utf-8")
        except OSError:
            text = ""
        if text.strip():
            rev = max(1, int(cur.get("rev") or 0) or 1)
            did = str(cur.get("id") or "").strip() or util.new_board_id()
            dtitle = str(cur.get("title") or "").strip() or titles.derive_board_title(text, cur.get("label"))
            dest = create_board_record(
                text,
                rev=rev,
                via=str(cur.get("via") or "migrate"),
                label=cur.get("label") or util.sanitize_stem(dtitle),
                board_id=did,
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
                    "kind": "board",
                    "current": rel_board_current(dest),
                    "label": cur.get("label") or util.sanitize_stem(dtitle),
                }
            )
            cur.pop("archive", None)
            write_board_meta(cur)
            refresh_board_dsl_alias(dest)
            return cur

    # 2) Existing pointer (current, or legacy archive)
    if not str(cur.get("current") or "").strip() and cur.get("archive"):
        cur["current"] = str(cur["archive"])
    cur.pop("archive", None)

    rec = board_record_path_from_meta(cur)
    if rec is not None:
        side = ensure_board_history_entry_meta(rec)
        changed = False
        rel = rel_board_current(rec)
        if cur.get("current") != rel:
            cur["current"] = rel
            changed = True
        if side.get("id") and cur.get("id") != side.get("id"):
            cur["id"] = side["id"]
            changed = True
        if side.get("title") and not str(cur.get("title") or "").strip():
            cur["title"] = side["title"]
            changed = True
        if str(cur.get("kind") or "") != "board":
            cur["kind"] = "board"
            changed = True
        if changed:
            write_board_meta(cur)
        refresh_board_dsl_alias(rec)
        return cur

    if str(cur.get("kind") or "") != "board":
        cur["kind"] = "board"
        write_board_meta(cur)
    refresh_board_dsl_alias(None)
    return cur


def ensure_board_live_meta(meta: dict | None = None) -> dict:
    return ensure_board_pointer_model(meta)


def read_board_source_text() -> str:
    meta = ensure_board_pointer_model()
    rec = board_record_path_from_meta(meta)
    if rec is not None:
        try:
            return rec.read_text(encoding="utf-8")
        except OSError:
            return ""
    # Fallback: alias or empty
    try:
        return paths.board_source_path().read_text(encoding="utf-8")
    except (FileNotFoundError, OSError):
        return ""


def find_board_record_by_id(board_id: str) -> Path | None:
    """Newest matching history record for a stable b_… id, or None."""
    want = str(board_id or "").strip()
    if not want:
        return None
    hits = []
    for dsl in paths.board_history_records():
        if not dsl.is_file():
            continue
        try:
            meta, _ = split_document(dsl.read_text(encoding="utf-8"), "board")
        except (OSError, DocumentMetaError):
            continue
        if meta["id"] == want:
            hits.append(dsl)
    if not hits:
        return None
    hits.sort(key=lambda p: p.name, reverse=True)
    return hits[0]


def board_source_text_for_id(board_id: str) -> str:
    rec = find_board_record_by_id(board_id)
    if rec is None:
        raise RuntimeError(f"unknown board id {board_id}")
    return rec.read_text(encoding="utf-8")


def write_board_record(
    rec: Path,
    text: str,
    via: str,
    current: dict,
    label: str | None = None,
    title: str | None = None,
    board_id: str | None = None,
) -> dict:
    """Overwrite one history record and point current at it."""
    dtitle = (title or "").strip() or titles.derive_board_title(text, label or current.get("label"))
    doc = document.persist_document(rec, text, "board", board_id)
    entry = ensure_board_history_entry_meta(rec)
    entry.pop("id", None)
    entry.pop("rev", None)
    entry["via"] = via or "ui"
    if dtitle:
        entry["title"] = dtitle
    _write_board_history_sidecar(rec, entry)
    new_meta = {
        "rev": doc["version"],
        "version": doc["version"],
        "updated_at": int(time.time()),
        "via": via or "ui",
        "id": doc["id"],
        "title": entry.get("title") or dtitle,
        "kind": "board",
        "current": rel_board_current(rec),
        "label": label or entry.get("label") or current.get("label") or util.sanitize_stem(dtitle),
    }
    write_board_meta(new_meta)
    refresh_board_dsl_alias(rec)
    return new_meta


def list_board_history(limit: int = 80) -> list[dict]:
    """Newest-first Board history records (editable SSOTs)."""
    meta = ensure_board_pointer_model()
    current_name = Path(str(meta.get("current") or "")).name
    items: list[dict] = []
    for dsl in paths.board_history_records():
        entry = ensure_board_history_entry_meta(dsl)
        try:
            size = dsl.stat().st_size
        except OSError:
            size = 0
        try:
            doc, _ = split_document(util.read_text_capped(dsl), "board")
        except (OSError, DocumentMetaError):
            doc = {"id": entry.get("id"), "version": None}
        items.append(
            {
                "id": doc.get("id"),
                "title": entry.get("title") or "board",
                "kind": "board",
                "name": dsl.name,
                "path": str(dsl),
                "version": doc.get("version"),
                "label": entry.get("label") or "board",
                "via": entry.get("via") or "",
                "created_at": entry.get("created_at") or "",
                "bytes": size,
                "current": dsl.name == current_name,
            }
        )
        if len(items) >= max(1, int(limit)):
            break
    return items


def delete_board_history(name: str) -> bool:
    """Delete one Board history record (+ sidecar). Retarget if it was current."""
    raw = Path(str(name or "")).name
    if not raw or "/" in str(name) or "\\" in str(name) or ".." in raw:
        return False
    target = None
    for cand in paths.board_history_candidates(raw):
        if cand.is_file():
            target = cand
            raw = cand.name
            break
    if target is None:
        return False
    side = target.with_suffix(".json")
    meta = ensure_board_pointer_model()
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
        rest = list_board_history(limit=1)
        if rest:
            nxt = paths.board_history_dir() / rest[0]["name"]
            entry = ensure_board_history_entry_meta(nxt)
            meta["current"] = rel_board_current(nxt)
            meta["id"] = entry.get("id") or meta.get("id")
            meta["title"] = entry.get("title") or meta.get("title")
            meta["via"] = "history"
            meta["updated_at"] = int(time.time())
            write_board_meta(meta)
            refresh_board_dsl_alias(nxt)
        else:
            meta.pop("current", None)
            meta["via"] = "history"
            meta["updated_at"] = int(time.time())
            write_board_meta(meta)
            refresh_board_dsl_alias(None)
    return True


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


def commit_board_source(
    text: str,
    via: str,
    base_rev: int | None = None,
    label: str | None = None,
    archive_current: bool = False,
    board_id: str | None = None,
    title: str | None = None,
    history_file: str | None = None,
    archive: bool = True,
) -> tuple[dict, str | None]:
    """Board SSOT protocol:

    - history/*.bmd are editable records (the list).
    - meta.current points at the active record; UI writes through it (no new record).
    - CLI without board_id mints a new record and retargets.
    - CLI with board_id writes that record in place and retargets.
    - History click (`via=history`) only retargets meta.current.
    """
    paths.STATE_DIR.mkdir(parents=True, exist_ok=True)
    current = ensure_board_pointer_model()

    # —— Switch pointer to an existing record (no content copy) ——
    if via == "history" and history_file:
        raw = Path(str(history_file)).name
        raw = paths.board_history_ext(raw)
        if ".." in raw or "/" in str(history_file) or "\\" in str(history_file):
            return current, read_board_source_text()
        candidate = paths.board_history_dir() / raw
        if not candidate.is_file():
            return current, read_board_source_text()
        entry = ensure_board_history_entry_meta(candidate)
        live = document.envelope_live_fields(candidate, "board")
        ver = int(live.get("version") or 1)
        new_meta = {
            "rev": ver,
            "version": ver,
            "updated_at": int(time.time()),
            "via": "history",
            "id": live.get("id") or board_id or entry.get("id") or util.new_board_id(),
            "title": (title or "").strip() or entry.get("title") or "board",
            "kind": "board",
            "current": rel_board_current(candidate),
            "label": label or entry.get("label") or util.sanitize_stem(entry.get("title") or "board"),
        }
        write_board_meta(new_meta)
        refresh_board_dsl_alias(candidate)
        return new_meta, None

    if board_id:
        rec = find_board_record_by_id(board_id)
        if rec is None:
            raise RuntimeError(f"unknown board id {board_id}")
        if not str(text).strip():
            raise RuntimeError("board source must not be empty")
        stale = document.stale_document_text(rec, "board", base_rev)
        if stale is not None:
            return current, stale
        return write_board_record(
            rec, text, via, current, label=label, title=title, board_id=board_id
        ), None

    dtitle = (title or "").strip() or titles.derive_board_title(text, label or current.get("label"))
    create_new = bool(archive_current) or (via == "cli") or (
        archive and via not in ("ui", "history") and via != "migrate"
    )

    # —— Preview / CLI ingress: mint a new record, point at it ——
    if create_new:
        if not str(text).strip():
            return current, read_board_source_text()
        text, doc = mint_envelope(text, "board", util.new_board_id())
        dest = create_board_record(
            text,
            rev=doc["version"],
            via=via if via != "cli" else "preview",
            label=label or util.sanitize_stem(dtitle),
            board_id=doc["id"],
            title=dtitle,
        )
        new_meta = {
            "rev": doc["version"],
            "version": doc["version"],
            "updated_at": int(time.time()),
            "via": via,
            "id": doc["id"],
            "title": dtitle,
            "kind": "board",
            "current": rel_board_current(dest),
            "label": label or util.sanitize_stem(dtitle),
        }
        write_board_meta(new_meta)
        refresh_board_dsl_alias(dest)
        return new_meta, None

    # —— UI (and other write-through): mutate the current record only ——
    rec = board_record_path_from_meta(current)
    if rec is None:
        text, doc = mint_envelope(text, "board", board_id or current.get("id") or util.new_board_id())
        dest = create_board_record(
            text,
            rev=doc["version"],
            via=via or "ui",
            label=label or current.get("label") or util.sanitize_stem(dtitle),
            board_id=doc["id"],
            title=dtitle,
        )
        new_meta = {
            "rev": doc["version"],
            "version": doc["version"],
            "updated_at": int(time.time()),
            "via": via or "ui",
            "id": doc["id"],
            "title": dtitle,
            "kind": "board",
            "current": rel_board_current(dest),
            "label": label or current.get("label") or util.sanitize_stem(dtitle),
        }
        write_board_meta(new_meta)
        refresh_board_dsl_alias(dest)
        return new_meta, None

    stale = document.stale_document_text(rec, "board", base_rev)
    if stale is not None:
        return current, stale
    return write_board_record(
        rec, text, via or "ui", current, label=label, title=title, board_id=board_id
    ), None


