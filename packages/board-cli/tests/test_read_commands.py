"""get-diagram, get-group, and search-diagrams against the fake API."""
from __future__ import annotations

import json
import os
import unittest
import urllib.parse
from pathlib import Path

from board_cli_support import run_cli
from cloud_support import CloudCase
from board_cli.auth import credentials, token_manager

ID = "b_0fc10001"
GROUP = "g_99aabbcc"
MARKER = "SECRET-SOURCE-MARKER"
BOXES = f'boxes "Plan {MARKER}"\r\nbox a "图"\r\n'
SKETCH = f'style abc123\nsketch "Hi"\ncontent {MARKER}\n'
MERMAID = f"flowchart TD\n  a[{MARKER}] --> b\n"


def graph_row(source: str, **changes) -> dict:
    row = {"graph_id": ID, "title": "Now", "bmd": source, "version": 4,
           "updated_at": "2026-09-19T00:00:00Z", "group_id": GROUP}
    row.update(changes)
    return row


class ReadCase(CloudCase):
    def setUp(self) -> None:
        super().setUp()
        self.store_login()
        self.out = self.dir / "out"

    def serve_diagram(self, source: str, diagram_id: str = ID, **changes) -> None:
        self.api.route("GET", f"/graphs?diagram_id={diagram_id}", 200, graph_row(source, graph_id=diagram_id, **changes))

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

    def test_a_sketch_diagram_gets_the_skt_extension(self) -> None:
        self.serve_diagram(SKETCH)
        self.assertEqual(self.get_diagram()[0], 0)
        self.assertEqual((self.out / f"{ID}.skt").read_text(encoding="utf-8"), SKETCH)

    def test_a_mermaid_diagram_gets_the_mmd_extension(self) -> None:
        self.serve_diagram(MERMAID)
        self.assertEqual(self.get_diagram()[0], 0)
        self.assertEqual((self.out / f"{ID}.mmd").read_text(encoding="utf-8"), MERMAID)

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

    def test_it_asks_for_the_id_with_the_bearer_token(self) -> None:
        self.serve_diagram(BOXES)
        self.get_diagram()
        sent = self.api.requests[0]
        self.assertEqual(sent["method"], "GET")
        self.assertEqual(urllib.parse.parse_qs(urllib.parse.urlparse(sent["path"]).query), {"diagram_id": [ID]})
        self.assertEqual(sent["authorization"], "Bearer " + credentials.read_credentials()["access_token"])

    def test_an_id_with_outer_spaces_is_trimmed(self) -> None:
        self.serve_diagram(BOXES)
        self.assertEqual(self.get_diagram(f"  {ID} ")[0], 0)
        self.assertEqual(self.api.requests[0]["path"], f"/graphs?diagram_id={ID}")

    def test_a_malformed_id_fails_before_anything_is_sent(self) -> None:
        for bad in ("b_XYZ", "../../etc/passwd", "g_99aabbcc", ""):
            self.assert_fails(self.get_diagram(bad), "invalid diagram id")
        self.assertEqual((self.api.requests, self.auth.requests), ([], []))
        self.assertFalse(self.out.exists())

    def test_an_unknown_diagram_is_not_found(self) -> None:
        self.api.route("GET", f"/graphs?diagram_id={ID}", 404, {"error": "not_found"})
        self.assert_fails(self.get_diagram(), f"cloud diagram not found: {ID}")
        self.assertFalse(self.out.exists())

    def test_a_server_error_is_reported_with_its_reason(self) -> None:
        self.api.route("GET", f"/graphs?diagram_id={ID}", 500, {"message": "boom"})
        self.assert_fails(self.get_diagram(), "the API answered HTTP 500: boom")

    def test_a_row_without_source_is_refused_and_writes_nothing(self) -> None:
        row = graph_row("x")
        del row["bmd"]
        self.api.route("GET", f"/graphs?diagram_id={ID}", 200, row)
        self.assert_fails(self.get_diagram(), f"the API returned no source for {ID}")
        self.assertFalse(self.out.exists())

    def test_a_row_without_a_group_is_refused_and_writes_nothing(self) -> None:
        row = graph_row(BOXES)
        del row["group_id"]
        self.api.route("GET", f"/graphs?diagram_id={ID}", 200, row)
        self.assert_fails(self.get_diagram(), "the API gave no group id")
        self.assertFalse(self.out.exists())

    def test_a_reply_that_is_not_an_object_is_refused(self) -> None:
        self.api.route("GET", f"/graphs?diagram_id={ID}", 200, [1, 2])
        self.assert_fails(self.get_diagram(), "something other than an object")

    def test_an_unusable_version_is_reported_as_one(self) -> None:
        self.serve_diagram(BOXES, version="soon")
        self.assertEqual(json.loads(self.get_diagram()[1])["version"], 1)

    def test_a_missing_title_is_reported_empty(self) -> None:
        self.serve_diagram(BOXES, title=None)
        self.assertEqual(json.loads(self.get_diagram()[1])["title"], "")

    def test_an_empty_source_is_written_as_an_empty_mermaid_file(self) -> None:
        self.serve_diagram("")
        self.assertEqual(self.get_diagram()[0], 0)
        self.assertEqual((self.out / f"{ID}.mmd").read_text(), "")


