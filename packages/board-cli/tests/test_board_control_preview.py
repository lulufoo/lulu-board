"""board_control.py: preview-diagram."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from board_cli_support import PACKAGE_ROOT, TempDirCase, run_cli
from board_cli.source import preview_commands
from board_cli.source import sketch_schema as schema

HTML = '<div class="d">你好</div>\n'
STUB = "https://luluboard.app/#p:p_" + "d" * 64
BOXES = 'boxes "T"\nbox a\n'
MERMAID = "flowchart LR\n  A --> B\n"


class PreviewCase(TempDirCase):
    def preview(self, name: str, text: str):
        """Preview a file with the short-link call replaced. Return result and the call."""
        path = self.put(name, text)
        with patch.object(preview_commands, "create_short_url", return_value=STUB) as create:
            return run_cli("preview-diagram", "--file", str(path)), create


class PreviewDiagramTest(PreviewCase):
    def test_each_source_type_goes_up_as_written_and_prints_only_the_url(self) -> None:
        cases = {
            "a.skt": schema.build_source(HTML, "T", "tok"),
            "a.bmd": BOXES,
            "a.mmd": MERMAID,
            "b.SKT": schema.build_source(HTML, "T"),
        }
        for name, text in cases.items():
            (code, out, err), create = self.preview(name, text)
            self.assertEqual((code, json.loads(out), err), (0, {"url": STUB}, ""), name)
            create.assert_called_once_with(text)

    def test_line_endings_are_not_changed(self) -> None:
        text = 'boxes "T"\r\nbox a\r\n'
        (code, _, _), create = self.preview("crlf.bmd", text)
        self.assertEqual(code, 0)
        create.assert_called_once_with(text)

    def test_an_encode_source_file_previews(self) -> None:
        html = self.put("demo.html", HTML)
        _, encoded, _ = run_cli("encode-source", "--file", str(html), "--out", str(self.dir / "out"), "--title", "T")
        skt = json.loads(encoded)["file"]
        with patch.object(preview_commands, "create_short_url", return_value=STUB) as create:
            code, out, _ = run_cli("preview-diagram", "--file", skt)
        self.assertEqual((code, json.loads(out)), (0, {"url": STUB}))
        self.assertEqual(schema.parse_source(create.call_args.args[0])["html"], HTML)

    def test_any_other_extension_is_refused_and_nothing_is_sent(self) -> None:
        for name in ("a.html", "a.txt", "a.md", "a.json", "noext"):
            (code, out, err), create = self.preview(name, BOXES)
            self.assertEqual((code, out), (1, ""), name)
            self.assertIn("preview-diagram takes", err)
            create.assert_not_called()

    def test_a_html_file_is_pointed_to_encode_source(self) -> None:
        (_, _, err), _ = self.preview("a.html", HTML)
        self.assertIn("encode-source", err)

    def test_a_missing_or_empty_file_is_refused(self) -> None:
        with patch.object(preview_commands, "create_short_url", return_value=STUB) as create:
            code, out, err = run_cli("preview-diagram", "--file", str(self.dir / "none.skt"))
            self.assertEqual((code, out), (1, ""))
            self.assertIn("not found", err)
            for name in ("e.skt", "e.bmd", "e.mmd"):
                code, out, _ = run_cli("preview-diagram", "--file", str(self.put(name, "  \n")))
                self.assertEqual((code, out), (1, ""), name)
        create.assert_not_called()

    def test_a_damaged_skt_never_becomes_a_link(self) -> None:
        (code, out, err), create = self.preview("bad.skt", 'sketch "x"\ncontent @@@\n')
        self.assertEqual((code, out), (1, ""))
        self.assertIn("damaged", err)
        create.assert_not_called()

    def test_a_skt_holding_another_type_is_refused(self) -> None:
        for text in (BOXES, MERMAID, HTML):
            (code, out, _), create = self.preview("other.skt", text)
            self.assertEqual((code, out), (1, ""))
            create.assert_not_called()

    def test_bmd_and_mmd_are_not_checked_against_their_content(self) -> None:
        for name, text in (("a.mmd", BOXES), ("a.bmd", MERMAID)):
            (code, out, _), create = self.preview(name, text)
            self.assertEqual((code, json.loads(out)), (0, {"url": STUB}), name)
            create.assert_called_once_with(text)

    def test_the_output_has_no_kind(self) -> None:
        (_, out, _), _ = self.preview("a.bmd", BOXES)
        self.assertEqual(set(json.loads(out)), {"url"})

    def test_a_failed_publish_prints_nothing(self) -> None:
        path = self.put("a.bmd", BOXES)
        with patch.object(preview_commands, "create_short_url", side_effect=RuntimeError("short link create failed")):
            code, out, err = run_cli("preview-diagram", "--file", str(path))
        self.assertEqual((code, out), (1, ""))
        self.assertIn("short link create failed", err)

    def test_a_missing_file_option_is_a_usage_error(self) -> None:
        code, out, _ = run_cli("preview-diagram")
        self.assertEqual((code, out), (2, ""))


class ProcessTest(PreviewCase):
    def run_script(self, *argv: str, stub: bool = True) -> subprocess.CompletedProcess:
        env = dict(os.environ)
        env.pop("LULU_BOARD_SHORT_LINK_STUB", None)
        if stub:
            env["LULU_BOARD_SHORT_LINK_STUB"] = STUB
        command = [sys.executable, "-m", "board_cli", *argv]
        return subprocess.run(command, capture_output=True, text=True, env=env, cwd=PACKAGE_ROOT)

    def test_a_run_prints_one_json_line_and_exits_0(self) -> None:
        path = self.put("a.bmd", BOXES)
        done = self.run_script("preview-diagram", "--file", str(path))
        self.assertEqual(done.returncode, 0)
        self.assertEqual(json.loads(done.stdout), {"url": STUB})

    def test_a_refused_file_exits_1_with_empty_stdout(self) -> None:
        path = self.put("a.html", HTML)
        failed = self.run_script("preview-diagram", "--file", str(path))
        self.assertEqual((failed.returncode, failed.stdout), (1, ""))
        self.assertTrue(failed.stderr.strip())

    def test_help_carries_the_contract(self) -> None:
        helped = self.run_script("--help")
        for word in ("preview-diagram", ".skt (Sketch)", ".bmd (Boxes)", ".mmd (Mermaid)", "No login"):
            self.assertIn(word, helped.stdout)


if __name__ == "__main__":
    unittest.main()
