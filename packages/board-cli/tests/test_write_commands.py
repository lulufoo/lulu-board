"""create-diagram and save-diagram against the fake MCP server."""
from __future__ import annotations

import json
import unittest

from board_cli_support import run_cli
from cloud_support import CloudCase
from board_cli.auth import credentials
from board_cli.source import sketch_schema as schema

ID = "b_0fc10001"
GROUP = "g_99aabbcc"
MARKER = "SECRET-SOURCE-MARKER"
BOXES = f'boxes "Plan {MARKER}"\r\nbox a "图"\r\n'
MERMAID = f"%% title Demo\nflowchart TD\n  a[{MARKER}] --> b\n"
SKETCH = schema.build_source(f"<div>{MARKER}</div>", "Hi", "abc123")
FIELDS = {"diagram_id": ID, "title": "Plan", "version": 1, "updated_at": "2026-09-19T00:00:00Z",
          "group_id": GROUP, "url": "https://luluboard.app/#b:" + ID}


def saved_doc(source: str = BOXES, **changes) -> dict:
    """What create_diagram returns, and the row of save_diagram's answer: the public row, with the source echoed back."""
    return {**FIELDS, "bmd": source, **changes}


class WriteCase(CloudCase):
    def setUp(self) -> None:
        super().setUp()
        self.store_login()

    def assert_fails(self, result: tuple, *words: str) -> None:
        code, out, err = result
        self.assertEqual((code, out), (1, ""), err)
        self.assertEqual(len(err.splitlines()), 1, err)
        for word in words:
            self.assertIn(word, err)


class CreateDiagramTest(WriteCase):
    def create(self, path, *extra: str) -> tuple:
        return run_cli("create-diagram", "--file", str(path), *extra)

    def test_a_boxes_file_goes_up_exactly_as_written_and_the_fields_come_back(self) -> None:
        self.mcp.answer_tool("create_diagram", saved_doc())
        code, out, err = self.create(self.put("plan.bmd", BOXES))
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(json.loads(out), FIELDS)
        self.assertEqual(self.mcp.list_calls("create_diagram"), [{"bmd": BOXES}])  # CRLF and non-ASCII untouched; no ids

    def test_mermaid_and_sketch_files_go_up_as_written(self) -> None:
        for name, text in (("demo.mmd", MERMAID), ("hi.skt", SKETCH)):
            self.mcp.answer_tool("create_diagram", saved_doc(text))
            self.assertEqual(self.create(self.put(name, text))[0], 0)
            self.assertEqual(self.mcp.list_calls("create_diagram")[-1], {"bmd": text})
        self.assertTrue(SKETCH.startswith("style abc123\n"))

    def test_the_output_never_holds_the_source_the_server_sends_back(self) -> None:
        for name, text in (("a.bmd", BOXES), ("b.mmd", MERMAID), ("c.skt", SKETCH)):
            self.mcp.answer_tool("create_diagram", saved_doc(text))
            _, out, err = self.create(self.put(name, text))
            self.assertNotIn(MARKER, out + err)
            self.assertNotIn("bmd", json.loads(out))

    def test_a_diagram_id_and_a_group_id_are_sent_when_given(self) -> None:
        self.mcp.answer_tool("create_diagram", saved_doc())
        code, _, err = self.create(self.put("plan.bmd", BOXES), "--diagram-id", f" {ID} ", "--group-id", f" {GROUP}")
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(self.mcp.list_calls("create_diagram"), [{"diagram_id": ID, "group_id": GROUP, "bmd": BOXES}])

    def test_the_server_title_is_reported_as_it_comes_even_when_untitled(self) -> None:
        self.mcp.answer_tool("create_diagram", saved_doc(title="Untitled"))
        self.assertEqual(json.loads(self.create(self.put("x.mmd", "flowchart TD\n a-->b\n"))[1])["title"], "Untitled")

    def test_html_is_refused_with_the_encode_hint_and_nothing_is_sent(self) -> None:
        self.assert_fails(self.create(self.put("page.html", "<div>x</div>")),
                          "create-diagram takes a .skt, .bmd, or .mmd file; Sketch HTML goes through encode-source first")
        self.assertEqual((self.mcp.requests, self.auth.requests), ([], []))

    def test_other_extensions_are_refused(self) -> None:
        for name in ("a.txt", "b.md", "c"):
            self.assert_fails(self.create(self.put(name, "boxes \"x\"\n")), "create-diagram takes a .skt, .bmd, or .mmd file")
        self.assertEqual(self.mcp.requests, [])

    def test_a_damaged_sketch_file_is_refused_before_anything_is_sent(self) -> None:
        for text in ('sketch "x"\n', 'sketch "x"\ncontent !!!not-base64!!!\n', "plain text\n"):
            self.assert_fails(self.create(self.put("bad.skt", text)))
        self.assertEqual(self.mcp.requests, [])

    def test_an_empty_or_missing_file_is_refused(self) -> None:
        self.assert_fails(self.create(self.put("empty.bmd", "  \n")), "source file is empty")
        self.assert_fails(self.create(self.dir / "nope.bmd"), "source file not found")
        self.assertEqual(self.mcp.requests, [])

    def test_a_bad_id_is_refused_before_the_file_is_read_or_anything_is_sent(self) -> None:
        path = self.put("plan.bmd", BOXES)
        self.assert_fails(self.create(path, "--diagram-id", "b_XYZ"), "invalid diagram id")
        self.assert_fails(self.create(path, "--diagram-id", ""), "invalid diagram id")
        self.assert_fails(self.create(path, "--group-id", "b_99aabbcc"), "invalid group id", "g_ and 8 lowercase hex digits")
        self.assert_fails(self.create(path, "--group-id", ""), "invalid group id")
        missing = self.dir / "nope.bmd"
        self.assert_fails(self.create(missing, "--diagram-id", "b_XYZ"), "invalid diagram id")
        self.assert_fails(self.create(missing, "--group-id", "oops"), "invalid group id")
        self.assertEqual(self.mcp.requests, [])

    def test_an_upper_case_extension_is_accepted(self) -> None:
        self.mcp.answer_tool("create_diagram", saved_doc())
        self.assertEqual(self.create(self.put("PLAN.BMD", BOXES))[0], 0)

    def test_a_server_refusal_is_an_ordinary_error_with_its_reason(self) -> None:
        path = self.put("plan.bmd", BOXES)
        for reason in ("board source must not be empty", "invalid group id", "duplicate key"):
            self.mcp.fail_tool("create_diagram", reason)
            self.assert_fails(self.create(path), f"the MCP tool failed: {reason}")
        self.assertEqual(len(self.mcp.requests), 3)

    def test_an_answer_without_a_usable_diagram_id_is_refused(self) -> None:
        path = self.put("plan.bmd", BOXES)
        for answer in ({}, saved_doc(diagram_id=None), saved_doc(diagram_id="nope"), [saved_doc()], "text"):
            self.mcp.answer_tool("create_diagram", answer)
            self.assert_fails(self.create(path), "holds no diagram id")

    def test_an_answer_without_a_group_is_refused(self) -> None:
        self.mcp.answer_tool("create_diagram", saved_doc(group_id=None))
        self.assert_fails(self.create(self.put("plan.bmd", BOXES)), "the MCP server gave no group id")


