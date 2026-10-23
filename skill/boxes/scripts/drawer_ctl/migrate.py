"""Legacy history lift and leftover envelope strip (called from pointer models)."""
from __future__ import annotations

from document_meta import strip_leading_meta_lines
from drawer_ctl import paths
from drawer_ctl import util
from drawer_ctl import document
from drawer_ctl import board


def lift_nested_board_history() -> int:
    """Move history/board/* up to history/ and rewrite meta.current."""
    dest = paths.history_root()
    nested = dest / "board"
    if not nested.is_dir():
        return 0
    moved = 0
    for src in nested.iterdir():
        if not src.is_file():
            continue
        target = dest / src.name
        if target.exists():
            continue
        src.replace(target)
        moved += 1
    meta = board.read_board_meta()
    cur = str(meta.get("current") or "")
    prefix = "history/board/"
    if cur.startswith(prefix):
        meta["current"] = "history/" + cur[len(prefix) :]
        board.write_board_meta(meta)
        board.refresh_board_dsl_alias(board.board_record_path_from_meta(meta))
    try:
        next(nested.iterdir())
    except StopIteration:
        nested.rmdir()
    except OSError:
        pass
    return moved


def migrate_document_envelopes() -> dict:
    """One-shot: peel leftover envelope lines; keep id/version on the sidecar."""
    lift_nested_board_history()
    n_board = 0
    for dsl in paths.board_history_records():
        try:
            too_big = dsl.stat().st_size > paths.HISTORY_SOURCE_READ_CAP
        except OSError:
            continue
        if too_big:
            board.ensure_board_history_entry_meta(dsl)
            continue
        raw = util.read_text_capped(dsl)
        if not raw:
            continue
        board.ensure_board_history_entry_meta(dsl)
        stripped = strip_leading_meta_lines(raw)
        if stripped != raw:
            if stripped and not stripped.endswith("\n"):
                stripped += "\n"
            util.write_text_atomic(dsl, stripped)
            n_board += 1
        board.ensure_board_history_entry_meta(dsl)
    board_meta = board.read_board_meta()
    rec = board.board_record_path_from_meta(board_meta)
    if rec is not None:
        live = document.envelope_live_fields(rec, "board")
        if live:
            if live.get("id"):
                board_meta["id"] = live["id"]
            if live.get("version"):
                board_meta["version"] = live["version"]
                board_meta["rev"] = live["version"]
            board.write_board_meta(board_meta)
    return {"ok": True, "board": n_board}
