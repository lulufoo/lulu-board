"""All five cloud commands handle the login the same way: refresh, retry once, or exit 4 with the address."""
from __future__ import annotations

import json
import os
import unittest

from board_cli_support import run_cli
from cloud_support import CloudCase
from board_cli.auth import credentials, token_manager

ID = "b_0fc10001"
GROUP = "g_99aabbcc"
DOC = {"diagram_id": ID, "title": "T", "bmd": 'boxes "x"\n', "version": 2, "updated_at": "now", "group_id": GROUP}
TOOLS = {"get_diagram": DOC, "get_group": {"group_id": GROUP, "members": []}, "search_diagrams": [],
         "create_diagram": DOC, "save_diagram": {"conflict": False, "row": DOC}}


class LoginHandlingCase(CloudCase):
    def setUp(self) -> None:
        super().setUp()
        self.store_login()
        for name, answer in TOOLS.items():
            self.mcp.answer_tool(name, answer)
        source = str(self.put("a.bmd", 'boxes "x"\n'))
        self.commands = {
            "get_diagram": ("get-diagram", "--diagram-id", ID, "--out", str(self.dir / "out")),
            "get_group": ("get-group", "--diagram-id", ID),
            "search_diagrams": ("search-diagrams", "--query", "plan"),
            "create_diagram": ("create-diagram", "--file", source),
            "save_diagram": ("save-diagram", "--diagram-id", ID, "--file", source, "--expected-version", "2"),
        }

    def each(self):
        """Yield (tool, argv) for the five commands."""
        yield from self.commands.items()


class NoLoginTest(LoginHandlingCase):
    def test_each_command_is_exit_4_with_the_address_after_one_probe_and_no_call(self) -> None:
        os.unlink(credentials.locate_credentials())
        for tool, argv in self.each():
            before = len(self.mcp.requests)
            code, out, err = run_cli(*argv)
            self.assertEqual(code, 4, tool)
            self.assertEqual(json.loads(out), {"login_required": True, "resource_metadata": self.mcp.metadata_url}, tool)
            self.assertEqual(err, f"not logged in; run login --resource-metadata-url {self.mcp.metadata_url}\n", tool)
            self.assertEqual(self.mcp.list_methods()[before:], ["tools/list"], tool)
        self.assertEqual(self.auth.requests, [])


class RefreshTest(LoginHandlingCase):
    def test_an_expired_token_is_refreshed_before_each_call(self) -> None:
        for tool, argv in self.each():
            self.store_login(exp=self.expired())
            self.assertEqual(run_cli(*argv)[0], 0, tool)
        self.assertEqual(self.auth.refreshes, 5)

    def test_a_revoked_token_is_refreshed_and_the_same_call_is_sent_again(self) -> None:
        for index, (tool, argv) in enumerate(self.each(), start=1):
            stale = credentials.read_credentials()["access_token"]
            self.auth.valid_access_tokens.discard(stale)
            code, _, err = run_cli(*argv)
            self.assertEqual((code, err), (0, ""), tool)
            self.assertEqual(self.auth.refreshes, index, tool)
            first, second = self.mcp.list_calls(tool)[-2:]
            self.assertEqual(first, second, tool)  # the same arguments, sent again


class RefusedLoginTest(LoginHandlingCase):
    def test_a_login_the_server_keeps_refusing_is_exit_4_after_one_refresh_and_one_retry(self) -> None:
        self.mcp.reject_all = True
        for index, (tool, argv) in enumerate(self.each(), start=1):
            code, out, err = run_cli(*argv)
            self.assertEqual(code, 4, tool)
            self.assertEqual(json.loads(out), {"login_required": True, "resource_metadata": self.mcp.metadata_url}, tool)
            self.assertEqual(err, f"the login is no longer valid; run login --resource-metadata-url {self.mcp.metadata_url}\n", tool)
            self.assertEqual(self.auth.refreshes, index, tool)
        self.assertEqual(self.mcp.list_methods(), ["tools/call"] * 10)

    def test_a_refresh_token_the_server_refuses_is_exit_4_and_the_tokens_stay(self) -> None:
        stale = credentials.read_credentials()["access_token"]
        self.auth.valid_access_tokens.discard(stale)
        self.auth.live_refresh.clear()
        for tool, argv in self.each():
            code, out, _ = run_cli(*argv)
            self.assertEqual((code, json.loads(out)["login_required"]), (4, True), tool)
        self.assertEqual(credentials.read_credentials()["access_token"], stale)


if __name__ == "__main__":
    unittest.main()
