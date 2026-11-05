"""credentials.py: the local credential file."""
from __future__ import annotations

import json
import os
import stat
import unittest
from unittest.mock import patch

from board_cli_support import HomeCase
from board_cli.auth import credentials


def mode_of(path) -> int:
    return stat.S_IMODE(os.stat(path).st_mode)


class UmaskCase(HomeCase):
    def with_umask(self, mask: int) -> None:
        previous = os.umask(mask)
        self.addCleanup(os.umask, previous)


class ReadTest(HomeCase):
    def test_no_file_reads_as_none(self) -> None:
        self.assertIsNone(credentials.read_credentials())

    def test_the_location_is_under_home(self) -> None:
        self.assertEqual(credentials.locate_credentials(),
                         self.home / ".config" / "lulu-board" / "credentials.json")

    def test_a_file_that_is_not_json_is_damaged(self) -> None:
        self.put_credentials("{not json")
        with self.assertRaisesRegex(RuntimeError, "damaged"):
            credentials.read_credentials()

    def test_a_file_that_is_not_an_object_is_damaged(self) -> None:
        self.put_credentials("[1, 2]")
        with self.assertRaisesRegex(RuntimeError, "damaged"):
            credentials.read_credentials()

    def test_a_known_field_that_is_not_a_string_is_damaged(self) -> None:
        self.put_credentials(json.dumps({"access_token": 5}))
        with self.assertRaisesRegex(RuntimeError, "damaged"):
            credentials.read_credentials()

    def test_a_file_that_is_not_utf8_is_damaged(self) -> None:
        directory = credentials.locate_config_dir()
        directory.mkdir(parents=True)
        (directory / credentials.FILE_NAME).write_bytes(b"\xff\xfe\x00")
        with self.assertRaisesRegex(RuntimeError, "damaged"):
            credentials.read_credentials()

    def put_credentials(self, text: str) -> None:
        directory = credentials.locate_config_dir()
        directory.mkdir(parents=True, exist_ok=True)
        (directory / credentials.FILE_NAME).write_text(text, encoding="utf-8")


class WriteTest(UmaskCase):
    def test_an_update_creates_the_directory_as_0700_and_the_file_as_0600(self) -> None:
        credentials.update_credentials({"client_id": "c1"})
        self.assertEqual(mode_of(credentials.locate_config_dir()), 0o700)
        self.assertEqual(mode_of(credentials.locate_credentials()), 0o600)

    def test_the_modes_do_not_depend_on_the_umask(self) -> None:
        for mask in (0o000, 0o077, 0o022):
            with self.subTest(umask=oct(mask)):
                self.with_umask(mask)
                credentials.update_credentials({"client_id": "c1"})
                self.assertEqual(mode_of(credentials.locate_config_dir()), 0o700)
                self.assertEqual(mode_of(credentials.locate_credentials()), 0o600)
                os.remove(credentials.locate_credentials())
                os.rmdir(credentials.locate_config_dir())

    def test_a_loose_directory_and_file_are_tightened(self) -> None:
        directory = credentials.locate_config_dir()
        directory.mkdir(parents=True)
        os.chmod(directory, 0o755)
        (directory / credentials.FILE_NAME).write_text("{}", encoding="utf-8")
        os.chmod(directory / credentials.FILE_NAME, 0o644)
        credentials.update_credentials({"client_id": "c1"})
        self.assertEqual(mode_of(directory), 0o700)
        self.assertEqual(mode_of(credentials.locate_credentials()), 0o600)

    def test_the_stored_file_is_json_with_the_given_fields(self) -> None:
        credentials.update_credentials({"access_token": "a", "refresh_token": "r", "client_id": "c"})
        stored = json.loads(credentials.locate_credentials().read_text(encoding="utf-8"))
        self.assertEqual(stored, {"access_token": "a", "refresh_token": "r", "client_id": "c"})
        self.assertEqual(credentials.read_credentials(), stored)

    def test_an_update_keeps_the_fields_it_does_not_name(self) -> None:
        credentials.update_credentials({"client_id": "c"})
        credentials.update_credentials({"access_token": "a", "refresh_token": "r"})
        self.assertEqual(credentials.read_credentials(),
                         {"client_id": "c", "access_token": "a", "refresh_token": "r"})
        credentials.update_credentials({"access_token": "a2", "refresh_token": "r2"})
        self.assertEqual(credentials.read_credentials()["client_id"], "c")

    def test_fields_this_version_does_not_know_survive_an_update(self) -> None:
        directory = credentials.locate_config_dir()
        directory.mkdir(parents=True)
        (directory / credentials.FILE_NAME).write_text(json.dumps({"client_id": "c", "future": "x"}), encoding="utf-8")
        credentials.update_credentials({"access_token": "a"})
        self.assertEqual(credentials.read_credentials()["future"], "x")

    def test_an_update_replaces_a_damaged_file(self) -> None:
        directory = credentials.locate_config_dir()
        directory.mkdir(parents=True)
        (directory / credentials.FILE_NAME).write_text("{not json", encoding="utf-8")
        credentials.update_credentials({"client_id": "c"})
        self.assertEqual(credentials.read_credentials(), {"client_id": "c"})

    def test_unknown_or_empty_or_non_string_fields_are_refused(self) -> None:
        for bad in ({"password": "x"}, {"client_id": ""}, {"client_id": None}, {"access_token": 5}):
            with self.subTest(bad=bad), self.assertRaisesRegex(RuntimeError, "cannot store"):
                credentials.update_credentials(bad)
        self.assertIsNone(credentials.read_credentials())


class InterruptedWriteTest(HomeCase):
    def leftovers(self) -> list:
        directory = credentials.locate_config_dir()
        return sorted(p.name for p in directory.iterdir() if p.name != credentials.FILE_NAME)

    def test_a_failed_replace_keeps_the_old_file_and_leaves_no_temporary_file(self) -> None:
        credentials.update_credentials({"client_id": "old"})
        with patch("os.replace", side_effect=OSError("disk gone")), self.assertRaises(OSError):
            credentials.update_credentials({"client_id": "new"})
        self.assertEqual(credentials.read_credentials(), {"client_id": "old"})
        self.assertEqual(self.leftovers(), [])

    def test_a_write_that_dies_midway_leaves_no_credential_file(self) -> None:
        with patch("json.dump", side_effect=OSError("disk full")), self.assertRaises(OSError):
            credentials.update_credentials({"client_id": "c"})
        self.assertIsNone(credentials.read_credentials())
        self.assertEqual(self.leftovers(), [])

    def test_a_write_that_dies_midway_keeps_the_old_file(self) -> None:
        credentials.update_credentials({"client_id": "old"})
        with patch("json.dump", side_effect=OSError("disk full")), self.assertRaises(OSError):
            credentials.update_credentials({"client_id": "new"})
        self.assertEqual(credentials.read_credentials(), {"client_id": "old"})
        self.assertEqual(self.leftovers(), [])


if __name__ == "__main__":
    unittest.main()
