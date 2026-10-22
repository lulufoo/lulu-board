#!/usr/bin/env python3
"""Loopback web renderer serves the built viewer and hash-encodes BMD input."""
from __future__ import annotations

import base64
import json
import shutil
import signal
import subprocess
import tempfile
import unittest
import urllib.parse
import urllib.request
import zlib
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "scripts" / "web-render-test.mjs"
NODE = shutil.which("node")


@unittest.skipUnless(NODE, "node is required")
class WebRenderTestServer(unittest.TestCase):
    def test_help_documents_loopback_rendering(self) -> None:
        result = subprocess.run(
            [NODE, str(SCRIPT), "--help"],
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertIn("127.0.0.1", result.stdout)
        self.assertIn("--board <file>", result.stdout)
        self.assertIn("--no-open", result.stdout)

    def test_serves_web_and_encodes_board_in_hash(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "board.bmd"
            source.write_text('board "Local render test"\n', encoding="utf-8")
            proc = subprocess.Popen(
                [NODE, str(SCRIPT), "--board", str(source), "--no-open", "--port", "0"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            try:
                line = proc.stdout.readline().strip() if proc.stdout else ""
                if not line:
                    stderr = proc.stderr.read() if proc.stderr else ""
                    self.fail(f"renderer did not start: {stderr}")
                self.assertTrue(line.startswith("ready http://127.0.0.1:"), line)
                url = line.removeprefix("ready ")
                parsed = urllib.parse.urlparse(url)
                self.assertEqual(parsed.hostname, "127.0.0.1")
                self.assertTrue(parsed.fragment.startswith("z:"))
                token = parsed.fragment.removeprefix("z:")
                decoded = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
                payload = json.loads(zlib.decompress(decoded).decode("utf-8"))
                self.assertEqual(payload, {"bmd": source.read_text(encoding="utf-8"), "version": 1})

                opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
                with opener.open(url, timeout=3) as response:
                    page = response.read().decode("utf-8")
                    self.assertEqual(response.status, 200)
                    self.assertIn("Lulu Board", page)
            finally:
                if proc.poll() is None:
                    proc.send_signal(signal.SIGINT)
                try:
                    proc.communicate(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.communicate(timeout=3)
            self.assertEqual(proc.returncode, 0)


if __name__ == "__main__":
    unittest.main()
