"""create-diagram and save-diagram against the fake API."""
from __future__ import annotations

import json
import unittest

from board_cli_support import run_cli
from cloud_support import CloudCase
from board_cli.auth import credentials, token_manager
from board_cli.source import sketch_schema as schema

ID = "b_0fc10001"
GROUP = "g_99aabbcc"
MARKER = "SECRET-SOURCE-MARKER"
BOXES = f'boxes "Plan {MARKER}"\r\nbox a "图"\r\n'
MERMAID = f"%% title Demo\nflowchart TD\n  a[{MARKER}] --> b\n"
SKETCH = schema.build_source(f"<div>{MARKER}</div>", "Hi", "abc123")


def saved_row(source: str = BOXES, **changes) -> dict:
    """What POST and PATCH /graphs answer: the public row, with the source echoed back."""
    row = {"diagram_id": ID, "title": "Plan", "bmd": source, "version": 1,
           "updated_at": "2026-09-19T00:00:00Z", "group_id": GROUP, "url": "https://luluboard.app/#b:" + ID}
    row.update(changes)
    return row


class WriteCase(CloudCase):
    def setUp(self) -> None:
        super().setUp()
        self.store_login()

    def source_file(self, name: str, text: str):
        return self.put(name, text)

    def assert_fails(self, result: tuple, *words: str) -> None:
        code, out, err = result
        self.assertEqual((code, out), (1, ""), err)
        self.assertEqual(len(err.splitlines()), 1, err)
        for word in words:
            self.assertIn(word, err)

    def sent_json(self, index: int = 0) -> dict:
        return json.loads(self.api.requests[index]["body"].decode("utf-8"))


