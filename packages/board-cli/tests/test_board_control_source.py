"""board_control.py: encode-source and decode-source."""
from __future__ import annotations

import json
import re
import subprocess
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from board_cli_support import PACKAGE_ROOT, TempDirCase, run_cli
from board_cli import sketch_schema as schema
from board_cli import source_commands

HTML = '<style>.d{color:red}</style><div class="d">你好 "world"</div>\n'
NAME = re.compile(r"^\d{8}-\d{6}-\d{3}\.(skt|html)$")
MOMENT = datetime(2026, 11, 5, 18, 22, 1, 123456)


class SourceCase(TempDirCase):
    def setUp(self) -> None:
        super().setUp()
        self.out = self.dir / "out"

    def encode(self, *extra: str) -> tuple[int, str, str]:
        html = self.put("demo.html", HTML)
        return run_cli("encode-source", "--file", str(html), "--out", str(self.out), *extra)

    def fixed_clock(self):
        return patch.object(source_commands, "read_clock", return_value=MOMENT)


class EncodeSourceTest(SourceCase):
    def test_creates_a_skt_file_and_prints_title_style_file(self) -> None:
        code, out, err = self.encode("--title", "T", "--style", "tok")
        payload = json.loads(out)
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(set(payload), {"title", "style", "file"})
        self.assertEqual((payload["title"], payload["style"]), ("T", "tok"))
        written = Path(payload["file"])
        self.assertEqual(written.parent, self.out)
        self.assertRegex(written.name, NAME)
        self.assertEqual(written.suffix, ".skt")
        self.assertEqual(
            schema.parse_source(written.read_text(encoding="utf-8")),
            {"title": "T", "style": "tok", "html": HTML},
        )

    def test_the_file_name_is_the_local_time_to_the_millisecond(self) -> None:
        with self.fixed_clock():
            _, out, _ = self.encode("--title", "T")
        self.assertEqual(Path(json.loads(out)["file"]).name, "20261105-182201-123.skt")

    def test_a_blank_style_is_the_same_as_none(self) -> None:
        with self.fixed_clock():
            _, plain, _ = self.encode("--title", "T")
        text = Path(json.loads(plain)["file"]).read_text(encoding="utf-8")
        Path(json.loads(plain)["file"]).unlink()
        with self.fixed_clock():
            _, blank, _ = self.encode("--title", "T", "--style", "")
        self.assertEqual(Path(json.loads(blank)["file"]).read_text(encoding="utf-8"), text)
        self.assertEqual(json.loads(blank)["style"], "")

    def test_the_title_is_cleaned_and_printed_cleaned(self) -> None:
        _, out, _ = self.encode("--title", 'A "b"\nc')
        self.assertEqual(json.loads(out)["title"], "A 'b' c")

    def test_stdout_holds_no_source_text_and_no_kind(self) -> None:
        _, out, _ = self.encode("--title", "T")
        source = Path(json.loads(out)["file"]).read_text(encoding="utf-8")
        content = source.splitlines()[-1].split(" ", 1)[1]
        self.assertNotIn(content, out)
        self.assertNotIn("kind", json.loads(out))

    def test_the_input_is_left_alone(self) -> None:
        html = self.put("demo.html", HTML)
        run_cli("encode-source", "--file", str(html), "--out", str(self.out), "--title", "T")
        self.assertEqual(html.read_text(encoding="utf-8"), HTML)
        self.assertEqual([p.name for p in self.dir.iterdir() if p.is_file()], ["demo.html"])

    def test_a_name_that_exists_fails_and_keeps_the_first_file(self) -> None:
        with self.fixed_clock():
            _, first, _ = self.encode("--title", "T")
            code, out, err = self.encode("--title", "Other")
        written = Path(json.loads(first)["file"])
        self.assertEqual((code, out), (1, ""))
        self.assertIn("already exists", err)
        self.assertEqual(schema.parse_source(written.read_text(encoding="utf-8"))["title"], "T")

    def test_a_skt_input_is_refused(self) -> None:
        skt = self.put("demo.skt", schema.build_source(HTML, "T"))
        code, out, err = run_cli("encode-source", "--file", str(skt), "--out", str(self.out), "--title", "T")
        self.assertEqual((code, out), (1, ""))
        self.assertIn(".html", err)
        self.assertFalse(self.out.exists())

    def test_an_html_file_holding_source_is_refused(self) -> None:
        held = self.put("held.html", schema.build_source(HTML, "T"))
        code, out, err = run_cli("encode-source", "--file", str(held), "--out", str(self.out), "--title", "T")
        self.assertEqual((code, out), (1, ""))
        self.assertIn("--file", err)

    def test_a_missing_input_and_a_blank_title_are_ordinary_errors(self) -> None:
        none = str(self.dir / "none.html")
        for argv in (
            ("--file", none, "--title", "T"),
            ("--file", str(self.put("ok.html", HTML)), "--title", "  "),
        ):
            code, out, err = run_cli("encode-source", "--out", str(self.out), *argv)
            self.assertEqual((code, out), (1, ""))
            self.assertTrue(err.strip())

    def test_a_missing_out_title_or_file_is_a_usage_error(self) -> None:
        html = str(self.put("demo.html", HTML))
        for argv in (
            ("--file", html, "--title", "T"),
            ("--file", html, "--out", str(self.out)),
            ("--out", str(self.out), "--title", "T"),
        ):
            code, out, _ = run_cli("encode-source", *argv)
            self.assertEqual((code, out), (2, ""))


