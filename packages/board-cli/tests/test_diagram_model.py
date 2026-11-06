"""diagram_model: ids, the web link, and the public fields of a diagram row."""
from __future__ import annotations

import unittest

import board_cli_support  # noqa: F401  (puts the package on sys.path)
from board_cli.cloud import diagram_model as model


class DiagramIdTest(unittest.TestCase):
    def test_a_good_id_passes_and_outer_spaces_go(self) -> None:
        self.assertEqual(model.check_diagram_id("b_0fc10001"), "b_0fc10001")
        self.assertEqual(model.check_diagram_id("  b_0fc10001\n"), "b_0fc10001")

    def test_a_bad_id_is_refused_with_the_rule_in_the_message(self) -> None:
        for raw in ("", "b_0FC10001", "b_0fc1000", "b_0fc100012", "g_0fc10001", "b_0fc1000g", "../b_0fc10001", "b_0fc10001/x", "b_0fc10001\nx"):
            with self.assertRaisesRegex(RuntimeError, r"^invalid diagram id .*: expected b_ and 8 lowercase hex digits$"):
                model.check_diagram_id(raw)

    def test_the_url_follows_the_web_app_hash(self) -> None:
        self.assertEqual(model.diagram_url("b_0fc10001"), "https://luluboard.app/#b:b_0fc10001")


class GroupArgumentTest(unittest.TestCase):
    def test_a_good_group_id_passes_and_outer_spaces_go(self) -> None:
        self.assertEqual(model.check_group_argument(" g_99aabbcc\n"), "g_99aabbcc")

    def test_a_bad_one_is_refused_with_the_rule_in_the_message(self) -> None:
        for raw in ("", "  ", "b_99aabbcc", "g_99AABBCC", "g_99aabb", "g_99aabbccdd", "g_99aabbcc\nx", "../g_99aabbcc"):
            with self.assertRaisesRegex(RuntimeError, r"^invalid group id .*: expected g_ and 8 lowercase hex digits$"):
                model.check_group_argument(raw)


class GroupIdTest(unittest.TestCase):
    def test_a_good_group_id_passes(self) -> None:
        self.assertEqual(model.check_group_id("g_99aabbcc"), "g_99aabbcc")

    def test_a_missing_one_is_named_as_missing(self) -> None:
        for raw in (None, "", "  "):
            with self.assertRaisesRegex(RuntimeError, r"^the MCP server gave no group id$"):
                model.check_group_id(raw)

    def test_a_malformed_one_is_named_as_invalid(self) -> None:
        for raw in ("b_99aabbcc", "g_99AABBCC", "g_99aabb", "g_99aabbccdd", "g_99aabbcc\nx"):
            with self.assertRaisesRegex(RuntimeError, r"^the MCP server gave an invalid group id "):
                model.check_group_id(raw)


class VersionTest(unittest.TestCase):
    def test_a_whole_number_of_one_or_more_is_kept(self) -> None:
        self.assertEqual([model.coerce_version(v) for v in (1, 4, 120, 3.0)], [1, 4, 120, 3])

    def test_anything_else_counts_as_one(self) -> None:
        for raw in (None, 0, -2, 0.5, "3", True, False, [], {}, float("nan"), float("inf")):
            self.assertEqual(model.coerce_version(raw), 1, repr(raw))


class DiagramInfoTest(unittest.TestCase):
    ROW = {"diagram_id": "b_0fc10001", "title": "Now", "bmd": "SOURCE", "version": 4,
           "updated_at": "2026-09-19T00:00:00Z", "group_id": "g_99aabbcc"}

    def test_it_holds_the_public_fields_and_never_the_source(self) -> None:
        info = model.diagram_info("b_0fc10001", self.ROW)
        self.assertEqual(info, {
            "diagram_id": "b_0fc10001", "title": "Now", "version": 4, "updated_at": "2026-09-19T00:00:00Z",
            "group_id": "g_99aabbcc", "url": "https://luluboard.app/#b:b_0fc10001"})
        self.assertEqual(list(info), ["diagram_id", "title", "version", "updated_at", "group_id", "url"])

    def test_missing_title_and_time_become_empty_strings(self) -> None:
        info = model.diagram_info("b_0fc10001", {"group_id": "g_99aabbcc"})
        self.assertEqual((info["title"], info["updated_at"], info["version"]), ("", "", 1))

    def test_a_row_without_a_group_is_refused(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "no group id"):
            model.diagram_info("b_0fc10001", {"title": "Bare"})


class ToolAnswerTest(unittest.TestCase):
    def test_an_object_passes_and_anything_else_is_refused(self) -> None:
        self.assertEqual(model.read_object({"a": 1}, "the diagram"), {"a": 1})
        for data in ([], "x", 3, None):
            with self.assertRaisesRegex(RuntimeError, r"^the MCP server answered the diagram with something other than an object$"):
                model.read_object(data, "the diagram")

    def test_a_list_passes_and_anything_else_is_refused(self) -> None:
        self.assertEqual(model.read_list([1], "the search"), [1])
        for data in ({}, "x", 3, None):
            with self.assertRaisesRegex(RuntimeError, r"^the MCP server answered the search with something other than a list$"):
                model.read_list(data, "the search")


if __name__ == "__main__":
    unittest.main()
