"""get-diagram, get-group, and search-diagrams against the fake MCP server."""
from __future__ import annotations

import json
import os
import unittest

from board_cli_support import run_cli
from cloud_support import CloudCase
from board_cli.auth import credentials

ID = "b_0fc10001"
GROUP = "g_99aabbcc"
MARKER = "SECRET-SOURCE-MARKER"
BOXES = f'boxes "Plan {MARKER}"\r\nbox a "图"\r\n'
SKETCH = f'style abc123\nsketch "Hi"\ncontent {MARKER}\n'
MERMAID = f"flowchart TD\n  a[{MARKER}] --> b\n"


def diagram_doc(source: str, diagram_id: str = ID, **changes) -> dict:
    """What the get_diagram tool returns (mcpDoc in packages/board-mcp/src/index.js)."""
    doc = {"diagram_id": diagram_id, "title": "Now", "bmd": source, "version": 4,
           "updated_at": "2026-09-19T00:00:00Z", "group_id": GROUP, "url": f"https://luluboard.app/#b:{diagram_id}"}
    doc.update(changes)
    return doc


class ReadCase(CloudCase):
    def setUp(self) -> None:
        super().setUp()
        self.store_login()
        self.out = self.dir / "out"

    def serve_diagram(self, source: str, diagram_id: str = ID, **changes) -> None:
        self.mcp.answer_tool("get_diagram", diagram_doc(source, diagram_id, **changes))

    def get_diagram(self, diagram_id: str = ID) -> tuple:
        return run_cli("get-diagram", "--diagram-id", diagram_id, "--out", str(self.out))

    def assert_fails(self, result: tuple, *words: str) -> None:
        code, out, err = result
        self.assertEqual((code, out), (1, ""), err)
        self.assertEqual(len(err.splitlines()), 1, err)
        for word in words:
            self.assertIn(word, err)


class GetDiagramTest(ReadCase):
    def test_a_boxes_diagram_is_written_as_is_with_every_field_reported(self) -> None:
        self.serve_diagram(BOXES)
        code, out, err = self.get_diagram()
        self.assertEqual((code, err), (0, ""))
        path = (self.out / f"{ID}.bmd").resolve()
        self.assertEqual(json.loads(out), {
            "diagram_id": ID, "title": "Now", "version": 4, "updated_at": "2026-09-19T00:00:00Z",
            "group_id": GROUP, "url": f"https://luluboard.app/#b:{ID}", "file": str(path)})
        self.assertEqual(path.read_bytes(), BOXES.encode("utf-8"))  # CRLF and non-ASCII untouched

    def test_the_extension_follows_the_source(self) -> None:
        for source, extension in ((SKETCH, ".skt"), (MERMAID, ".mmd"), (BOXES, ".bmd")):
            self.serve_diagram(source)
            self.assertEqual(self.get_diagram()[0], 0)
            self.assertEqual((self.out / f"{ID}{extension}").read_bytes().decode("utf-8"), source)

    def test_the_output_has_no_source_and_no_kind(self) -> None:
        for source in (BOXES, SKETCH, MERMAID):
            self.serve_diagram(source)
            _, out, err = self.get_diagram()
            self.assertNotIn(MARKER, out + err)
            self.assertNotIn("kind", json.loads(out))
            self.assertNotIn("bmd", json.loads(out))

    def test_the_same_diagram_again_overwrites_the_file(self) -> None:
        self.serve_diagram(MERMAID)
        self.get_diagram()
        self.serve_diagram("flowchart TD\n  x --> y\n", version=5)
        _, out, _ = self.get_diagram()
        self.assertEqual((self.out / f"{ID}.mmd").read_text(), "flowchart TD\n  x --> y\n")
        self.assertEqual(json.loads(out)["version"], 5)
        self.assertEqual(sorted(path.name for path in self.out.iterdir()), [f"{ID}.mmd"])

    def test_a_missing_nested_output_directory_is_made(self) -> None:
        self.serve_diagram(BOXES)
        self.out = self.dir / "a" / "b" / "c"
        self.assertEqual(self.get_diagram()[0], 0)
        self.assertTrue((self.out / f"{ID}.bmd").is_file())

    def test_a_relative_output_directory_is_reported_as_an_absolute_file(self) -> None:
        self.serve_diagram(BOXES)
        old = os.getcwd()
        os.chdir(self.dir)
        self.addCleanup(os.chdir, old)
        code, out, _ = run_cli("get-diagram", "--diagram-id", ID, "--out", "rel")
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)["file"], str((self.dir / "rel" / f"{ID}.bmd").resolve()))

    def test_it_calls_get_diagram_with_the_id_and_the_stored_token(self) -> None:
        self.serve_diagram(BOXES)
        self.get_diagram()
        self.assertEqual(self.mcp.list_calls("get_diagram"), [{"diagram_id": ID}])
        self.assertEqual(self.mcp.requests[0]["authorization"], "Bearer " + credentials.read_credentials()["access_token"])
        self.assertEqual(self.mcp.list_methods(), ["tools/call"])

    def test_an_id_with_outer_spaces_is_trimmed(self) -> None:
        self.serve_diagram(BOXES)
        self.assertEqual(self.get_diagram(f"  {ID} ")[0], 0)
        self.assertEqual(self.mcp.list_calls("get_diagram"), [{"diagram_id": ID}])

    def test_a_malformed_id_fails_before_anything_is_sent(self) -> None:
        for bad in ("b_XYZ", "../../etc/passwd", "g_99aabbcc", ""):
            self.assert_fails(self.get_diagram(bad), "invalid diagram id")
        self.assertEqual((self.mcp.requests, self.auth.requests), ([], []))
        self.assertFalse(self.out.exists())

    def test_an_unknown_diagram_is_not_found(self) -> None:
        self.mcp.fail_tool("get_diagram", "Cloud board not found")
        self.assert_fails(self.get_diagram(), f"cloud diagram not found: {ID}")
        self.assertFalse(self.out.exists())

    def test_another_tool_failure_is_reported_with_its_reason(self) -> None:
        self.mcp.fail_tool("get_diagram", "boom")
        self.assert_fails(self.get_diagram(), "the MCP tool failed: boom")

    def test_a_row_without_source_is_refused_and_writes_nothing(self) -> None:
        doc = diagram_doc("x")
        del doc["bmd"]
        self.mcp.answer_tool("get_diagram", doc)
        self.assert_fails(self.get_diagram(), f"the MCP server returned no source for {ID}")
        self.assertFalse(self.out.exists())

    def test_a_row_without_a_group_is_refused_and_writes_nothing(self) -> None:
        self.serve_diagram(BOXES, group_id=None)
        self.assert_fails(self.get_diagram(), "the MCP server gave no group id")
        self.assertFalse(self.out.exists())

    def test_an_answer_that_is_not_an_object_is_refused(self) -> None:
        self.mcp.answer_tool("get_diagram", [1, 2])
        self.assert_fails(self.get_diagram(), "something other than an object")

    def test_an_unusable_version_is_reported_as_one_and_a_missing_title_as_empty(self) -> None:
        self.serve_diagram(BOXES, version="soon", title=None)
        info = json.loads(self.get_diagram()[1])
        self.assertEqual((info["version"], info["title"]), (1, ""))

    def test_an_empty_source_is_written_as_an_empty_mermaid_file(self) -> None:
        self.serve_diagram("")
        self.assertEqual(self.get_diagram()[0], 0)
        self.assertEqual((self.out / f"{ID}.mmd").read_text(), "")

    def test_an_sse_answer_works_the_same(self) -> None:
        self.mcp.response_format = "sse"
        self.serve_diagram(BOXES)
        self.assertEqual(self.get_diagram()[0], 0)
        self.assertEqual((self.out / f"{ID}.bmd").read_bytes(), BOXES.encode("utf-8"))


