"""source_kind.detect_extension: the viewer's rule for the type of a source, as a file extension."""
from __future__ import annotations

import unittest

import board_cli_support  # noqa: F401  (puts the package on sys.path)
from board_cli.source_kind import detect_extension, first_statement


class DetectExtensionTest(unittest.TestCase):
    def check(self, expected: str, source: str) -> None:
        self.assertEqual(detect_extension(source), expected, repr(source))

    def test_boxes(self) -> None:
        self.check(".bmd", 'boxes "Plan"\nbox a "A"\n')

    def test_sketch(self) -> None:
        self.check(".skt", 'sketch "Hi"\ncontent aGVsbG8=\n')

    def test_mermaid_is_anything_else(self) -> None:
        for source in ("flowchart TD\n a-->b\n", "sequenceDiagram\n A->>B: hi\n", "mindmap\n  root\n", "pie\n", "totally unknown\n"):
            self.check(".mmd", source)

    def test_the_keywords_are_case_insensitive(self) -> None:
        self.check(".bmd", 'BOXES "x"\n')
        self.check(".skt", 'Sketch "x"\n')

    def test_a_style_line_before_the_statement_is_skipped(self) -> None:
        self.check(".skt", 'style abc123\nsketch "x"\ncontent aGk=\n')
        self.check(".bmd", 'style abc123\nboxes "x"\n')
        self.check(".mmd", "%% style abc123\nflowchart TD\n")
        self.check(".mmd", "style abc123\nflowchart TD\n")

    def test_comments_blank_lines_meta_and_fences_are_skipped(self) -> None:
        self.check(".bmd", '\n\n# note\n// note\n%% note\nmeta eyJpZCI6MX0=\n---\nboxes "x"\n')
        self.check(".skt", '%% a Mermaid-style comment\nsketch "x"\n')

    def test_leading_spaces_and_crlf_do_not_matter(self) -> None:
        self.check(".bmd", '   boxes "x"\r\nbox a\r\n')
        self.check(".skt", 'style t\r\nsketch "x"\r\n')

    def test_a_word_that_only_starts_like_a_keyword_is_mermaid(self) -> None:
        self.check(".mmd", "sketchy\n")
        self.check(".mmd", "boxes\n")          # the viewer needs a space after boxes
        self.check(".mmd", "boxesandmore x\n")

    def test_sketch_alone_is_sketch(self) -> None:
        self.check(".skt", "sketch\n")

    def test_a_non_ascii_letter_after_sketch_still_ends_the_word(self) -> None:
        self.check(".skt", "sketch图\n")

    def test_only_the_first_statement_counts(self) -> None:
        self.check(".mmd", 'flowchart TD\n boxes "x"\n')
        self.check(".bmd", 'boxes "x"\nsketch "y"\n')

    def test_an_empty_or_comment_only_source_is_mermaid(self) -> None:
        for source in ("", "\n\n", "# only a note\n", "style abc\n"):
            self.check(".mmd", source)

    def test_a_style_line_with_extra_words_is_a_statement(self) -> None:
        self.check(".mmd", "style a b\nboxes \"x\"\n")


class FirstStatementTest(unittest.TestCase):
    def test_it_returns_the_trimmed_line(self) -> None:
        self.assertEqual(first_statement('  \n# c\n  boxes "x"  \n'), 'boxes "x"')

    def test_it_returns_empty_when_there_is_none(self) -> None:
        self.assertEqual(first_statement("# c\n\n"), "")


if __name__ == "__main__":
    unittest.main()
