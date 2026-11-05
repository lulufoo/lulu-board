"""Create an anonymous short viewer URL via the public RPC."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

PUBLIC_WEB_ORIGIN = "https://luluboard.app"
SUPABASE_URL = "https://xjwlxxuafhsfzksxxmtu.supabase.co"
SUPABASE_PUBLISHABLE_KEY = "sb_publishable_sGZ1PakrjOyGKQW-9y17Yw_HWFeOsZG"
_RPC = SUPABASE_URL.rstrip("/") + "/rest/v1/rpc/create_short_link"


def create_short_url(bmd: str) -> str:
    stub = os.environ.get("LULU_BOARD_SHORT_LINK_STUB")
    if stub:
        return stub
    body = str(bmd or "")
    if not body.strip():
        raise RuntimeError("board source must not be empty")
    req = urllib.request.Request(
        _RPC,
        data=json.dumps({"p_bmd": body}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "apikey": SUPABASE_PUBLISHABLE_KEY,
            "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        raise RuntimeError("short link create failed") from err
    row = payload[0] if isinstance(payload, list) else payload
    url = str((row or {}).get("url") or "").strip()
    if not url.startswith(PUBLIC_WEB_ORIGIN + "/#p:p_"):
        raise RuntimeError("short link create failed")
    return url
