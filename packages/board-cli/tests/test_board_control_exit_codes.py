"""board_control.main: how a LoginRequired and an ordinary failure leave the process."""
from __future__ import annotations

import argparse
import unittest
from unittest.mock import patch

from board_cli_support import HomeCase, run_cli
from board_cli import board_control
from board_cli.cli_errors import LoginRequired


def parser_whose_command_raises(error: BaseException):
    def build() -> argparse.ArgumentParser:
        parser = argparse.ArgumentParser(prog="board-cli")
        sub = parser.add_subparsers(dest="command", required=True)

        def run(args: argparse.Namespace) -> None:
            raise error

        sub.add_parser("cloud").set_defaults(run=run)
        return parser
    return build


class ExitCodeTest(HomeCase):
    def run_failing(self, error: BaseException) -> tuple:
        with patch.object(board_control, "build_parser", parser_whose_command_raises(error)):
            return run_cli("cloud")

    def test_login_required_is_exit_4_with_the_marker_on_stdout(self) -> None:
        code, out, err = self.run_failing(LoginRequired("not logged in; run login first"))
        self.assertEqual((code, out), (4, '{"login_required": true}\n'))
        self.assertEqual(err, "not logged in; run login first\n")

    def test_an_ordinary_runtime_error_is_exit_1_with_nothing_on_stdout(self) -> None:
        code, out, err = self.run_failing(RuntimeError("cannot reach somewhere"))
        self.assertEqual((code, out, err), (1, "", "cannot reach somewhere\n"))

    def test_an_os_error_is_exit_1(self) -> None:
        code, out, err = self.run_failing(PermissionError("denied"))
        self.assertEqual((code, out), (1, ""))

    def test_login_required_is_still_a_runtime_error_for_callers_that_do_not_care(self) -> None:
        self.assertTrue(issubclass(LoginRequired, RuntimeError))

    def test_help_documents_exit_4_and_the_refresh_rules(self) -> None:
        _, out, _ = run_cli("--help")
        for text in ("exit 4", '{"login_required": true}', "60 seconds", "credentials.lock", "401"):
            self.assertIn(text, out)

    def test_the_local_commands_never_give_exit_4(self) -> None:
        for argv in (("whoami",), ("--version",)):
            self.assertEqual(run_cli(*argv)[0], 0, argv)


if __name__ == "__main__":
    unittest.main()
