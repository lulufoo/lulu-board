"""Board HTTP handler for the local viewer."""
from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path

from drawer_ctl import paths
from drawer_ctl import util
from drawer_ctl import export as export_mod
from drawer_ctl import board
from drawer_ctl import server
from drawer_ctl.migrate import migrate_document_envelopes


def run_serve(port: int) -> int:
    import http.server

    root = paths.STATE_DIR.resolve()
    root.mkdir(parents=True, exist_ok=True)
    board.seed_default_board_if_empty()
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
            self.send_header("Access-Control-Allow-Methods", "GET,PUT,DELETE,OPTIONS")
            self.send_header(
                "Access-Control-Allow-Headers",
                "Content-Type, X-Board-Rev, X-Board-Via, X-Board-Label, X-Board-Archive, X-Board-Id, X-Board-Title, X-Board-History-File, X-Export-Stem",
            )
            self.send_header("Access-Control-Expose-Headers", "X-Board-Rev, X-Board-Via, X-Board-Label")
            self.send_header("Cache-Control", "no-store")

        def _send_json(self, code: int, payload: dict) -> None:
            raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self._cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def handle_one_request(self) -> None:
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
            if path in ("/board-history.json", "/api/board-history"):
                self._send_json(200, {"ok": True, "items": board.list_board_history()})
                return
            if path in ("/board.meta.json", "/api/board-meta"):
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
                dest = export_mod.write_export_svg(text, self.headers.get("X-Export-Stem"))
                self._send_json(200, {"ok": True, "path": str(dest)})
                return
            if path in ("/export.png", "/api/export-png"):
                length = int(self.headers.get("Content-Length", "0") or 0)
                if length <= len(server.PNG_SIGNATURE) or length > server.MAX_EXPORT_PNG_BYTES:
                    self.send_error(400, "invalid body length")
                    return
                body = self.rfile.read(length)
                if not server.is_valid_png_export(body):
                    self.send_error(400, "body must be png")
                    return
                dest = export_mod.write_export_png(body, self.headers.get("X-Export-Stem"))
                self._send_json(200, {"ok": True, "path": str(dest)})
                return
            if path not in ("/board.bmd", "/board.dsl", "/api/board"):
                self.send_error(404, "only board.bmd is writable")
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
                self._send_json(
                    409,
                    {
                        "ok": False,
                        "error": "board_rev_conflict",
                        "rev": meta["rev"],
                        "version": meta.get("version", meta["rev"]),
                        "via": meta["via"],
                        "source": conflict_text,
                    },
                )
                return
            self.send_response(204)
            self._cors()
            self.send_header("X-Board-Rev", str(meta["rev"]))
            self.send_header("X-Board-Via", str(meta["via"]))
            self.end_headers()

        def do_DELETE(self) -> None:  # noqa: N802
            path = self.path.split("?", 1)[0]
            for prefix in ("/api/board-history/", "/board-history/"):
                if path.startswith(prefix):
                    name = path[len(prefix):]
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
            self.send_error(404, "only /api/board-history/<file> is deletable")

    class DrawerHTTPServer(http.server.ThreadingHTTPServer):
        request_queue_size = 128

    httpd = DrawerHTTPServer(("127.0.0.1", port), Handler)
    httpd.serve_forever()
    return 0