class SaveDiagramTest(WriteCase):
    def save(self, path, version: str = "3", diagram_id: str = ID) -> tuple:
        return run_cli("save-diagram", "--diagram-id", diagram_id, "--file", str(path), "--expected-version", version)

    def serve(self, source: str = BOXES, **changes) -> None:
        self.mcp.answer_tool("save_diagram", {"conflict": False, "row": saved_doc(source, **changes)})

    def test_it_replaces_the_source_and_reports_the_new_version(self) -> None:
        self.serve(MERMAID, version=4, title="Demo")
        code, out, err = self.save(self.put("demo.mmd", MERMAID))
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(json.loads(out), {**FIELDS, "title": "Demo", "version": 4})
        self.assertEqual(self.mcp.list_calls("save_diagram"), [{"diagram_id": ID, "bmd": MERMAID, "expected_version": 3}])

    def test_the_version_is_sent_as_a_json_number(self) -> None:
        self.serve(version=8)
        self.save(self.put("a.bmd", BOXES), " 7 ")
        sent = self.mcp.list_calls("save_diagram")[0]["expected_version"]
        self.assertEqual((type(sent), sent), (int, 7))
        self.assertEqual(json.loads(self.mcp.requests[0]["body"])["params"]["arguments"]["expected_version"], 7)

    def test_the_source_the_server_sends_back_is_never_printed_and_a_sketch_goes_up_as_written(self) -> None:
        for name, text in (("a.bmd", BOXES), ("b.mmd", MERMAID), ("c.skt", SKETCH)):
            self.serve(text, version=2)
            _, out, err = self.save(self.put(name, text))
            self.assertNotIn(MARKER, out + err)
            self.assertEqual(self.mcp.list_calls("save_diagram")[-1]["bmd"], text)

    def test_versions_that_are_not_whole_numbers_from_one_fail_before_anything_is_sent(self) -> None:
        path = self.put("a.bmd", BOXES)
        for bad in ("0", "-1", "-0", "1.5", "2.0", "abc", "", " ", "1e2", "+1", "0x1", "٣", "9007199254740992", "99999999999999999999"):
            self.assert_fails(self.save(path, bad), "--expected-version must be a whole number from 1 to 9007199254740991")
        self.assertEqual((self.mcp.requests, self.auth.requests), ([], []))

    def test_the_edges_of_the_valid_range_are_accepted(self) -> None:
        self.serve(version=2)
        path = self.put("a.bmd", BOXES)
        for good in ("1", "9007199254740991"):
            self.assertEqual(self.save(path, good)[0], 0, good)

    def test_a_malformed_id_fails_before_anything_is_sent(self) -> None:
        path = self.put("a.bmd", BOXES)
        self.assert_fails(self.save(path, "3", "b_XYZ"), "invalid diagram id")
        self.assert_fails(self.save(path, "3", "g_99aabbcc"), "invalid diagram id")
        self.assertEqual(self.mcp.requests, [])

    def test_html_and_damaged_sketch_files_are_refused_before_anything_is_sent(self) -> None:
        self.assert_fails(self.save(self.put("page.html", "<div/>")),
                          "save-diagram takes a .skt, .bmd, or .mmd file; Sketch HTML goes through encode-source first")
        self.assert_fails(self.save(self.put("bad.skt", 'sketch "x"\n')))
        self.assertEqual(self.mcp.requests, [])

    def test_a_server_refusal_is_an_ordinary_error_with_its_reason(self) -> None:
        path = self.put("a.bmd", BOXES)
        for reason in ("invalid version", "forbidden", "Cloud board not found"):
            self.mcp.fail_tool("save_diagram", reason)
            self.assert_fails(self.save(path), f"the MCP tool failed: {reason}")

    def test_an_answer_of_the_wrong_shape_is_refused(self) -> None:
        path = self.put("a.bmd", BOXES)
        self.mcp.answer_tool("save_diagram", [1])
        self.assert_fails(self.save(path), "something other than an object")
        for answer in ({"conflict": False}, {"conflict": False, "row": {}}, {"conflict": False, "row": "x"}):
            self.mcp.answer_tool("save_diagram", answer)
            self.assert_fails(self.save(path), "holds no diagram id")