class GetGroupTest(ReadCase):
    ROWS = [
        {"graph_id": "b_22222222", "group_id": "g_aaaa0001", "title": "Second", "sort_order": 2},
        {"graph_id": "b_11111111", "group_id": "g_aaaa0001", "title": "First", "sort_order": 1},
        {"graph_id": "b_33333333", "group_id": "g_aaaa0001", "title": "Third"},
        {"graph_id": "b_44444444", "group_id": "g_bbbb0002", "title": "Other", "sort_order": 1},
    ]

    def get_group(self, diagram_id: str = "b_22222222") -> tuple:
        return run_cli("get-group", "--diagram-id", diagram_id)

    def member(self, diagram_id: str, title: str, order: float) -> dict:
        return {"diagram_id": diagram_id, "title": title, "sort_order": order,
                "url": f"https://luluboard.app/#b:{diagram_id}"}

    def test_it_lists_the_members_of_the_group_in_display_order(self) -> None:
        self.api.route("POST", "/groups/shells", 200, self.ROWS)
        code, out, err = self.get_group()
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(json.loads(out), {"group_id": "g_aaaa0001", "members": [
            self.member("b_11111111", "First", 1),
            self.member("b_22222222", "Second", 2),
            self.member("b_33333333", "Third", 9007199254740991),
        ]})

    def test_the_other_group_is_not_mixed_in(self) -> None:
        self.api.route("POST", "/groups/shells", 200, self.ROWS)
        out = json.loads(self.get_group("b_44444444")[1])
        self.assertEqual(out["group_id"], "g_bbbb0002")
        self.assertEqual([m["diagram_id"] for m in out["members"]], ["b_44444444"])

    def test_it_posts_the_diagram_id_as_json(self) -> None:
        self.api.route("POST", "/groups/shells", 200, self.ROWS)
        self.get_group()
        sent = self.api.requests[0]
        self.assertEqual((sent["method"], sent["path"], sent["content_type"]), ("POST", "/groups/shells", "application/json"))
        self.assertEqual(json.loads(sent["body"]), {"diagram_id": "b_22222222"})

    def test_equal_sort_orders_fall_back_to_the_id(self) -> None:
        rows = [{"graph_id": f"b_0000000{n}", "group_id": "g_aaaa0001", "title": str(n), "sort_order": 1} for n in (3, 1, 2)]
        self.api.route("POST", "/groups/shells", 200, rows)
        members = json.loads(self.get_group("b_00000001")[1])["members"]
        self.assertEqual([m["diagram_id"] for m in members], ["b_00000001", "b_00000002", "b_00000003"])

    def test_a_sort_order_that_is_not_a_number_ranks_last(self) -> None:
        rows = [{"graph_id": "b_00000001", "group_id": "g_aaaa0001", "title": "odd", "sort_order": "1"},
                {"graph_id": "b_00000002", "group_id": "g_aaaa0001", "title": "two", "sort_order": 2},
                {"graph_id": "b_00000003", "group_id": "g_aaaa0001", "title": "null", "sort_order": None},
                {"graph_id": "b_00000004", "group_id": "g_aaaa0001", "title": "bool", "sort_order": True}]
        self.api.route("POST", "/groups/shells", 200, rows)
        members = json.loads(self.get_group("b_00000002")[1])["members"]
        self.assertEqual([m["diagram_id"] for m in members], ["b_00000002", "b_00000001", "b_00000003", "b_00000004"])

    def test_rows_with_a_bad_id_or_a_non_object_are_skipped(self) -> None:
        rows = self.ROWS + [{"graph_id": "nope", "group_id": "g_aaaa0001", "title": "x"}, "junk", None, {"title": "no id"}]
        self.api.route("POST", "/groups/shells", 200, rows)
        members = json.loads(self.get_group()[1])["members"]
        self.assertEqual(len(members), 3)

    def test_the_output_names_no_source(self) -> None:
        rows = [dict(row, bmd=MARKER) for row in self.ROWS]
        self.api.route("POST", "/groups/shells", 200, rows)
        _, out, err = self.get_group()
        self.assertNotIn(MARKER, out + err)

    def test_a_diagram_that_is_not_in_the_rows_is_not_found(self) -> None:
        self.api.route("POST", "/groups/shells", 200, [])
        self.assert_fails(self.get_group("b_00000000"), "cloud diagram not found: b_00000000")

    def test_a_404_is_not_found(self) -> None:
        self.api.route("POST", "/groups/shells", 404, {"error": "not_found", "message": "Cloud diagram not found"})
        self.assert_fails(self.get_group("b_40440404"), "cloud diagram not found: b_40440404")

    def test_a_row_without_a_group_is_refused(self) -> None:
        self.api.route("POST", "/groups/shells", 200, [{"graph_id": "b_0fc10003", "title": "Bare"}])
        self.assert_fails(self.get_group("b_0fc10003"), "the API gave no group id")

    def test_a_malformed_group_id_is_refused(self) -> None:
        self.api.route("POST", "/groups/shells", 200, [{"graph_id": "b_0fc10003", "group_id": "oops", "title": "x"}])
        self.assert_fails(self.get_group("b_0fc10003"), "invalid group id")

    def test_a_reply_that_is_not_a_list_is_refused(self) -> None:
        for body in ({"rows": []}, None, "text"):
            self.api.route("POST", "/groups/shells", 200, body)
            self.assert_fails(self.get_group(), "something other than a list")

    def test_a_server_error_is_reported(self) -> None:
        self.api.route("POST", "/groups/shells", 500, {"error": "db"})
        self.assert_fails(self.get_group(), "the API answered HTTP 500: db")

    def test_a_malformed_id_fails_before_anything_is_sent(self) -> None:
        self.assert_fails(self.get_group("g_aaaa0001"), "invalid diagram id")
        self.assertEqual(self.api.requests, [])


