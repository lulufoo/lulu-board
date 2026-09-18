"""User-facing commands: status/preview/set/get."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

from document_meta import strip_leading_meta_lines
from drawer_ctl import paths
from drawer_ctl import board
from drawer_ctl import hash_url
from drawer_ctl import titles


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


def _preview_board_text(body: str | None) -> tuple[str, dict, str]:
    """Encode a temp file or stdin. Does not write history/."""
    if body is None:
        return "", {"id": "", "title": "", "version": 0}, "current"
    text = strip_leading_meta_lines(body)
    if not str(text).strip():
        raise RuntimeError("board source must not be empty")
    return text, {
        "id": "",
        "title": titles.derive_board_title(text),
        "version": 1,
    }, "created"


def preview(path, should_open: bool = True, open_mode: str | None = None, kind: str = "board", source_id: str | None = None) -> None:
    """Encode Board source to the public hash URL. Does not write history/."""
    if open_mode is None:
        open_mode = "ide" if should_open else "none"
    if kind and kind != "board":
        raise RuntimeError("invalid --kind (expected board)")
    body = resolve_board_preview_body(path)
    text, fields, open_kind = _preview_board_text(body)
    web = hash_url.board_web_url(text, version=fields["version"]) if str(text).strip() else f"{hash_url.PUBLIC_WEB_ORIGIN}/"
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
    raise RuntimeError("set-source is retired; use preview")


def get_source(kind: str = "board", source_id: str | None = None) -> None:
    raise RuntimeError("get-source is retired; use preview")