class DecodeSourceTest(SourceCase):
    def decode(self, text: str, name: str = "demo.skt") -> tuple[int, str, str]:
        skt = self.put(name, text)
        return run_cli("decode-source", "--file", str(skt), "--out", str(self.out))

    def test_creates_the_html_byte_for_byte_and_prints_title_style_file(self) -> None:
        crlf = "<div>\r\nx</div>\r\n"
        code, out, err = self.decode(schema.build_source(crlf, "T", "tok"))
        payload = json.loads(out)
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(set(payload), {"title", "style", "file"})
        self.assertEqual((payload["title"], payload["style"]), ("T", "tok"))
        written = Path(payload["file"])
        self.assertEqual(written.parent, self.out)
        self.assertRegex(written.name, NAME)
        self.assertEqual(written.suffix, ".html")
        self.assertEqual(written.read_bytes(), crlf.encode("utf-8"))

    def test_the_file_name_is_the_local_time_to_the_millisecond(self) -> None:
        with self.fixed_clock():
            _, out, _ = self.decode(schema.build_source(HTML, "T"))
        self.assertEqual(Path(json.loads(out)["file"]).name, "20261105-182201-123.html")

    def test_stdout_holds_no_source_text_and_no_kind(self) -> None:
        _, out, _ = self.decode(schema.build_source(HTML, "T"))
        self.assertNotIn("sketch", out)
        self.assertNotIn(HTML.strip(), out)
        self.assertNotIn("kind", json.loads(out))

    def test_the_output_fits_encode_source(self) -> None:
        _, out, _ = self.decode(schema.build_source(HTML, "T", "tok"))
        decoded = json.loads(out)
        code, again, _ = run_cli(
            "encode-source", "--file", decoded["file"], "--out", str(self.dir / "again"),
            "--title", decoded["title"], "--style", decoded["style"],
        )
        parsed = schema.parse_source(Path(json.loads(again)["file"]).read_text(encoding="utf-8"))
        self.assertEqual(code, 0)
        self.assertEqual(parsed, {"title": "T", "style": "tok", "html": HTML})

    def test_a_name_that_exists_fails(self) -> None:
        with self.fixed_clock():
            self.decode(schema.build_source(HTML, "T"))
            code, out, err = self.decode(schema.build_source(HTML, "T"), "second.skt")
        self.assertEqual((code, out), (1, ""))
        self.assertIn("already exists", err)

    def test_an_html_input_is_refused(self) -> None:
        html = self.put("demo.html", HTML)
        code, out, err = run_cli("decode-source", "--file", str(html), "--out", str(self.out))
        self.assertEqual((code, out), (1, ""))
        self.assertIn(".skt", err)

    def test_damaged_and_missing_inputs_fail_with_empty_stdout(self) -> None:
        code, out, err = self.decode('sketch "x"\ncontent @@@\n', "bad.skt")
        self.assertEqual((code, out), (1, ""))
        self.assertIn("damaged", err)
        code, out, _ = run_cli("decode-source", "--file", str(self.dir / "none.skt"), "--out", str(self.out))
        self.assertEqual((code, out), (1, ""))

    def test_a_missing_out_is_a_usage_error(self) -> None:
        skt = self.put("demo.skt", schema.build_source(HTML, "T"))
        code, out, _ = run_cli("decode-source", "--file", str(skt))
        self.assertEqual((code, out), (2, ""))


class ProcessTest(SourceCase):
    def run_script(self, *argv: str) -> subprocess.CompletedProcess:
        command = [sys.executable, "-m", "board_cli", *argv]
        return subprocess.run(command, capture_output=True, text=True, cwd=PACKAGE_ROOT)

    def test_a_run_prints_one_json_line_and_exits_0(self) -> None:
        html = self.put("demo.html", HTML)
        done = self.run_script("encode-source", "--file", str(html), "--out", str(self.out), "--title", "T")
        self.assertEqual(done.returncode, 0)
        self.assertEqual(len(done.stdout.splitlines()), 1)
        self.assertTrue(Path(json.loads(done.stdout)["file"]).is_file())

    def test_usage_errors_exit_2_and_a_failure_exits_1(self) -> None:
        self.assertEqual(self.run_script("encode-source").returncode, 2)
        self.assertEqual(self.run_script().returncode, 2)
        failed = self.run_script("decode-source", "--file", str(self.dir / "none.skt"), "--out", str(self.out))
        self.assertEqual((failed.returncode, failed.stdout), (1, ""))
        self.assertTrue(failed.stderr.strip())

    def test_help_carries_the_contract(self) -> None:
        helped = self.run_script("--help")
        self.assertEqual(helped.returncode, 0)
        for word in ("encode-source", "decode-source", "YYYYMMDD-HHMMSS-mmm", "exit 2"):
            self.assertIn(word, helped.stdout)


if __name__ == "__main__":
    unittest.main()
