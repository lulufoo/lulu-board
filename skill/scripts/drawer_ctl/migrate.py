"""Legacy envelope backfill (called from pointer models)."""
from __future__ import annotations

from document_meta import ID_RE, correct_envelope
from drawer_ctl import paths
from drawer_ctl import util
from drawer_ctl import document
from drawer_ctl import board


def migrate_document_envelopes() -> dict:
    """One-shot: canonicalize envelope tokens; mint when a record has none."""
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
        side = board._read_board_history_sidecar(dsl)
        sid = str(side.get("id") or "").strip()
        if not ID_RE["board"].match(sid):
            sid = util.new_board_id()
        out, changed = correct_envelope(raw, "board", sid)
        if changed:
            util.write_text_atomic(dsl, out)
            n_board += 1
        board.ensure_board_history_entry_meta(dsl)
    board_meta = board.read_board_meta()
    rec = board.board_record_path_from_meta(board_meta)
    if rec is not None:
        live = document.envelope_live_fields(rec, "board")
        if live:
            board_meta["id"] = live["id"]
            board_meta["version"] = live["version"]
            board_meta["rev"] = live["version"]
            board.write_board_meta(board_meta)
    return {"ok": True, "board": n_board}