class GetGroupTest(ReadCase):
    """get_group answers with the members already in display order; the command passes them on."""

    def member(self, diagram_id: str, title: str, order: float) -> dict:
        return {"diagram_id": diagram_id, "title": title, "sort_order": order,
                "url": f"https://luluboard.app/#b:{diagram_id}"}

    def serve_group(self, members: list, group_id: str = "g_aaaa0001") -> None:
        self.mcp.answer_tool("get_group", {"group_id": group_id, "members": members})

    def get_group(self, diagram_id: str = "b_22222222") -> tuple:
        return run_cli("get-group", "--diagram-id", diagram_id)

    def test_it_lists_the_members_in_the_order_the_server_gave(self) -> None:
        members = [self.member("b_11111111", "First", 1), self.member("b_22222222", "Second", 2),
                   self.member("b_33333333", "Third", 9007199254740991)]
        self.serve_group(members)
        code, out, err = self.get_group()
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(json.loads(out), {"group_id": "g_aaaa0001", "members": members})

    def test_it_calls_get_group_with_the_id(self) -> None:
        self.serve_group([])
        self.get_group()
        self.assertEqual(self.mcp.list_calls("get_group"), [{"diagram_id": "b_22222222"}])

    def test_the_url_is_built_here_and_a_missing_sort_order_ranks_last(self) -> None:
        self.serve_group([{"diagram_id": "b_11111111", "title": "x", "url": "https://elsewhere.example/"},
                          {"diagram_id": "b_22222222", "title": None, "sort_order": "1"},
                          {"diagram_id": "b_33333333", "title": "y", "sort_order": True}])
        members = json.loads(self.get_group()[1])["members"]
        self.assertEqual(members[0]["url"], "https://luluboard.app/#b:b_11111111")
        self.assertEqual([m["sort_order"] for m in members], [9007199254740991] * 3)
        self.assertEqual(members[1]["title"], "")

    def test_members_with_a_bad_id_or_that_are_not_objects_are_skipped(self) -> None:
        self.serve_group([self.member("b_11111111", "ok", 1), {"diagram_id": "nope", "title": "x"}, "junk", None, {"title": "no id"}])
        self.assertEqual(len(json.loads(self.get_group()[1])["members"]), 1)

    def test_the_output_names_no_source(self) -> None:
        self.serve_group([dict(self.member("b_11111111", "x", 1), bmd=MARKER)])
        _, out, err = self.get_group()
        self.assertNotIn(MARKER, out + err)

    def test_an_unknown_diagram_is_not_found(self) -> None:
        self.mcp.fail_tool("get_group", "Cloud board not found")
        self.assert_fails(self.get_group("b_40440404"), "cloud diagram not found: b_40440404")

    def test_a_group_id_that_is_missing_or_malformed_is_refused(self) -> None:
        self.serve_group([], group_id=None)
        self.assert_fails(self.get_group(), "the MCP server gave no group id")
        self.serve_group([], group_id="oops")
        self.assert_fails(self.get_group(), "invalid group id")

    def test_an_answer_of_the_wrong_shape_is_refused(self) -> None:
        for answer, words in (({"group_id": "g_aaaa0001"}, "something other than a list"),
                              ([], "something other than an object"), ("text", "something other than an object")):
            self.mcp.answer_tool("get_group", answer)
            self.assert_fails(self.get_group(), words)

    def test_another_tool_failure_is_reported(self) -> None:
        self.mcp.fail_tool("get_group", "db")
        self.assert_fails(self.get_group(), "the MCP tool failed: db")

    def test_a_malformed_id_fails_before_anything_is_sent(self) -> None:
        self.assert_fails(self.get_group("g_aaaa0001"), "invalid diagram id")
        self.assertEqual(self.mcp.requests, [])