class CreateDiagramTest(WriteCase):
    def create(self, path, *extra: str) -> tuple:
        return run_cli("create-diagram", "--file", str(path), *extra)

    def test_a_boxes_file_goes_up_exactly_as_written_and_the_fields_come_back(self) -> None:
        self.api.route("POST", "/graphs", 200, saved_row())
        code, out, err = self.create(self.source_file("plan.bmd", BOXES))
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(json.loads(out), {
            "diagram_id": ID, "title": "Plan", "version": 1, "updated_at": "2026-09-19T00:00:00Z",
            "group_id": GROUP, "url": f"https://luluboard.app/#b:{ID}"})
        sent = self.api.requests[0]
        self.assertEqual((sent["method"], sent["path"], sent["content_type"]), ("POST", "/graphs", "application/json"))
        self.assertEqual(self.sent_json(), {"bmd": BOXES})  # CRLF and non-ASCII untouched; no ids, no title

    def test_a_mermaid_file_goes_up_as_written(self) -> None:
        self.api.route("POST", "/graphs", 200, saved_row(MERMAID))
        self.assertEqual(self.create(self.source_file("demo.mmd", MERMAID))[0], 0)
        self.assertEqual(self.sent_json(), {"bmd": MERMAID})

    def test_a_sketch_file_goes_up_as_written_with_its_style_line(self) -> None:
        self.api.route("POST", "/graphs", 200, saved_row(SKETCH))
        self.assertEqual(self.create(self.source_file("hi.skt", SKETCH))[0], 0)
        self.assertEqual(self.sent_json(), {"bmd": SKETCH})
        self.assertTrue(SKETCH.startswith("style abc123\n"))

    def test_the_output_never_holds_the_source_the_server_sends_back(self) -> None:
        for name, text in (("a.bmd", BOXES), ("b.mmd", MERMAID), ("c.skt", SKETCH)):
            self.api.route("POST", "/graphs", 200, saved_row(text))
            _, out, err = self.create(self.source_file(name, text))
            self.assertNotIn(MARKER, out + err)
            self.assertNotIn("bmd", json.loads(out))

    def test_a_diagram_id_and_a_group_id_are_sent_when_given(self) -> None:
        self.api.route("POST", "/graphs", 200, saved_row())
        code, _, err = self.create(self.source_file("plan.bmd", BOXES), "--diagram-id", f" {ID} ", "--group-id", f" {GROUP}")
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(self.sent_json(), {"diagram_id": ID, "group_id": GROUP, "bmd": BOXES})

    def test_the_server_title_is_reported_as_it_comes_even_when_untitled(self) -> None:
        self.api.route("POST", "/graphs", 200, saved_row(title="Untitled"))
        self.assertEqual(json.loads(self.create(self.source_file("x.mmd", "flowchart TD\n a-->b\n"))[1])["title"], "Untitled")

    def test_html_is_refused_with_the_encode_hint_and_nothing_is_sent(self) -> None:
        self.assert_fails(self.create(self.source_file("page.html", "<div>x</div>")),
                          "create-diagram takes a .skt, .bmd, or .mmd file; Sketch HTML goes through encode-source first")
        self.assertEqual((self.api.requests, self.auth.requests), ([], []))

    def test_other_extensions_are_refused(self) -> None:
        for name in ("a.txt", "b.md", "c"):
            self.assert_fails(self.create(self.source_file(name, "boxes \"x\"\n")), "create-diagram takes a .skt, .bmd, or .mmd file")
        self.assertEqual(self.api.requests, [])

    def test_a_damaged_sketch_file_is_refused_before_anything_is_sent(self) -> None:
        for text in ('sketch "x"\n', 'sketch "x"\ncontent !!!not-base64!!!\n', "plain text\n"):
            self.assert_fails(self.create(self.source_file("bad.skt", text)))
        self.assertEqual(self.api.requests, [])

    def test_an_empty_or_missing_file_is_refused(self) -> None:
        self.assert_fails(self.create(self.source_file("empty.bmd", "  \n")), "source file is empty")
        self.assert_fails(self.create(self.dir / "nope.bmd"), "source file not found")
        self.assertEqual(self.api.requests, [])

    def test_a_bad_id_is_refused_before_the_file_is_read_or_anything_is_sent(self) -> None:
        path = self.source_file("plan.bmd", BOXES)
        self.assert_fails(self.create(path, "--diagram-id", "b_XYZ"), "invalid diagram id")
        self.assert_fails(self.create(path, "--diagram-id", ""), "invalid diagram id")
        self.assert_fails(self.create(path, "--group-id", "b_99aabbcc"), "invalid group id", "g_ and 8 lowercase hex digits")
        self.assert_fails(self.create(path, "--group-id", ""), "invalid group id")
        self.assertEqual(self.api.requests, [])

    def test_an_id_is_checked_before_the_file_is_read(self) -> None:
        missing = self.dir / "nope.bmd"
        self.assert_fails(self.create(missing, "--diagram-id", "b_XYZ"), "invalid diagram id")
        self.assert_fails(self.create(missing, "--group-id", "oops"), "invalid group id")

    def test_an_upper_case_extension_is_accepted(self) -> None:
        self.api.route("POST", "/graphs", 200, saved_row())
        self.assertEqual(self.create(self.source_file("PLAN.BMD", BOXES))[0], 0)

    def test_a_server_refusal_is_an_ordinary_error_with_its_reason(self) -> None:
        path = self.source_file("plan.bmd", BOXES)
        cases = ((400, {"error": "invalid_request", "message": "board source must not be empty"}, "HTTP 400: board source must not be empty"),
                 (403, {"error": "forbidden", "message": "group not found"}, "HTTP 403: group not found"),
                 (500, {"error": "db_error"}, "HTTP 500: db_error"))
        for status, body, text in cases:
            self.api.route("POST", "/graphs", status, body)
            self.assert_fails(self.create(path), text)

    def test_a_409_on_create_is_not_a_version_conflict(self) -> None:
        self.api.route("POST", "/graphs", 409, {"error": "conflict", "message": "duplicate key"})
        self.assert_fails(self.create(self.source_file("plan.bmd", BOXES), "--diagram-id", ID), "HTTP 409: duplicate key")
        self.assertEqual(len(self.api.requests), 1)

    def test_a_reply_without_a_usable_diagram_id_is_refused(self) -> None:
        path = self.source_file("plan.bmd", BOXES)
        for body in ({}, saved_row(diagram_id=None), saved_row(diagram_id="nope"), [saved_row()], "text"):
            self.api.route("POST", "/graphs", 200, body)
            self.assert_fails(self.create(path), "holds no diagram id")

    def test_a_reply_without_a_group_is_refused(self) -> None:
        row = saved_row()
        del row["group_id"]
        self.api.route("POST", "/graphs", 200, row)
        self.assert_fails(self.create(self.source_file("plan.bmd", BOXES)), "the API gave no group id")


