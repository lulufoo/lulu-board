"""User-facing commands: status / preview."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

from drawer_ctl import hash_url
from drawer_ctl import titles

OPEN_KINDS = (
    "flowchart",
    "mindmap",
    "sequence",
    "class",
    "state",
    "er",
    "requirement",
    "c4",
    "usecase",
    "eventmodeling",
    "railroad",
)
DEFAULT_KIND = "flowchart"


def open_viewer(url: str, mode: str = "ide") -> str:
    if mode == "none" or not url:
        return "none"
    if mode == "system":
        subprocess.run(["open", url], check=False)
        return "system"
    encoded = quote(url, safe="")
    for scheme in ("cursor", "vscode"):
        uri = f"{scheme}://vscode.simple-browser/show?url={encoded}"
        try:
            completed = subprocess.run(["open", uri], check=False, capture_output=True)
            if completed.returncode == 0:
                return "ide"
        except OSError:
            continue
    return "none"


def status():
    return {"ok": True, "kind": DEFAULT_KIND}


def resolve_preview_body(path: str | None, stdin=None) -> str | None:
    if path:
        text = Path(path).read_text(encoding="utf-8")
        if not str(text).strip():
            raise RuntimeError("source must not be empty")
        return text
    stream = sys.stdin if stdin is None else stdin
    if getattr(stream, "isatty", lambda: False)():
        return None
    text = stream.read()
    if not str(text).strip():
        return None
    return text


def preview(path, should_open: bool = True, open_mode: str | None = None, kind: str = DEFAULT_KIND, source_id: str | None = None) -> None:
    if open_mode is None:
        open_mode = "ide" if should_open else "none"
    if kind not in OPEN_KINDS:
        raise RuntimeError("invalid --kind (expected an open catalog type)")
    body = resolve_preview_body(path)
    if body is None:
        text, fields, open_kind = "", {"id": "", "title": "", "version": 0}, "current"
    else:
        text = titles.strip_leading_meta_lines(body)
        if not str(text).strip():
            raise RuntimeError("source must not be empty")
        fields = {"id": "", "title": titles.derive_title(text), "version": 1}
        open_kind = "created"
    web = hash_url.board_web_url(text, version=fields["version"]) if str(text).strip() else f"{hash_url.PUBLIC_WEB_ORIGIN}/"
    payload = {
        "ok": True,
        "kind": kind,
        "open": open_kind,
        "url": web,
        "web_url": web,
        "id": fields["id"],
        "title": fields["title"],
        "version": fields["version"],
        "rev": fields["version"],
    }
    if open_mode != "none":
        open_viewer(web, "system")
    print(json.dumps(payload, ensure_ascii=False))
