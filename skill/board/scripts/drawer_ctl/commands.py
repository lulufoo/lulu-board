"""User-facing commands: status/preview/set/get."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

from document_meta import has_envelope, mint_envelope, split_document, strip_leading_meta_lines
from drawer_ctl import paths
from drawer_ctl import board
from drawer_ctl import hash_url
from drawer_ctl import titles
from drawer_ctl import util


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


def _preview_board_text(body: str | None, board_id: str | None) -> tuple[str, dict, str]:
    """Build BMD in memory. Does not write history/."""
    if body is None:
        if board_id:
            text = board.board_source_text_for_id(board_id)
            doc, _rest = split_document(text, "board")
            return text, {
                "id": doc["id"],
                "title": titles.derive_board_title(text),
                "version": doc["version"],
            }, "current"
        return "", {"id": "", "title": "", "version": 1}, "current"
    if has_envelope(body, "board"):
        meta, _rest = split_document(body, "board")
        if board_id and meta["id"] != board_id:
            text, doc = mint_envelope(strip_leading_meta_lines(body), "board", board_id)
        else:
            text, doc = mint_envelope(body, "board", meta["id"])
    else:
        text, doc = mint_envelope(body, "board", board_id or util.new_board_id())
    return text, {
        "id": doc["id"],
        "title": titles.derive_board_title(text),
        "version": doc["version"],
    }, ("current" if board_id else "created")


def preview(path, should_open: bool = True, open_mode: str | None = None, kind: str = "board", source_id: str | None = None) -> None:
    """Encode Board source to the public hash URL. Does not write history/."""
    if open_mode is None:
        open_mode = "ide" if should_open else "none"
    if kind and kind != "board":
        raise RuntimeError("invalid --kind (expected board)")
    body = resolve_board_preview_body(path)
    board_id = str(source_id or "").strip() or None
    text, fields, open_kind = _preview_board_text(body, board_id)
    web = hash_url.board_web_url(text) if str(text).strip() else f"{hash_url.PUBLIC_WEB_ORIGIN}/"
    payload = {
        "ok": True,
        "kind": "board",
        "open": open_kind,
        "url": web,
        "web_url": web,
        "id": fields["id"],
        "title": fields["title"],
        "version": fields["version"],
        "rev": fields["version"],
    }
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