class SearchDiagramsTest(ReadCase):
    HITS = [
        {"category": "mine", "title": "Mine Hit", "share_id": None, "graph_id": "b_b9918fe6", "bmd": MARKER},
        {"category": "public", "title": "Public Hit", "share_id": "s_public1", "graph_id": None},
        {"category": "public", "title": "Public With Id", "graph_id": "b_f5a65aa5"},
        {"category": "mine", "title": "Also Mine", "share_id": "", "graph_id": "b_f5a65aa5"},
        {"category": "mine", "title": "Bad Id", "share_id": "", "graph_id": "nope"},
        {"category": "mine", "graph_id": "b_00000001"},
        "junk",
    ]

    def search(self, query: str = "plan") -> tuple:
        return run_cli("search-diagrams", "--query", query)

    def test_only_my_diagrams_with_good_ids_are_listed(self) -> None:
        self.api.route("POST", "/search", 200, self.HITS)
        code, out, err = self.search()
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(json.loads(out), {"results": [
            {"diagram_id": "b_b9918fe6", "title": "Mine Hit", "url": "https://luluboard.app/#b:b_b9918fe6"},
            {"diagram_id": "b_f5a65aa5", "title": "Also Mine", "url": "https://luluboard.app/#b:b_f5a65aa5"},
            {"diagram_id": "b_00000001", "title": "", "url": "https://luluboard.app/#b:b_00000001"},
        ]})

    def test_the_source_the_server_sends_with_a_hit_is_not_printed(self) -> None:
        self.api.route("POST", "/search", 200, self.HITS)
        _, out, err = self.search()
        self.assertNotIn(MARKER, out + err)
        self.assertNotIn("bmd", out)

    def test_no_hits_is_an_empty_list_and_still_success(self) -> None:
        self.api.route("POST", "/search", 200, [])
        self.assertEqual(self.search()[:2], (0, '{"results": []}\n'))

    def test_the_query_is_trimmed_and_posted_as_json(self) -> None:
        self.api.route("POST", "/search", 200, [])
        self.search("  图 plan\t")
        sent = self.api.requests[0]
        self.assertEqual((sent["method"], sent["path"], sent["content_type"]), ("POST", "/search", "application/json"))
        self.assertEqual(json.loads(sent["body"].decode("utf-8")), {"query": "图 plan"})

    def test_a_blank_query_fails_before_anything_is_sent(self) -> None:
        for blank in ("", "   ", "\t\n"):
            self.assert_fails(self.search(blank), "--query must not be empty")
        self.assertEqual((self.api.requests, self.auth.requests), ([], []))

    def test_a_refused_search_is_reported_with_its_reason(self) -> None:
        self.api.route("POST", "/search", 400, {"error": "invalid_request", "message": "query required"})
        self.assert_fails(self.search(), "the API answered HTTP 400: query required")

    def test_a_reply_that_is_not_a_list_is_refused(self) -> None:
        self.api.route("POST", "/search", 200, {"results": []})
        self.assert_fails(self.search(), "something other than a list")


