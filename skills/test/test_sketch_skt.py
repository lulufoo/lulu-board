#!/usr/bin/env python3
from __future__ import annotations

import base64
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_skills = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_skills / "sketch" / "scripts"))
sys.path.insert(0, str(_skills / "scripts"))

import sketch_control
import sketch_schema as schema

HTML = '<style>.d{color:red}</style><div class="d">你好 "world"</div>\n'
STUB = "https://luluboard.app/#p:p_" + "d" * 64


def run_cli(*argv: str) -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = sketch_control.main(list(argv))
    return code, out.getvalue(), err.getvalue()


def encode_text(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


class TempDirCase(unittest.TestCase):
    def setUp(self) -> None:
        holder = tempfile.TemporaryDirectory()
        self.addCleanup(holder.cleanup)
        self.dir = Path(holder.name).resolve()

    def put(self, name: str, text: str) -> Path:
        path = self.dir / name
        with open(path, "w", encoding="utf-8", newline="") as handle:
            handle.write(text)
        return path


class CleanTitleTest(unittest.TestCase):
    def test_double_quote_becomes_single_quote(self) -> None:
        self.assertEqual(schema.clean_title('A "b"'), "A 'b'")

    def test_line_break_becomes_space_and_ends_are_trimmed(self) -> None:
        self.assertEqual(schema.clean_title("  a\r\nb\n "), "a b")

    def test_blank_title_is_refused(self) -> None:
        for raw in ("", "   ", "\n"):
            with self.assertRaises(schema.SketchError):
                schema.clean_title(raw)

    def test_style_with_a_space_is_refused(self) -> None:
        with self.assertRaises(schema.SketchError):
            schema.clean_style("a b")


class SourceTest(unittest.TestCase):
    def test_build_puts_style_then_title_then_content(self) -> None:
        lines = schema.build_source(HTML, "T", "tok").splitlines()
        self.assertEqual(lines[:2], ["style tok", 'sketch "T"'])
        self.assertTrue(lines[2].startswith("content "))

    def test_build_without_style_has_two_lines(self) -> None:
        lines = schema.build_source(HTML, "T").splitlines()
        self.assertEqual(len(lines), 2)
        self.assertEqual(lines[0], 'sketch "T"')

    def test_parse_reads_back_what_build_wrote(self) -> None:
        parsed = schema.parse_source(schema.build_source(HTML, "标题", "tok"))
        self.assertEqual(parsed, {"title": "标题", "style": "tok", "html": HTML})

    def test_style_is_an_empty_string_when_absent(self) -> None:
        self.assertEqual(schema.parse_source(schema.build_source(HTML, "T"))["style"], "")

    def test_parse_accepts_an_empty_title(self) -> None:
        parsed = schema.parse_source('sketch ""\ncontent ' + encode_text("<div></div>") + "\n")
        self.assertEqual(parsed["title"], "")

    def test_parse_refuses_damaged_content(self) -> None:
        for token in ("@@@", "abc"):
            with self.assertRaises(schema.SketchError):
                schema.parse_source('sketch "x"\ncontent ' + token + "\n")

    def test_parse_refuses_a_source_missing_a_line(self) -> None:
        with self.assertRaises(schema.SketchError):
            schema.parse_source('sketch "x"\n')
        with self.assertRaises(schema.SketchError):
            schema.parse_source("content " + encode_text("<div></div>") + "\n")

    def test_is_sketch_source_tells_source_from_html(self) -> None:
        self.assertTrue(schema.is_sketch_source('sketch "x"\ncontent e30=\n'))
        self.assertTrue(schema.is_sketch_source('\n style e30=\nsketch ""\n'))
        self.assertFalse(schema.is_sketch_source(HTML))
        self.assertFalse(schema.is_sketch_source(""))


class FileTest(TempDirCase):
    def test_encode_writes_the_skt_file_beside_the_html(self) -> None:
        html = self.put("demo.html", HTML)
        out = schema.encode_file(str(html), "T", "tok")
        self.assertEqual(out, self.dir / "demo.skt")
        self.assertEqual(out.read_text(encoding="utf-8"), schema.build_source(HTML, "T", "tok"))

    def test_decode_returns_the_html_byte_for_byte(self) -> None:
        crlf = "<div>\r\nx</div>\r\n"
        skt = self.dir / "sub" / "copy.skt"
        skt.parent.mkdir()
        skt.write_text(schema.build_source(crlf, "T", "tok"), encoding="utf-8")
        result = schema.decode_file(str(skt))
        self.assertEqual(result["html"], str(self.dir / "sub" / "copy.html"))
        self.assertEqual((self.dir / "sub" / "copy.html").read_bytes(), crlf.encode("utf-8"))
        self.assertEqual((result["title"], result["style"]), ("T", "tok"))

    def test_encode_refuses_to_overwrite_its_input(self) -> None:
        html = self.put("same.skt", HTML)
        with self.assertRaises(schema.SketchError):
            schema.encode_file(str(html), "T")
        self.assertEqual(html.read_text(encoding="utf-8"), HTML)

    def test_missing_and_empty_files_are_refused(self) -> None:
        empty = self.put("empty.html", "  \n")
        for path in (self.dir / "none.html", empty):
            with self.assertRaises(schema.SketchError):
                schema.read_html(str(path))

    def test_an_html_file_holding_source_is_refused(self) -> None:
        held = self.put("held.html", schema.build_source(HTML, "T"))
        with self.assertRaises(schema.SketchError):
            schema.read_html(str(held))


class CliTest(TempDirCase):
    def test_preview_prints_the_url_as_json(self) -> None:
        html = self.put("demo.html", HTML)
        with patch.object(sketch_control, "create_short_url", return_value=STUB) as create:
            code, out, err = run_cli("preview", "--html", str(html), "--title", "T")
        self.assertEqual((code, json.loads(out), err), (0, {"url": STUB}, ""))
        self.assertEqual(schema.parse_source(create.call_args.args[0])["html"], HTML)

    def test_preview_uses_the_stub_without_the_network(self) -> None:
        html = self.put("demo.html", HTML)
        with patch.dict(os.environ, {"LULU_BOARD_SHORT_LINK_STUB": STUB}):
            code, out, _ = run_cli("preview", "--html", str(html), "--title", "T")
        self.assertEqual((code, json.loads(out)), (0, {"url": STUB}))

    def test_preview_requires_a_title(self) -> None:
        html = self.put("demo.html", HTML)
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            sketch_control.main(["preview", "--html", str(html)])

    def test_preview_refuses_source_and_prints_nothing(self) -> None:
        held = self.put("held.html", schema.build_source(HTML, "T"))
        code, out, err = run_cli("preview", "--html", str(held), "--title", "T")
        self.assertEqual((code, out), (1, ""))
        self.assertIn("HTML fragment", err)

    def test_encode_prints_the_skt_path_and_keeps_the_style(self) -> None:
        html = self.put("demo.html", HTML)
        code, out, _ = run_cli("encode", "--html", str(html), "--title", "T", "--style", "tok")
        self.assertEqual((code, json.loads(out)), (0, {"skt": str(self.dir / "demo.skt")}))
        self.assertEqual(schema.parse_source((self.dir / "demo.skt").read_text())["style"], "tok")

    def test_a_blank_style_is_the_same_as_none(self) -> None:
        html = self.put("demo.html", HTML)
        run_cli("encode", "--html", str(html), "--title", "T")
        plain = (self.dir / "demo.skt").read_text()
        run_cli("encode", "--html", str(html), "--title", "T", "--style", "")
        self.assertEqual((self.dir / "demo.skt").read_text(), plain)

    def test_decode_prints_title_style_and_html_path(self) -> None:
        skt = self.put("demo.skt", schema.build_source(HTML, "T", "tok"))
        code, out, _ = run_cli("decode", "--skt", str(skt))
        expected = {"title": "T", "style": "tok", "html": str(self.dir / "demo.html")}
        self.assertEqual((code, json.loads(out)), (0, expected))

    def test_decode_of_damaged_content_fails_with_empty_stdout(self) -> None:
        skt = self.put("bad.skt", 'sketch "x"\ncontent @@@\n')
        code, out, err = run_cli("decode", "--skt", str(skt))
        self.assertEqual((code, out), (1, ""))
        self.assertIn("damaged", err)

    def test_the_kind_flag_is_gone(self) -> None:
        html = self.put("demo.html", HTML)
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            sketch_control.main(["preview", "--kind", "sketch", "--html", str(html), "--title", "T"])


if __name__ == "__main__":
    unittest.main()
