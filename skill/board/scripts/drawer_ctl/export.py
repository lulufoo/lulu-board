"""Shared PNG / SVG export writers."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from drawer_ctl import paths
from drawer_ctl import util


def write_export_file(data: bytes, stem: str | None, suffix: str) -> Path:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = paths.export_dir() / f"{ts}-{util.sanitize_stem(stem)}{suffix}"
    dest.write_bytes(data)
    return dest.resolve()


def write_export_svg(text: str, stem: str | None = None) -> Path:
    return write_export_file(text.encode("utf-8"), stem, ".svg")


def write_export_png(data: bytes, stem: str | None = None) -> Path:
    return write_export_file(data, stem, ".png")
