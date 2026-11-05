"""credential_lock: one holder at a time, released on every way out, modes set in code."""
from __future__ import annotations

import os
import stat
import subprocess
import sys
import threading
import time
import unittest
from pathlib import Path

from board_cli_support import HomeCase
from board_cli import credential_lock, credentials


class LockTest(HomeCase):
    def test_the_lock_file_is_0600_in_a_0700_directory(self) -> None:
        with credential_lock.hold_lock(1):
            pass
        path = credentials.locate_config_dir() / credential_lock.LOCK_NAME
        self.assertEqual(stat.S_IMODE(os.stat(path).st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(os.stat(path.parent).st_mode), 0o700)

    def test_a_looser_umask_does_not_loosen_the_lock_file(self) -> None:
        old = os.umask(0)
        self.addCleanup(os.umask, old)
        with credential_lock.hold_lock(1):
            pass
        path = credentials.locate_config_dir() / credential_lock.LOCK_NAME
        self.assertEqual(stat.S_IMODE(os.stat(path).st_mode), 0o600)

    def test_a_lock_file_left_with_loose_modes_is_tightened(self) -> None:
        directory = credentials.locate_config_dir()
        directory.mkdir(parents=True)
        path = directory / credential_lock.LOCK_NAME
        path.write_text("")
        os.chmod(path, 0o644)
        with credential_lock.hold_lock(1):
            pass
        self.assertEqual(stat.S_IMODE(os.stat(path).st_mode), 0o600)

    def test_it_is_released_after_the_block(self) -> None:
        with credential_lock.hold_lock(1):
            pass
        with credential_lock.hold_lock(0.2):
            pass

    def test_it_is_released_when_the_block_fails(self) -> None:
        with self.assertRaises(ValueError):
            with credential_lock.hold_lock(1):
                raise ValueError("boom")
        with credential_lock.hold_lock(0.2):
            pass

    def test_a_second_holder_waits_and_then_gets_it(self) -> None:
        order: list[str] = []

        def second() -> None:
            with credential_lock.hold_lock(5):
                order.append("second")

        with credential_lock.hold_lock(1):
            thread = threading.Thread(target=second)
            thread.start()
            time.sleep(0.3)
            order.append("first done")
        thread.join(timeout=10)
        self.assertEqual(order, ["first done", "second"])

    def test_a_holder_that_never_lets_go_fails_the_waiter_after_its_time(self) -> None:
        with credential_lock.hold_lock(1):
            started = time.monotonic()
            with self.assertRaisesRegex(RuntimeError, r"another board-cli has held .*credentials\.lock for 0\.3 seconds"):
                with credential_lock.hold_lock(0.3):
                    self.fail("the lock was granted twice")
            self.assertTrue(0.25 <= time.monotonic() - started < 3)

    def test_the_directory_is_made_when_missing(self) -> None:
        self.assertFalse(credentials.locate_config_dir().exists())
        with credential_lock.hold_lock(1):
            self.assertTrue(credentials.locate_config_dir().is_dir())

    def test_the_lock_file_is_not_the_credential_file(self) -> None:
        with credential_lock.hold_lock(1):
            self.assertIsNone(credentials.read_credentials())


HOLDER = """
import sys, time
sys.path.insert(0, {root!r})
from board_cli import credential_lock
with credential_lock.hold_lock(30):
    with open({log!r}, "a") as log:
        log.write("start\\n"); log.flush()
    time.sleep({seconds})
    with open({log!r}, "a") as log:
        log.write("end\\n"); log.flush()
"""


class ProcessTest(HomeCase):
    """The lock works between real processes, which is what it is for."""

    def start_holder(self, log, seconds: float) -> subprocess.Popen:
        script = HOLDER.format(root=str(Path(__file__).resolve().parents[1]), log=str(log), seconds=seconds)
        holder = subprocess.Popen([sys.executable, "-c", script], env=self.env_with_home())
        self.addCleanup(holder.wait)
        self.addCleanup(holder.kill)  # a failed test must not leave a process holding the lock
        return holder

    def test_processes_hold_it_one_at_a_time(self) -> None:
        log = self.dir / "holders.log"
        holders = [self.start_holder(log, 0.2) for _ in range(4)]
        for holder in holders:
            self.assertEqual(holder.wait(timeout=60), 0)
        self.assertEqual(log.read_text().split(), ["start", "end"] * 4)

    def test_a_killed_holder_releases_the_lock(self) -> None:
        log = self.dir / "killed.log"
        holder = self.start_holder(log, 60)
        deadline = time.monotonic() + 30
        while not log.exists() and time.monotonic() < deadline:
            time.sleep(0.05)
        self.assertTrue(log.exists(), "the holder never took the lock")
        with self.assertRaises(RuntimeError):
            with credential_lock.hold_lock(0.2):
                self.fail("the lock was granted while the holder lived")
        holder.kill()
        holder.wait(timeout=10)
        with credential_lock.hold_lock(5):
            pass


if __name__ == "__main__":
    unittest.main()
