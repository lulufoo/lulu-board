"""Legacy envelope backfill (called from pointer models)."""
from __future__ import annotations

from document_meta import ID_RE, correct_envelope
from drawer_ctl import paths
from drawer_ctl import util
from drawer_ctl import document
from drawer_ctl import mermaid
from drawer_ctl import board

def migrate_document_envelopes() -> dict:
    """One-shot: canonicalize envelope tokens; mint when a record has none."""
    n_board = 0
    n_mermaid = 0
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
    for mmd in paths.mermaid_history_records():
        try:
            too_big = mmd.stat().st_size > paths.HISTORY_SOURCE_READ_CAP
        except OSError:
            continue
        if too_big:
            mermaid.ensure_history_entry_meta(mmd)
            continue
        raw = util.read_text_capped(mmd)
        if not raw:
            continue
        side = mermaid._read_history_sidecar(mmd)
        sid = str(side.get("id") or "").strip()
        if not ID_RE["mermaid"].match(sid):
            sid = util.new_diagram_id()
        out, changed = correct_envelope(raw, "mermaid", sid)
        if changed:
            util.write_text_atomic(mmd, out)
            n_mermaid += 1
        mermaid.ensure_history_entry_meta(mmd)
    board_meta = board.read_board_meta()
    rec = board.board_record_path_from_meta(board_meta)
    if rec is not None:
        live = document.envelope_live_fields(rec, "board")
        if live:
            board_meta["id"] = live["id"]
            board_meta["version"] = live["version"]
            board_meta["rev"] = live["version"]
            board.write_board_meta(board_meta)
    mermaid_meta = mermaid.read_meta_raw()
    mrec = mermaid.mermaid_record_path_from_meta(mermaid_meta)
    if mrec is not None:
        live = document.envelope_live_fields(mrec, "mermaid")
        if live:
            mermaid_meta["id"] = live["id"]
            mermaid_meta["version"] = live["version"]
            mermaid_meta["rev"] = live["version"]
            mermaid.write_meta(mermaid_meta)
    return {"ok": True, "board": n_board, "mermaid": n_mermaid}