class ConflictTest(WriteCase):
    def setUp(self) -> None:
        super().setUp()
        self.path = self.put("a.bmd", BOXES)
        self.mcp.answer_tool("save_diagram", {"conflict": True, "row": saved_doc(f'boxes "{MARKER}"\n', version=7)})

    def save(self, version: str = "3") -> tuple:
        return run_cli("save-diagram", "--diagram-id", ID, "--file", str(self.path), "--expected-version", version)

    def test_a_conflict_is_exit_3_with_the_latest_version_and_no_source(self) -> None:
        code, out, err = self.save("3")
        self.assertEqual(code, 3)
        self.assertEqual(out, f'{{"conflict": true, "diagram_id": "{ID}", "latest_version": 7}}\n')
        self.assertEqual(err, f"version conflict: {ID} is at version 7, not 3; run get-diagram for the latest source\n")
        self.assertNotIn(MARKER, out + err)

    def test_one_call_is_sent_and_the_latest_version_is_not_read_again(self) -> None:
        self.save()
        self.assertEqual(self.mcp.list_methods(), ["tools/call"])
        self.assertEqual(len(self.mcp.list_calls("save_diagram")), 1)
        self.assertEqual(self.mcp.list_calls("get_diagram"), [])

    def test_the_conflict_does_not_touch_the_stored_login(self) -> None:
        before = credentials.read_credentials()
        self.save()
        self.assertEqual(credentials.read_credentials(), before)

    def test_an_unusable_version_in_the_row_counts_as_one(self) -> None:
        self.mcp.answer_tool("save_diagram", {"conflict": True, "row": saved_doc(version="soon")})
        code, out, _ = self.save("2")
        self.assertEqual((code, json.loads(out)["latest_version"]), (3, 1))

    def test_a_conflict_without_the_latest_row_is_an_ordinary_error(self) -> None:
        for answer in ({"conflict": True}, {"conflict": True, "row": None}, {"conflict": True, "row": "x"}):
            self.mcp.answer_tool("save_diagram", answer)
            code, out, err = self.save()
            self.assertEqual((code, out), (1, ""))
            self.assertIn(f"version conflict on {ID}", err)

    def test_a_conflict_in_an_sse_answer_is_the_same(self) -> None:
        self.mcp.response_format = "sse"
        self.assertEqual(self.save()[0], 3)


class HelpTest(WriteCase):
    def test_the_contract_documents_both_commands_and_exit_3(self) -> None:
        _, out, _ = run_cli("--help")
        for text in ("create-diagram --file FILE [--diagram-id ID] [--group-id ID]",
                     "save-diagram --diagram-id ID --file FILE --expected-version N",
                     "exit 3", '"latest_version"', "nothing is rounded to 1", "encode-source first"):
            self.assertIn(text, out)

    def test_the_required_arguments_are_enforced_by_the_parser(self) -> None:
        for argv in (("create-diagram",), ("save-diagram", "--diagram-id", ID, "--file", "x"),
                     ("save-diagram", "--file", "x", "--expected-version", "1"),
                     ("save-diagram", "--diagram-id", ID, "--expected-version", "1")):
            self.assertEqual(run_cli(*argv)[0], 2, argv)
        self.assertEqual(self.mcp.requests, [])


if __name__ == "__main__":
    unittest.main()
