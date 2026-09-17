"""User-facing commands: status/preview/set/get."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

from drawer_ctl import paths
from drawer_ctl import board
from drawer_ctl import hash_url
from drawer_ctl.migrate import migrate_document_envelopes


def open_viewer(url: str, mode: str = "ide") -> str:
    """Open the public hash URL.

    mode:
      - ide: Cursor/VS Code Simple Browser (default; avoids Chrome)
      - system: macOS/default browser
      - none: do not open
    Returns the method used: ide | system | none.
    """
    if mode == "none" or not url:
        return "none"
    if mode == "system":
        subprocess.run(["open", url], check=False)
        return "system"

    encoded = quote(url, safe="")
    # Prefer Cursor, then VS Code Simple Browser deep link.
    for scheme in ("cursor", "vscode"):
        uri = f"{scheme}://vscode.simple-browser/show?url={encoded}"
        try:
            completed = subprocess.run(["open", uri], check=False, capture_output=True)
            if completed.returncode == 0:
                return "ide"
        except OSError:
            continue
    # Do not fall back to Chrome — caller still prints the URL.
    return "none"


def status():
    meta = board.read_board_meta()
    return {
        "ok": True,
        "has_source": paths.board_source_path().is_file(),
        "kind": "board",
        "rev": meta["rev"],
        "via": meta["via"],
        "id": meta.get("id"),
        "title": meta.get("title"),
        "current": meta.get("current") or meta.get("archive"),
        "archive": meta.get("current") or meta.get("archive"),
        "label": meta.get("label"),
        "history_dir": str(paths.history_root()),
        "board_history_dir": str(paths.board_history_dir()),
    }


def resolve_preview_body(path: str | None, stdin=None, kind: str = "board") -> str | None:
    """Source to commit, or None to leave the current pointer.

    --file with empty text still errors. No --file: TTY or blank stdin is no source.
    """
    if path:
        text = Path(path).read_text(encoding="utf-8")
        if not str(text).strip():
            raise RuntimeError("board source must not be empty")
        return text
    stream = sys.stdin if stdin is None else stdin
    if getattr(stream, "isatty", lambda: False)():
        return None
    text = stream.read()
    if not str(text).strip():
        return None
    return text


def resolve_board_preview_body(path: str | None, stdin=None) -> str | None:
    return resolve_preview_body(path, stdin=stdin, kind="board")


def preview(path, should_open: bool = True, open_mode: str | None = None, kind: str = "board", source_id: str | None = None) -> None:
    """Write Board SSOT and emit the public hash URL."""
    if open_mode is None:
        open_mode = "ide" if should_open else "none"
    if kind and kind != "board":
        raise RuntimeError("invalid --kind (expected board)")
    seeded_now = board.seed_default_board_if_empty() is not None
    migrate_document_envelopes()
    payload = {"ok": True, "kind": "board"}
    body = resolve_board_preview_body(path)
    board_id = str(source_id or "").strip() or None
    if body is None:
        if board_id:
            rec = board.find_board_record_by_id(board_id)
            if rec is None:
                raise RuntimeError(f"unknown board id {board_id}")
            meta, _ = board.commit_board_source("", via="history", history_file=rec.name)
            open_kind = "current"
        else:
            meta = board.read_board_meta()
            open_kind = "seeded" if seeded_now else "current"
    else:
        label = Path(path).stem if path else "stdin"
        meta, _ = board.commit_board_source(
            body,
            via="cli",
            base_rev=None,
            label=label,
            archive_current=not board_id,
            board_id=board_id,
        )
        open_kind = "current" if board_id else "created"
    payload["open"] = open_kind
    web = hash_url.board_web_url(board.read_board_source_text())
    payload.update(
        {
            "url": web,
            "web_url": web,
            "rev": meta["rev"],
            "version": meta.get("version", meta["rev"]),
            "via": meta["via"],
            "current": meta.get("current"),
            "archive": meta.get("current"),
            "label": meta.get("label"),
            "id": meta.get("id"),
            "title": meta.get("title"),
        }
    )
    if open_mode != "none":
        open_viewer(web, "system")
    print(json.dumps(payload, ensure_ascii=False))


def set_source(path, kind: str = "board", source_id: str | None = None) -> None:
    src = Path(path) if path else None
    body = src.read_text(encoding="utf-8") if src else sys.stdin.read()
    label = src.stem if src else "stdin"
    if kind and kind != "board":
        raise RuntimeError("invalid --kind (expected board)")
    record_id = str(source_id or "").strip() or None
    if not str(body).strip():
        raise RuntimeError("board source must not be empty")
    meta, _ = board.commit_board_source(
        body,
        via="cli",
        base_rev=None,
        label=label,
        archive_current=not record_id,
        board_id=record_id,
    )
    print(
        json.dumps(
            {
                "ok": True,
                "kind": "board",
                "rev": meta["rev"],
                "version": meta.get("version", meta["rev"]),
                "via": meta["via"],
                "current": meta.get("current"),
                "archive": meta.get("current") or meta.get("archive"),
                "label": meta.get("label"),
                "id": meta.get("id"),
                "title": meta.get("title"),
            },
            ensure_ascii=False,
        )
    )


def get_source(kind: str = "board", source_id: str | None = None) -> None:
    if kind and kind != "board":
        raise RuntimeError("invalid --kind (expected board)")
    record_id = str(source_id or "").strip()
    if not record_id:
        raise RuntimeError("get-source --kind board requires --id")
    sys.stdout.write(board.board_source_text_for_id(record_id))
