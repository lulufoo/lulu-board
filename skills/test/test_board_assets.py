#!/usr/bin/env python3
"""`assets`: md5 of local cache vs live manifest, download, offline fallback."""
from __future__ import annotations

import hashlib
import io
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
from contextlib import redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "boxes" / "scripts"))

import drawer_control as dc
from drawer_ctl import assets
from drawer_ctl import paths as _ctl_paths

VOCAB = b"# vocab v2\n"
ICONS = b'{"icons": []}\n'


def md5(b: bytes) -> str:
    return hashlib.md5(b).hexdigest()


class _Server:
    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}
        self.manifest_override: dict | None = None
        self.hits: list[str] = []
        outer = self

        class H(BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802
                name = self.path.rsplit("/", 1)[-1]
                outer.hits.append(name)
                if name == "manifest.json":
                    body = json.dumps(outer.manifest_override or {
                        "version": 1,
                        "files": {n: {"md5": md5(b), "bytes": len(b)} for n, b in outer.files.items()},
                    }).encode()
                elif name in outer.files:
                    body = outer.files[name]
                else:
                    self.send_response(404)
                    self.end_headers()
                    return
                self.send_response(200)
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *a):
                pass

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}/skill-assets"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def close(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()


class BoardAssetsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp())
        self.prev_state = _ctl_paths.STATE_DIR
        _ctl_paths.STATE_DIR = self.tmp
        self.server = _Server()
        self.server.files = {"vocab.md": VOCAB, "icons.json": ICONS}
        self.prev_env = os.environ.get(assets.BASE_URL_ENV)
        self.prev_no_proxy = os.environ.get("no_proxy")
        os.environ["no_proxy"] = "127.0.0.1,localhost"  # skip any system proxy for the fake server
        os.environ[assets.BASE_URL_ENV] = self.server.url
        self.cache = self.tmp / "assets"

    def tearDown(self) -> None:
        self.server.close()
        _ctl_paths.STATE_DIR = self.prev_state
        if self.prev_env is None:
            os.environ.pop(assets.BASE_URL_ENV, None)
        else:
            os.environ[assets.BASE_URL_ENV] = self.prev_env
        if self.prev_no_proxy is None:
            os.environ.pop("no_proxy", None)
        else:
            os.environ["no_proxy"] = self.prev_no_proxy
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_cli(self) -> tuple[int, dict | None]:
        buf = io.StringIO()
        with redirect_stdout(buf):
            code = dc.main(["assets"])
        out = buf.getvalue().strip()
        return code, (json.loads(out) if out else None)

    def seed(self, name: str, data: bytes) -> None:
        self.cache.mkdir(parents=True, exist_ok=True)
        (self.cache / name).write_bytes(data)

    def go_offline(self) -> None:
        os.environ[assets.BASE_URL_ENV] = "http://127.0.0.1:9/skill-assets"  # discard port, refused

    def test_missing_cache_downloads(self) -> None:
        code, out = self.run_cli()
        self.assertEqual(code, 0)
        self.assertEqual({n: f["status"] for n, f in out["files"].items()}, {"vocab.md": "updated", "icons.json": "updated"})
        self.assertEqual(Path(out["files"]["vocab.md"]["path"]).read_bytes(), VOCAB)
        self.assertEqual((self.cache / "icons.json").read_bytes(), ICONS)

    def test_match_is_fresh_without_download(self) -> None:
        self.seed("vocab.md", VOCAB)
        self.seed("icons.json", ICONS)
        code, out = self.run_cli()
        self.assertEqual(code, 0)
        self.assertTrue(all(f["status"] == "fresh" for f in out["files"].values()))
        self.assertEqual(self.server.hits, ["manifest.json"])

    def test_mismatch_redownloads(self) -> None:
        self.seed("vocab.md", b"# edited locally\n")
        self.seed("icons.json", ICONS)
        code, out = self.run_cli()
        self.assertEqual(code, 0)
        self.assertEqual(out["files"]["vocab.md"]["status"], "updated")
        self.assertEqual(out["files"]["icons.json"]["status"], "fresh")
        self.assertEqual((self.cache / "vocab.md").read_bytes(), VOCAB)
        self.assertEqual(self.server.hits.count("vocab.md"), 1)
        self.assertEqual(list(self.cache.glob(".*.tmp")), [])

    def test_bad_download_errors_and_drops_cache(self) -> None:
        self.seed("vocab.md", b"# vocab v1\n")
        self.seed("icons.json", ICONS)
        self.server.manifest_override = {"version": 1, "files": {
            "vocab.md": {"md5": md5(b"something else"), "bytes": 1},
            "icons.json": {"md5": md5(ICONS), "bytes": len(ICONS)},
        }}
        code, out = self.run_cli()
        self.assertEqual(code, 1)
        self.assertIsNone(out)
        self.assertFalse((self.cache / "vocab.md").exists())
        self.assertEqual(list(self.cache.glob(".*.tmp")), [])

    def test_offline_with_cache(self) -> None:
        self.seed("vocab.md", b"# whatever\n")
        self.seed("icons.json", ICONS)
        self.go_offline()
        code, out = self.run_cli()
        self.assertEqual(code, 0)
        self.assertFalse(out["online"])
        self.assertEqual({n: f["status"] for n, f in out["files"].items()}, {"vocab.md": "offline", "icons.json": "offline"})

    def test_offline_without_cache_errors(self) -> None:
        self.go_offline()
        code, out = self.run_cli()
        self.assertEqual(code, 1)
        self.assertIsNone(out)


if __name__ == "__main__":
    unittest.main()
