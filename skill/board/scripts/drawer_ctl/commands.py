"""User-facing commands: mount/status/preview/set/get."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

from drawer_ctl import paths
from drawer_ctl import util
from drawer_ctl import board
from drawer_ctl import server
from drawer_ctl.migrate import migrate_document_envelopes


def open_viewer(url: str, mode: str = "ide") -> str:
    """Open the drawer URL.

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


def mount(port: int, should_open: bool = False, open_mode: str | None = None) -> str:
    """Start or reuse the drawer viewer on the fixed default port (unless --port set)."""

    def _run() -> str:
        server.sync_assets()
        board.seed_default_board_if_empty()
        migrate_document_envelopes()
        mode = open_mode
        if mode is None:
            mode = "ide" if should_open else "none"

        target = util.resolve_port(port)
        url = f"http://127.0.0.1:{target}/{paths.VIEWER_FILE}"

        # Prefer whatever of ours is already listening on the target port.
        live = server.serve_pid_on_port(target)
        if live is None:
            current = server.read_server()
            if (
                current
                and current.get("root") == str(paths.STATE_DIR)
                and current.get("kind") == "draw-serve-v2"
                and int(current.get("port", -1)) == target
                and server.is_drawer_serve_pid(int(current.get("pid") or 0))
            ):
                live = int(current["pid"])

        if live is not None:
            server.stop_other_serves(keep_pid=live)
            server.write_server(live, target)
            open_viewer(url, mode)
            return url

        if server.port_busy_by_foreign(target):
            raise RuntimeError(
                f"port 127.0.0.1:{target} is in use by another process; "
                f"stop it or pass --port <free>"
            )

        # Clean slate: no orphans left behind when we start fresh.
        server.stop_server()

        process = subprocess.Popen(
            [
                sys.executable,
                str(Path(__file__).resolve().parent.parent / "drawer_control.py"),
                server.SERVE_COMMAND,
                "--port",
                str(target),
            ],
            cwd=str(paths.STATE_DIR),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        if not server.server_ready(url, process):
            try:
                process.terminate()
            except OSError:
                pass
            raise RuntimeError(f"could not start viewer on 127.0.0.1:{target}")
        server.stop_other_serves(keep_pid=process.pid)
        server.write_server(process.pid, target)
        open_viewer(url, mode)
        return url

    return server.with_mount_lock(_run)


def status():
    info = server.read_server() or {}
    running = server.pid_alive(info.get("pid"))
    meta = board.read_board_meta()
    return {
        "ok": True,
        "running": running,
        "url": info.get("url") if running else None,
        "pid": info.get("pid") if running else None,
        "port": int(info.get("port") or 0),
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


def viewer_page_url(base: str, kind: str = "board") -> str:
    return f"{base}{'&' if '?' in base else '?'}mode=board"


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


def preview(path, port: int, should_open: bool = True, open_mode: str | None = None, kind: str = "board", source_id: str | None = None) -> None:
    """Mount drawer, write Board SSOT, optionally open the browser."""
    if open_mode is None:
        open_mode = "ide" if should_open else "none"
    if kind and kind != "board":
        raise RuntimeError("invalid --kind (expected board)")
    seeded_now = board.seed_default_board_if_empty() is not None
    url = mount(port, should_open=False, open_mode="none")
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
    view = viewer_page_url(url, "board")
    open_viewer(view, open_mode)
    payload.update(
        {
            "url": view,
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
    print(json.dumps(payload, ensure_ascii=False))


def set_source(path, kind: str = "board", source_id: str | None = None) -> None:
    # Always content: `--file` is read into memory (not mounted as the live path).
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