class SearchDiagramsTest(ReadCase):
    """search_diagrams answers with only the user's own diagrams; the command lists them."""

    def search(self, query: str = "plan") -> tuple:
        return run_cli("search-diagrams", "--query", query)

    def test_the_hits_are_listed_with_the_link_built_here(self) -> None:
        self.mcp.answer_tool("search_diagrams", [
            {"diagram_id": "b_b9918fe6", "title": "Mine Hit", "url": "https://luluboard.app/#b:b_b9918fe6"},
            {"diagram_id": "b_f5a65aa5", "title": None, "url": "https://elsewhere.example/"}])
        code, out, err = self.search()
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(json.loads(out), {"results": [
            {"diagram_id": "b_b9918fe6", "title": "Mine Hit", "url": "https://luluboard.app/#b:b_b9918fe6"},
            {"diagram_id": "b_f5a65aa5", "title": "", "url": "https://luluboard.app/#b:b_f5a65aa5"}]})

    def test_a_hit_with_a_bad_id_or_that_is_not_an_object_is_skipped_and_no_source_is_printed(self) -> None:
        self.mcp.answer_tool("search_diagrams", [{"diagram_id": "nope", "title": "x"}, "junk", None,
                                                  {"diagram_id": "b_00000001", "title": "ok", "bmd": MARKER}])
        _, out, err = self.search()
        self.assertEqual([hit["diagram_id"] for hit in json.loads(out)["results"]], ["b_00000001"])
        self.assertNotIn(MARKER, out + err)

    def test_no_hits_is_an_empty_list_and_still_success(self) -> None:
        self.mcp.answer_tool("search_diagrams", [])
        self.assertEqual(self.search()[:2], (0, '{"results": []}\n'))

    def test_the_query_is_trimmed_and_sent_as_the_tool_argument(self) -> None:
        self.mcp.answer_tool("search_diagrams", [])
        self.search("  图 plan\t")
        self.assertEqual(self.mcp.list_calls("search_diagrams"), [{"query": "图 plan"}])

    def test_a_blank_query_fails_before_anything_is_sent(self) -> None:
        for blank in ("", "   ", "\t\n"):
            self.assert_fails(self.search(blank), "--query must not be empty")
        self.assertEqual((self.mcp.requests, self.auth.requests), ([], []))

    def test_a_refused_search_is_reported_with_its_reason(self) -> None:
        self.mcp.fail_tool("search_diagrams", "query required")
        self.assert_fails(self.search(), "the MCP tool failed: query required")

    def test_an_answer_that_is_not_a_list_is_refused(self) -> None:
        self.mcp.answer_tool("search_diagrams", {"results": []})
        self.assert_fails(self.search(), "something other than a list")


class HelpTest(ReadCase):
    def test_the_contract_documents_the_three_commands(self) -> None:
        _, out, _ = run_cli("--help")
        for text in ("get-diagram --diagram-id ID --out DIR", "get-group --diagram-id ID", "search-diagrams --query TEXT",
                     ".bmd", ".skt", ".mmd", "9007199254740991", "no type field"):
            self.assertIn(text, out)

    def test_each_command_has_its_own_required_arguments(self) -> None:
        for argv in (("get-diagram", "--diagram-id", ID), ("get-diagram", "--out", "x"), ("get-group",), ("search-diagrams",)):
            self.assertEqual(run_cli(*argv)[0], 2, argv)
        self.assertEqual(self.mcp.requests, [])


if __name__ == "__main__":
    unittest.main()
