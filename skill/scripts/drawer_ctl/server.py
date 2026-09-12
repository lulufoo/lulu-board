"""Local server process and HTTP API."""
from __future__ import annotations

import fcntl
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import URLError
from urllib.parse import quote
from urllib.request import ProxyHandler, build_opener, urlopen

from drawer_ctl import paths
from drawer_ctl import util
from drawer_ctl import mermaid
from drawer_ctl import board
from drawer_ctl import document
from drawer_ctl.migrate import migrate_document_envelopes

def read_server():
    try:
        data = json.loads(paths.server_path().read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def pid_alive(pid) -> bool:
    if not isinstance(pid, int) or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        return False


def write_server(pid: int, port: int) -> None:
    payload = {
        "pid": pid,
        "port": port,
        "root": str(paths.STATE_DIR),
        "kind": "draw-serve-v2",
        "url": f"http://127.0.0.1:{port}/{paths.VIEWER_FILE}",
    }
    temp = paths.server_path().with_suffix(".json.tmp")
    temp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    temp.replace(paths.server_path())


def _cmdline(pid: int) -> str:
    try:
        return subprocess.check_output(
            ["ps", "-p", str(pid), "-o", "command="],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return ""


def is_drawer_serve_pid(pid: int) -> bool:
    """True if pid looks like this skill's `drawer_control.py _serve`."""
    if not pid_alive(pid):
        return False
    cmd = _cmdline(pid)
    return "drawer_control.py" in cmd and "_serve" in cmd


def list_drawer_serve_pids() -> list[int]:
    """All live drawer `_serve` PIDs on this machine (not only server.json)."""
    try:
        out = subprocess.check_output(
            ["pgrep", "-f", "drawer_control.py _serve"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.CalledProcessError):
        return []
    pids: list[int] = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            pid = int(line)
        except ValueError:
            continue
        if is_drawer_serve_pid(pid):
            pids.append(pid)
    return pids


def _pids_listening_on_port(port: int) -> list[int]:
    try:
        out = subprocess.check_output(
            ["lsof", "-nP", f"-iTCP:{int(port)}", "-sTCP:LISTEN", "-t"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.CalledProcessError):
        return []
    pids: list[int] = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            pids.append(int(line))
        except ValueError:
            continue
    return pids


def serve_pid_on_port(port: int) -> int | None:
    """Our `_serve` listening on port, if any."""
    for pid in _pids_listening_on_port(port):
        if is_drawer_serve_pid(pid):
            return pid
    return None


def port_busy_by_foreign(port: int) -> bool:
    """True when something other than our drawer serve holds the port."""
    pids = _pids_listening_on_port(port)
    if not pids:
        return False
    return not any(is_drawer_serve_pid(pid) for pid in pids)


def _kill_pid(pid: int) -> None:
    if not pid_alive(pid):
        return
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    deadline = time.monotonic() + 2
    while pid_alive(pid) and time.monotonic() < deadline:
        time.sleep(0.05)
    if pid_alive(pid):
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def stop_other_serves(keep_pid: int | None = None) -> None:
    """Kill every drawer `_serve` except keep_pid (orphan sweep)."""
    for pid in list_drawer_serve_pids():
        if keep_pid is not None and pid == keep_pid:
            continue
        _kill_pid(pid)


def stop_server() -> None:
    """Stop all drawer `_serve` processes and clear server.json."""
    stop_other_serves(keep_pid=None)
    info = read_server()
    if info and pid_alive(info.get("pid")):
        _kill_pid(int(info["pid"]))
    try:
        paths.server_path().unlink()
    except FileNotFoundError:
        pass


def mount_lock_path() -> Path:
    return paths.STATE_DIR / "mount.lock"


def server_ready(url: str, process: subprocess.Popen) -> bool:
    deadline = time.monotonic() + 4
    opener = build_opener(ProxyHandler({}))
    while time.monotonic() < deadline:
        if process.poll() is not None:
            return False
        try:
            with opener.open(url, timeout=0.4) as response:
                return response.status == 200
        except (OSError, URLError):
            time.sleep(0.08)
    return False


def with_mount_lock(fn):
    """Serialize mount/stop so parallel callers cannot orphan serves."""
    paths.STATE_DIR.mkdir(parents=True, exist_ok=True)
    lock = mount_lock_path()
    with open(lock, "a+", encoding="utf-8") as fh:
        fcntl.flock(fh.fileno(), fcntl.LOCK_EX)
        try:
            return fn()
        finally:
            fcntl.flock(fh.fileno(), fcntl.LOCK_UN)

def sync_assets() -> None:
    paths.STATE_DIR.mkdir(parents=True, exist_ok=True)
    if not paths.asset_path().is_file():
        raise RuntimeError(f"viewer asset missing: {paths.asset_path()}")
    shutil.copyfile(paths.asset_path(), paths.STATE_DIR / paths.VIEWER_FILE)
    for name in ("favicon.svg", "favicon-32.png", "favicon.ico"):
        src = paths.asset_path().parent / name
        if not src.is_file():
            raise RuntimeError(f"viewer asset missing: {src}")
        shutil.copyfile(src, paths.STATE_DIR / name)
    vendor_dir = paths.asset_path().parent / "vendor"
    vendor_dest = paths.STATE_DIR / "vendor"
    vendor_dest.mkdir(parents=True, exist_ok=True)
    for name in ("mermaid.min.js", "layout-elk.min.js", "board.min.js", "mermaid-themes.min.js", "flowchart.min.js", "mindmap.min.js", "state.min.js", "drawer-app.css", "drawer-app.js", "drawer-app-early-head.js", "drawer-app-early-hydrate.js", "drawer-app-mermaid-alias.js"):
        src = vendor_dir / name
        if not src.is_file():
            raise RuntimeError(f"viewer vendor missing: {src}")
        shutil.copyfile(src, vendor_dest / name)
    legacy = vendor_dest / "board-html"
    if legacy.exists():
        shutil.rmtree(legacy)


def run_serve(port: int) -> int:
    import http.server

    root = paths.STATE_DIR.resolve()
    root.mkdir(parents=True, exist_ok=True)
    board.seed_default_board_if_empty()
    mermaid.seed_default_mermaid_if_empty()
    migrate_document_envelopes()

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        def log_message(self, fmt: str, *log_args) -> None:
            return

        def end_headers(self) -> None:
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def _cors(self) -> None:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header(
                "Access-Control-Allow-Methods", "GET,PUT,DELETE,OPTIONS"
            )
            self.send_header(
                "Access-Control-Allow-Headers",
                "Content-Type, X-Diagram-Rev, X-Diagram-Via, X-Diagram-Archive, X-Diagram-Id, X-Diagram-Title, X-Diagram-Label, X-Diagram-History-File, X-Board-Rev, X-Board-Via, X-Board-Label, X-Board-Archive, X-Board-Id, X-Board-Title, X-Board-History-File, X-Export-Stem",
            )
            self.send_header(
                "Access-Control-Expose-Headers", "X-Diagram-Rev, X-Diagram-Via, X-Board-Rev, X-Board-Via, X-Board-Label"
            )
            self.send_header("Cache-Control", "no-store")

        def _send_json(self, code: int, payload: dict) -> None:
            raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self._cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            meta = payload.get("rev")
            if meta is not None:
                self.send_header("X-Diagram-Rev", str(meta))
            via = payload.get("via")
            if via:
                self.send_header("X-Diagram-Via", str(via))
            self.end_headers()
            self.wfile.write(raw)

        def handle_one_request(self) -> None:
            # CPython leaves do_* exceptions uncaught → empty TCP close (browser ERR_EMPTY_RESPONSE).
            try:
                super().handle_one_request()
            except BrokenPipeError:
                self.close_connection = True
            except ConnectionResetError:
                self.close_connection = True
            except Exception as exc:  # noqa: BLE001
                try:
                    sys.stderr.write(f"[drawer] {getattr(self, 'command', '?')} {getattr(self, 'path', '?')}: {exc}\n")
                    traceback.print_exc()
                except Exception:
                    pass
                try:
                    if not self.wfile.closed:
                        self._send_json(500, {"ok": False, "error": "internal", "detail": str(exc)})
                except Exception:
                    self.close_connection = True

        def do_OPTIONS(self) -> None:  # noqa: N802
            self.send_response(204)
            self._cors()
            self.end_headers()

        def do_GET(self) -> None:  # noqa: N802
            path = self.path.split("?", 1)[0]
            if path in ("/history.json", "/api/history"):
                self._send_json(200, {"ok": True, "items": mermaid.list_mermaid_history()})
                return
            if path in ("/board-history.json", "/api/board-history"):
                self._send_json(200, {"ok": True, "items": board.list_board_history()})
                return
            if path in ("/board.meta.json", "/api/board-meta"):
                # Poll path: read only. Pointer migrate runs on mount/_serve start.
                self._send_json(200, board.public_board_meta(board.read_board_meta()))
                return
            if path in ("/board.bmd", "/board.dsl", "/api/board"):
                text = board.read_board_source_text().encode("utf-8")
                meta = board.read_board_meta()
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(text)))
                self.send_header("X-Board-Rev", str(meta["rev"]))
                self.send_header("X-Board-Via", str(meta["via"]))
                self.end_headers()
                self.wfile.write(text)
                return
            if path in ("/diagram.meta.json", "/api/meta"):
                self._send_json(200, mermaid.public_diagram_meta(mermaid.read_meta()))
                return
            if path in ("/diagram.mmd", "/api/source"):
                text = mermaid.read_source_text().encode("utf-8")
                meta = mermaid.read_meta()
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(text)))
                self.send_header("X-Diagram-Rev", str(meta["rev"]))
                self.send_header("X-Diagram-Via", str(meta["via"]))
                self.end_headers()
                self.wfile.write(text)
                return
            super().do_GET()

        def do_PUT(self) -> None:  # noqa: N802
            path = self.path.split("?", 1)[0]
            if path in ("/export.svg", "/api/export-svg"):
                length = int(self.headers.get("Content-Length", "0") or 0)
                if length <= 0 or length > 4_000_000:
                    self.send_error(400, "invalid body length")
                    return
                body = self.rfile.read(length)
                try:
                    text = body.decode("utf-8")
                except UnicodeDecodeError:
                    self.send_error(400, "body must be utf-8")
                    return
                if "<svg" not in text.lower():
                    self.send_error(400, "body must be svg")
                    return
                dest = mermaid.write_export_svg(text, self.headers.get("X-Export-Stem"))
                self._send_json(200, {"ok": True, "path": str(dest)})
                return
            if path in ("/board.bmd", "/board.dsl", "/api/board"):
                length = int(self.headers.get("Content-Length", "0") or 0)
                if length < 0 or length > 2_000_000:
                    self.send_error(400, "invalid body length")
                    return
                body = self.rfile.read(length)
                try:
                    text = body.decode("utf-8")
                except UnicodeDecodeError:
                    self.send_error(400, "body must be utf-8")
                    return
                via = self.headers.get("X-Board-Via") or "ui"
                label = util.decode_header_value(self.headers.get("X-Board-Label")) or None
                board_id = self.headers.get("X-Board-Id") or None
                board_title = util.decode_header_value(self.headers.get("X-Board-Title")) or None
                history_file = self.headers.get("X-Board-History-File") or None
                if not text.strip() and not (via == "history" and history_file):
                    self.send_error(400, "board source must not be empty")
                    return
                arch_hdr = self.headers.get("X-Board-Archive")
                if arch_hdr is None or str(arch_hdr).strip() == "":
                    do_archive = via not in ("ui", "history")
                else:
                    do_archive = str(arch_hdr).strip().lower() not in ("0", "false", "no", "off")
                base_raw = self.headers.get("X-Board-Rev")
                base_rev = None
                if base_raw not in (None, ""):
                    try:
                        base_rev = int(base_raw)
                    except ValueError:
                        self.send_error(400, "X-Board-Rev must be int")
                        return
                meta, conflict_text = board.commit_board_source(
                    text,
                    via=via,
                    base_rev=base_rev,
                    label=label,
                    board_id=board_id,
                    title=board_title,
                    history_file=history_file,
                    archive=do_archive,
                )
                if conflict_text is not None:
                    self._send_json(409, {"ok": False, "error": "board_rev_conflict", "rev": meta["rev"], "version": meta.get("version", meta["rev"]), "via": meta["via"], "source": conflict_text})
                    return
                self.send_response(204)
                self._cors()
                self.send_header("X-Board-Rev", str(meta["rev"]))
                self.send_header("X-Board-Via", str(meta["via"]))
                self.end_headers()
                return
            if path not in ("/diagram.mmd", "/api/source"):
                self.send_error(404, "only diagram.mmd or board.bmd is writable")
                return
            length = int(self.headers.get("Content-Length", "0") or 0)
            if length < 0 or length > 2_000_000:
                self.send_error(400, "invalid body length")
                return
            body = self.rfile.read(length)
            try:
                text = body.decode("utf-8")
            except UnicodeDecodeError:
                self.send_error(400, "body must be utf-8")
                return

            via = self.headers.get("X-Diagram-Via") or "ui"
            base_raw = self.headers.get("X-Diagram-Rev")
            base_rev = None
            if base_raw not in (None, ""):
                try:
                    base_rev = int(base_raw)
                except ValueError:
                    self.send_error(400, "X-Diagram-Rev must be int")
                    return
            # Archive policy:
            # - UI keystrokes (via=ui): live only, no history flood (mindmap/etc).
            # - CLI preview/set-source: snapshot by default.
            # - Explicit X-Diagram-Archive overrides.
            arch_hdr = self.headers.get("X-Diagram-Archive")
            if arch_hdr is None or str(arch_hdr).strip() == "":
                do_archive = via not in ("ui", "history")
            else:
                do_archive = str(arch_hdr).strip().lower() not in ("0", "false", "no", "off")
            label = util.decode_header_value(self.headers.get("X-Diagram-Label")) or None
            diagram_id = self.headers.get("X-Diagram-Id") or None
            title = util.decode_header_value(self.headers.get("X-Diagram-Title")) or None
            history_file = self.headers.get("X-Diagram-History-File") or None

            meta, conflict_text = mermaid.commit_source(
                text,
                via=via,
                base_rev=base_rev,
                label=label,
                archive=do_archive,
                diagram_id=diagram_id,
                title=title,
                history_file=history_file,
            )
            if conflict_text is not None:
                self._send_json(
                    409,
                    {
                        "ok": False,
                        "error": "rev_conflict",
                        "rev": meta["rev"],
                        "version": meta.get("version", meta["rev"]),
                        "via": meta["via"],
                        "source": conflict_text,
                    },
                )
                return

            self.send_response(204)
            self._cors()
            self.send_header("X-Diagram-Rev", str(meta["rev"]))
            self.send_header("X-Diagram-Via", str(meta["via"]))
            self.end_headers()

        def do_DELETE(self) -> None:  # noqa: N802
            path = self.path.split("?", 1)[0]
            # Board: /api/board-history/<name.bmd>
            for p in ("/api/board-history/", "/board-history/"):
                if path.startswith(p):
                    name = path[len(p):]
                    if not name or "/" in name or ".." in name:
                        self.send_error(400, "invalid history name")
                        return
                    if not board.delete_board_history(name):
                        self.send_error(404, "history entry not found")
                        return
                    raw = Path(name).name
                    if not raw.endswith(".bmd"):
                        raw = f"{raw}.bmd"
                    self._send_json(200, {"ok": True, "deleted": raw})
                    return
            # Mermaid: /api/history/<name.mmd> or /history/<name.mmd>
            prefix = None
            for p in ("/api/history/", "/history/"):
                if path.startswith(p):
                    prefix = p
                    break
            if prefix is None:
                self.send_error(404, "only /api/history/<file> or /api/board-history/<file> is deletable")
                return
            name = path[len(prefix):]
            if not name or "/" in name or ".." in name:
                self.send_error(400, "invalid history name")
                return
            if not mermaid.delete_mermaid_history(name):
                self.send_error(404, "history entry not found")
                return
            self._send_json(200, {"ok": True, "deleted": Path(name).name if name.endswith(".mmd") else f"{Path(name).name}.mmd"})

    class DrawerHTTPServer(http.server.ThreadingHTTPServer):
        # Default backlog is 5; PNG export + meta polls overflow it → empty/RST.
        request_queue_size = 128

    httpd = DrawerHTTPServer(("127.0.0.1", port), Handler)
    httpd.serve_forever()
    return 0



