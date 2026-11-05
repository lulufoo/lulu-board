"""board_control.py: assets, the md5 check against the manifest, the download, and the offline fallback."""
from __future__ import annotations

import hashlib
import json
import os
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

from board_cli_support import HomeCase, run_cli
from board_cli.source import assets_commands

VOCAB = b"# vocab v2\n"
ICONS = b'{"icons": []}\n'
UNREACHABLE = "http://127.0.0.1:9/skill-assets"  # the discard port: connection refused


def md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


class FakeAssetsServer:
    """Serves /skill-assets/manifest.json and the files it lists. Records the names asked for."""

    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}
        self.manifest_override: dict | None = None
        self.hits: list[str] = []
        self.agents: list[str] = []
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                name = self.path.rsplit("/", 1)[-1]
                outer.hits.append(name)
                outer.agents.append(self.headers.get("User-Agent", ""))
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

            def log_message(self, *args) -> None:
                pass

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}/skill-assets"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def close(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()


class AssetsCase(HomeCase):
    def setUp(self) -> None:
        super().setUp()
        self.server = FakeAssetsServer()
        self.addCleanup(self.server.close)
        self.server.files = {"vocab.md": VOCAB, "icons.json": ICONS}
        # no_proxy: the fake server is local, so a system proxy must not get in the way
        patcher = patch.dict(os.environ, {"no_proxy": "127.0.0.1,localhost", assets_commands.BASE_URL_ENV: self.server.url})
        patcher.start()
        self.addCleanup(patcher.stop)
        self.cache = self.home / ".cache" / "board" / "assets"

    def run_assets(self) -> tuple[int, dict | None, str]:
        code, out, err = run_cli("assets")
        return code, (json.loads(out) if out.strip() else None), err

    def seed(self, name: str, data: bytes) -> None:
        self.cache.mkdir(parents=True, exist_ok=True)
        (self.cache / name).write_bytes(data)

    def go_offline(self) -> None:
        os.environ[assets_commands.BASE_URL_ENV] = UNREACHABLE

    def statuses(self, out: dict) -> dict:
        return {name: entry["status"] for name, entry in out["files"].items()}


class SyncTest(AssetsCase):
    def test_a_missing_cache_is_downloaded(self) -> None:
        code, out, err = self.run_assets()
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(self.statuses(out), {"vocab.md": "updated", "icons.json": "updated"})
        self.assertEqual((out["ok"], out["online"], out["dir"]), (True, True, str(self.cache)))
        self.assertEqual(Path(out["files"]["vocab.md"]["path"]).read_bytes(), VOCAB)
        self.assertEqual((self.cache / "icons.json").read_bytes(), ICONS)

    def test_a_matching_copy_is_fresh_and_nothing_is_downloaded(self) -> None:
        self.seed("vocab.md", VOCAB)
        self.seed("icons.json", ICONS)
        code, out, _ = self.run_assets()
        self.assertEqual(code, 0)
        self.assertEqual(set(self.statuses(out).values()), {"fresh"})
        self.assertEqual(self.server.hits, ["manifest.json"])

    def test_a_copy_that_differs_is_downloaded_again(self) -> None:
        self.seed("vocab.md", b"# edited locally\n")
        self.seed("icons.json", ICONS)
        code, out, _ = self.run_assets()
        self.assertEqual(code, 0)
        self.assertEqual(self.statuses(out), {"vocab.md": "updated", "icons.json": "fresh"})
        self.assertEqual((self.cache / "vocab.md").read_bytes(), VOCAB)
        self.assertEqual(self.server.hits.count("vocab.md"), 1)
        self.assertEqual(list(self.cache.glob(".*.tmp")), [])

    def test_a_download_that_fails_the_md5_errors_and_leaves_no_copy(self) -> None:
        self.seed("vocab.md", b"# vocab v1\n")
        self.seed("icons.json", ICONS)
        self.server.manifest_override = {"version": 1, "files": {
            "vocab.md": {"md5": md5(b"something else"), "bytes": 1},
            "icons.json": {"md5": md5(ICONS), "bytes": len(ICONS)},
        }}
        code, out, err = self.run_assets()
        self.assertEqual((code, out), (1, None))
        self.assertIn("vocab.md", err)
        self.assertFalse((self.cache / "vocab.md").exists())
        self.assertEqual(list(self.cache.glob(".*.tmp")), [])

    def test_a_file_the_server_does_not_have_errors(self) -> None:
        self.server.manifest_override = {"version": 1, "files": {"vocab.md": {"md5": md5(VOCAB), "bytes": 1}}}
        self.server.files = {}
        code, out, err = self.run_assets()
        self.assertEqual((code, out), (1, None))
        self.assertIn("download failed", err)

    def test_a_manifest_name_with_a_directory_part_is_skipped(self) -> None:
        self.server.manifest_override = {"version": 1, "files": {
            "../escape.md": {"md5": md5(VOCAB), "bytes": 1},
            ".hidden": {"md5": md5(VOCAB), "bytes": 1},
            "vocab.md": {"md5": md5(VOCAB), "bytes": len(VOCAB)},
        }}
        code, out, _ = self.run_assets()
        self.assertEqual(code, 0)
        self.assertEqual(list(out["files"]), ["vocab.md"])
        self.assertFalse((self.cache.parent / "escape.md").exists())

    def test_the_request_names_the_program_and_not_the_default_agent(self) -> None:
        self.run_assets()
        self.assertTrue(self.server.agents)
        for agent in self.server.agents:
            self.assertRegex(agent, r"^board-cli/\d+\.\d+\.\d+ \(assets\)$")


class OfflineTest(AssetsCase):
    def test_an_unreachable_manifest_uses_the_local_copies(self) -> None:
        self.seed("vocab.md", b"# whatever\n")
        self.seed("icons.json", ICONS)
        self.go_offline()
        code, out, _ = self.run_assets()
        self.assertEqual(code, 0)
        self.assertFalse(out["online"])
        self.assertEqual(self.statuses(out), {"vocab.md": "offline", "icons.json": "offline"})

    def test_an_unreachable_manifest_with_no_copy_errors(self) -> None:
        self.go_offline()
        code, out, err = self.run_assets()
        self.assertEqual((code, out), (1, None))
        self.assertIn("no local cache", err)

    def test_a_manifest_that_is_not_json_counts_as_unreachable(self) -> None:
        self.seed("vocab.md", VOCAB)
        self.server.manifest_override = {"files": ["not", "an", "object"]}
        code, out, _ = self.run_assets()
        self.assertEqual(code, 0)
        self.assertEqual(self.statuses(out), {"vocab.md": "offline"})


if __name__ == "__main__":
    unittest.main()
