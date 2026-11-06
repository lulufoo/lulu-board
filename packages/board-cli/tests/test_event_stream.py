"""Read the events of an SSE body: framing, comments, line ends, and events without data."""
from __future__ import annotations

import unittest

import board_cli_support  # noqa: F401  (puts the package on sys.path)
from board_cli.core.event_stream import read_event_data


class EventStreamTests(unittest.TestCase):
    def test_one_event_gives_its_data(self) -> None:
        self.assertEqual(read_event_data('event: message\ndata: {"a": 1}\n\n'), ['{"a": 1}'])

    def test_events_come_in_order(self) -> None:
        self.assertEqual(read_event_data("data: one\n\ndata: two\n\n"), ["one", "two"])

    def test_comment_lines_are_skipped(self) -> None:
        self.assertEqual(read_event_data(": keepalive\n\ndata: x\n\n: again\n\n"), ["x"])

    def test_an_event_without_data_is_left_out(self) -> None:
        self.assertEqual(read_event_data("id: 0\nretry: 1000\ndata: \n\nevent: message\ndata: x\n\n"), ["x"])

    def test_data_lines_of_one_event_are_joined_with_a_line_feed(self) -> None:
        self.assertEqual(read_event_data("data: a\ndata: b\n\n"), ["a\nb"])

    def test_carriage_return_line_ends_work(self) -> None:
        self.assertEqual(read_event_data("event: message\r\ndata: x\r\n\r\ndata: y\r\r"), ["x", "y"])

    def test_one_leading_space_after_the_colon_is_dropped(self) -> None:
        self.assertEqual(read_event_data("data:x\n\ndata:  y\n\n"), ["x", " y"])

    def test_a_last_event_without_a_blank_line_is_still_read(self) -> None:
        self.assertEqual(read_event_data("data: x\n\ndata: y"), ["x", "y"])

    def test_an_id_field_is_not_data(self) -> None:
        self.assertEqual(read_event_data("id: 5\ndata: x\n\n"), ["x"])

    def test_empty_text_has_no_events(self) -> None:
        self.assertEqual(read_event_data(""), [])


if __name__ == "__main__":
    unittest.main()