class SaveDiagramTest(WriteCase):
    def save(self, path, version: str = "3", diagram_id: str = ID, *extra: str) -> tuple:
        return run_cli("save-diagram", "--diagram-id", diagram_id, "--file", str(path), "--expected-version", version, *extra)

    def test_it_replaces_the_source_and_reports_the_new_version(self) -> None:
        self.api.route("PATCH", "/graphs", 200, saved_row(MERMAID, version=4, title="Demo"))
        code, out, err = self.save(self.source_file("demo.mmd", MERMAID))
        self.assertEqual((code, err), (0, ""))
        self.assertEqual(json.loads(out), {
            "diagram_id": ID, "title": "Demo", "version": 4, "updated_at": "2026-09-19T00:00:00Z",
            "group_id": GROUP, "url": f"https://luluboard.app/#b:{ID}"})
        sent = self.api.requests[0]
        self.assertEqual((sent["method"], sent["path"], sent["content_type"]), ("PATCH", "/graphs", "application/json"))
        self.assertEqual(self.sent_json(), {"diagram_id": ID, "bmd": MERMAID, "expected_version": 3})

    def test_the_version_is_sent_as_a_json_number(self) -> None:
        self.api.route("PATCH", "/graphs", 200, saved_row(version=8))
        self.save(self.source_file("a.bmd", BOXES), " 7 ")
        self.assertIs(type(self.sent_json()["expected_version"]), int)
        self.assertEqual(self.sent_json()["expected_version"], 7)

    def test_the_source_the_server_sends_back_is_never_printed(self) -> None:
        for name, text in (("a.bmd", BOXES), ("b.mmd", MERMAID), ("c.skt", SKETCH)):
            self.api.route("PATCH", "/graphs", 200, saved_row(text, version=2))
            _, out, err = self.save(self.source_file(name, text))
            self.assertNotIn(MARKER, out + err)

    def test_a_sketch_file_goes_up_as_written(self) -> None:
        self.api.route("PATCH", "/graphs", 200, saved_row(SKETCH, version=2))
        self.assertEqual(self.save(self.source_file("hi.skt", SKETCH))[0], 0)
        self.assertEqual(self.sent_json()["bmd"], SKETCH)

    def test_versions_that_are_not_whole_numbers_from_one_fail_before_anything_is_sent(self) -> None:
        path = self.source_file("a.bmd", BOXES)
        for bad in ("0", "-1", "-0", "1.5", "2.0", "abc", "", " ", "1e2", "+1", "0x1", "٣", "9007199254740992", "99999999999999999999"):
            self.assert_fails(self.save(path, bad), "--expected-version must be a whole number from 1 to 9007199254740991")
        self.assertEqual((self.api.requests, self.auth.requests), ([], []))

    def test_the_edges_of_the_valid_range_are_accepted(self) -> None:
        self.api.route("PATCH", "/graphs", 200, saved_row(version=2))
        path = self.source_file("a.bmd", BOXES)
        for good in ("1", "9007199254740991"):
            self.assertEqual(self.save(path, good)[0], 0, good)

    def test_a_malformed_id_fails_before_anything_is_sent(self) -> None:
        path = self.source_file("a.bmd", BOXES)
        self.assert_fails(self.save(path, "3", "b_XYZ"), "invalid diagram id")
        self.assert_fails(self.save(path, "3", "g_99aabbcc"), "invalid diagram id")
        self.assertEqual(self.api.requests, [])

    def test_html_and_damaged_sketch_files_are_refused_before_anything_is_sent(self) -> None:
        self.assert_fails(self.save(self.source_file("page.html", "<div/>")), "save-diagram takes a .skt, .bmd, or .mmd file; Sketch HTML goes through encode-source first")
        self.assert_fails(self.save(self.source_file("bad.skt", 'sketch "x"\n')))
        self.assertEqual(self.api.requests, [])

    def test_a_server_refusal_is_an_ordinary_error_with_its_reason(self) -> None:
        path = self.source_file("a.bmd", BOXES)
        for status, body, text in ((400, {"error": "invalid_request", "message": "invalid version"}, "HTTP 400: invalid version"),
                                   (403, {"error": "forbidden"}, "HTTP 403: forbidden"),
                                   (500, {"error": "db_error", "message": "boom"}, "HTTP 500: boom")):
            self.api.route("PATCH", "/graphs", status, body)
            self.assert_fails(self.save(path), text)


