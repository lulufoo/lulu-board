"""sketch_schema.py: the SKT Source format, title and style cleaning, and file reading."""
from __future__ import annotations

import base64
import unittest

from board_cli_support import TempDirCase
from board_cli import sketch_schema as schema

HTML = '<style>.d{color:red}</style><div class="d">你好 "world"</div>\n'


def encode_text(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


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


class ReadHtmlTest(TempDirCase):
    def test_missing_and_empty_files_are_refused(self) -> None:
        empty = self.put("empty.html", "  \n")
        for path in (self.dir / "none.html", empty):
            with self.assertRaises(schema.SketchError):
                schema.read_html(str(path))

    def test_an_html_file_holding_source_is_refused(self) -> None:
        held = self.put("held.html", schema.build_source(HTML, "T"))
        with self.assertRaises(schema.SketchError):
            schema.read_html(str(held))


if __name__ == "__main__":
    unittest.main()