class LoginHandlingTest(ReadCase):
    """The three commands share one way of handling the login; each is checked once."""

    COMMANDS = (("get-diagram", "--diagram-id", ID, "--out", "OUT"), ("get-group", "--diagram-id", ID),
                ("search-diagrams", "--query", "plan"))

    def command(self, argv: tuple) -> tuple:
        return run_cli(*[str(self.out) if part == "OUT" else part for part in argv])

    def serve_all(self) -> None:
        self.serve_diagram(BOXES)
        self.api.route("POST", "/groups/shells", 200, [{"graph_id": ID, "group_id": GROUP, "title": "x"}])
        self.api.route("POST", "/search", 200, [])

    def test_without_a_login_each_is_exit_4_and_nothing_is_sent(self) -> None:
        os.unlink(credentials.locate_credentials())
        for argv in self.COMMANDS:
            code, out, err = self.command(argv)
            self.assertEqual((code, out), (4, '{"login_required": true}\n'), argv)
            self.assertIn("run login", err)
        self.assertEqual((self.api.requests, self.auth.requests), ([], []))

    def test_an_expired_token_is_refreshed_before_each_call(self) -> None:
        self.serve_all()
        for argv in self.COMMANDS:
            self.store_login(exp=self.expired())
            self.assertEqual(self.command(argv)[0], 0, argv)
        self.assertEqual(self.auth.refreshes, 3)

    def test_a_revoked_token_is_refreshed_and_the_call_retried(self) -> None:
        self.serve_all()
        for index, argv in enumerate(self.COMMANDS, start=1):
            stale = credentials.read_credentials()["access_token"]
            self.auth.valid_access_tokens.discard(stale)
            self.assertEqual(self.command(argv)[0], 0, argv)
            self.assertEqual(self.auth.refreshes, index)

    def test_a_refused_login_is_exit_4_for_each(self) -> None:
        self.serve_all()
        self.api.reject_all = True
        for argv in self.COMMANDS:
            code, out, err = self.command(argv)
            self.assertEqual((code, out), (4, '{"login_required": true}\n'), argv)
            self.assertEqual(err, token_manager.REFUSED + "\n")


class HelpTest(ReadCase):
    def test_the_contract_documents_the_three_commands(self) -> None:
        _, out, _ = run_cli("--help")
        for text in ("get-diagram --diagram-id ID --out DIR", "get-group --diagram-id ID", "search-diagrams --query TEXT",
                     ".bmd", ".skt", ".mmd", "9007199254740991", "no type field"):
            self.assertIn(text, out)

    def test_each_command_has_its_own_required_arguments(self) -> None:
        for argv in (("get-diagram", "--diagram-id", ID), ("get-diagram", "--out", "x"), ("get-group",), ("search-diagrams",)):
            self.assertEqual(run_cli(*argv)[0], 2, argv)
        self.assertEqual(self.api.requests, [])


if __name__ == "__main__":
    unittest.main()