class ConflictTest(WriteCase):
    def setUp(self) -> None:
        super().setUp()
        self.path = self.source_file("a.bmd", BOXES)
        self.api.route("PATCH", "/graphs", 409, {"error": "conflict"})
        self.api.route("GET", f"/graphs?diagram_id={ID}", 200,
                       {"graph_id": ID, "title": "Now", "bmd": f"boxes \"{MARKER}\"\n", "version": 7,
                        "updated_at": "2026-09-19T00:00:00Z", "group_id": GROUP})

    def save(self, version: str = "3") -> tuple:
        return run_cli("save-diagram", "--diagram-id", ID, "--file", str(self.path), "--expected-version", version)

    def test_a_409_is_exit_3_with_the_latest_version_and_no_source(self) -> None:
        code, out, err = self.save("3")
        self.assertEqual(code, 3)
        self.assertEqual(out, f'{{"conflict": true, "diagram_id": "{ID}", "latest_version": 7}}\n')
        self.assertEqual(err, f"version conflict: {ID} is at version 7, not 3; run get-diagram for the latest source\n")
        self.assertNotIn(MARKER, out + err)

    def test_one_save_and_one_read_are_sent_and_nothing_is_overwritten(self) -> None:
        self.save()
        self.assertEqual([(r["method"], r["path"]) for r in self.api.requests],
                         [("PATCH", "/graphs"), ("GET", f"/graphs?diagram_id={ID}")])

    def test_the_conflict_does_not_touch_the_stored_login(self) -> None:
        before = credentials.read_credentials()
        self.save()
        self.assertEqual(credentials.read_credentials(), before)

    def test_a_missing_diagram_behind_the_409_is_an_ordinary_error(self) -> None:
        self.api.route("GET", f"/graphs?diagram_id={ID}", 404, {"error": "not_found"})
        self.assert_fails(self.save(), f"version conflict on {ID}, and the latest version could not be read: cloud diagram not found: {ID}")

    def test_a_failed_read_behind_the_409_is_an_ordinary_error(self) -> None:
        self.api.route("GET", f"/graphs?diagram_id={ID}", 500, {"message": "boom"})
        self.assert_fails(self.save(), "could not be read", "HTTP 500: boom")

    def test_an_unusable_version_in_the_read_counts_as_one(self) -> None:
        self.api.route("GET", f"/graphs?diagram_id={ID}", 200, {"graph_id": ID, "bmd": "x", "version": "soon", "group_id": GROUP})
        code, out, _ = self.save("2")
        self.assertEqual((code, json.loads(out)["latest_version"]), (3, 1))

    def test_a_login_problem_during_the_read_is_still_exit_4(self) -> None:
        # The first call goes through; every later one is rejected, so the follow-up read ends in exit 4.
        self.api.route("GET", f"/graphs?diagram_id={ID}", 200, {})
        original = self.api.accepts
        calls = []

        def accept_once(token: str) -> bool:
            calls.append(token)
            return len(calls) == 1 and original(token)

        self.api.accepts = accept_once
        code, out, err = self.save()
        self.assertEqual((code, out), (4, '{"login_required": true}\n'))


class LoginHandlingTest(WriteCase):
    def run_both(self) -> list:
        create = self.source_file("a.bmd", BOXES)
        return [run_cli("create-diagram", "--file", str(create)),
                run_cli("save-diagram", "--diagram-id", ID, "--file", str(create), "--expected-version", "2")]

    def serve(self) -> None:
        self.api.route("POST", "/graphs", 200, saved_row())
        self.api.route("PATCH", "/graphs", 200, saved_row(version=3))

    def test_without_a_login_both_are_exit_4_and_nothing_is_sent(self) -> None:
        import os
        os.unlink(credentials.locate_credentials())
        for code, out, err in self.run_both():
            self.assertEqual((code, out), (4, '{"login_required": true}\n'))
            self.assertIn("run login", err)
        self.assertEqual((self.api.requests, self.auth.requests), ([], []))

    def test_an_expired_token_is_refreshed_before_each_write(self) -> None:
        self.serve()
        create = self.source_file("a.bmd", BOXES)
        self.store_login(exp=self.expired())
        self.assertEqual(run_cli("create-diagram", "--file", str(create))[0], 0)
        self.store_login(exp=self.expired())
        self.assertEqual(run_cli("save-diagram", "--diagram-id", ID, "--file", str(create), "--expected-version", "2")[0], 0)
        self.assertEqual(self.auth.refreshes, 2)

    def test_a_revoked_token_is_refreshed_and_the_same_write_is_sent_again(self) -> None:
        self.serve()
        self.auth.valid_access_tokens.discard(credentials.read_credentials()["access_token"])
        code, out, err = run_cli("save-diagram", "--diagram-id", ID, "--file", str(self.source_file("a.bmd", BOXES)),
                                 "--expected-version", "2")
        self.assertEqual((code, err), (0, ""))
        first, second = self.api.requests
        self.assertEqual((first["method"], first["path"], first["body"]), (second["method"], second["path"], second["body"]))
        self.assertNotEqual(first["authorization"], second["authorization"])
        self.assertEqual(self.auth.refreshes, 1)

    def test_a_refused_login_is_exit_4_after_one_retry(self) -> None:
        self.serve()
        self.api.reject_all = True
        for code, out, err in self.run_both():
            self.assertEqual((code, out, err), (4, '{"login_required": true}\n', token_manager.REFUSED + "\n"))


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
        self.assertEqual(self.api.requests, [])


if __name__ == "__main__":
    unittest.main()
