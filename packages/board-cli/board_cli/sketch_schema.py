#!/usr/bin/env python3
"""Sketch Source (SKT) format and its files.

SKT Source is the text the viewer and the cloud tools store for one Sketch:

  style <token>        camera and appearance; optional
  sketch "<title>"     the diagram title; the quotes hold it
  content <token>      the HTML fragment, encoded

This module owns that format. It builds and parses the source, cleans titles,
and reads and writes the HTML and SKT files. Only board_control.py's commands
call it. They create each file new, at a path they choose.
"""
from __future__ import annotations

import base64
import re
from pathlib import Path

STYLE_LINE = re.compile(r"^(?:%%\s*)?style\s+(\S+)\s*$", re.IGNORECASE)
TITLE_LINE = re.compile(r'^\s*sketch\s+"([^"]*)"')
CONTENT_LINE = re.compile(r"^content\s+(\S+)\s*$", re.IGNORECASE)
SOURCE_START = re.compile(r'^(?:style\s+\S+\s*$|sketch\s+")', re.IGNORECASE)


class SketchError(RuntimeError):
    """A failure the CLI reports in one line before it exits 1."""


def clean_title(raw: str) -> str:
    """Make a title the viewer can read back: no double quote, no line break."""
    title = re.sub(r"[\r\n]+", " ", str(raw or "").replace('"', "'")).strip()
    if not title:
        raise SketchError("--title must not be empty")
    return title


def clean_style(raw: str | None) -> str:
    """Return the style token, or an empty string when there is none."""
    token = str(raw or "").strip()
    if re.search(r"\s", token):
        raise SketchError("--style must be one token without spaces")
    return token


def is_sketch_source(text: str) -> bool:
    """True when the first line starts SKT Source instead of an HTML fragment."""
    for line in str(text or "").splitlines():
        if line.strip():
            return bool(SOURCE_START.match(line.strip()))
    return False


def build_source(html: str, title: str, style: str = "") -> str:
    """Assemble SKT Source from an HTML fragment."""
    lines = []
    token = clean_style(style)
    if token:
        lines.append("style " + token)
    lines.append('sketch "' + clean_title(title) + '"')
    lines.append("content " + base64.b64encode(html.encode("utf-8")).decode("ascii"))
    return "\n".join(lines) + "\n"


def parse_source(text: str) -> dict[str, str]:
    """Read SKT Source into title, style, and html. A damaged content fails."""
    style: str | None = None
    title: str | None = None
    content: str | None = None
    for raw in str(text or "").replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = raw.strip()
        if style is None:
            hit = STYLE_LINE.match(line)
            if hit:
                style = hit.group(1)
                continue
        if title is None:
            hit = TITLE_LINE.match(line)
            if hit:
                title = hit.group(1)
                continue
        if content is None:
            hit = CONTENT_LINE.match(line)
            if hit:
                content = hit.group(1)
    if title is None:
        raise SketchError('SKT Source has no sketch "<title>" line')
    if content is None:
        raise SketchError("SKT Source has no content line")
    try:
        html = base64.b64decode(content, validate=True).decode("utf-8")
    except ValueError as err:  # a bad base64 token and bad UTF-8 are both ValueError
        raise SketchError("SKT content is damaged and does not decode") from err
    return {"title": title, "style": style or "", "html": html}


def read_file(path: str, what: str) -> str:
    """Read one UTF-8 file as is. A missing or empty file fails."""
    try:
        with open(path, encoding="utf-8", newline="") as handle:
            text = handle.read()
    except FileNotFoundError as err:
        raise SketchError(f"{what} file not found: {path}") from err
    except (OSError, ValueError) as err:
        raise SketchError(f"cannot read {what} file {path}: {err}") from err
    if not text.strip():
        raise SketchError(f"{what} file is empty: {path}")
    return text


def write_file(path: Path, text: str) -> None:
    """Write one UTF-8 file as is, creating its folder."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="") as handle:
            handle.write(text)
    except OSError as err:
        raise SketchError(f"cannot write {path}: {err}") from err


def create_file(path: Path, text: str) -> None:
    """Create one new UTF-8 file as is, with its folder. A file already there fails."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "x", encoding="utf-8", newline="") as handle:
            handle.write(text)
    except FileExistsError as err:
        raise SketchError(f"output file already exists, run again: {path}") from err
    except OSError as err:
        raise SketchError(f"cannot write {path}: {err}") from err


def read_html(path: str) -> str:
    """Read an HTML fragment file. SKT Source in its place is refused."""
    html = read_file(path, "HTML")
    if is_sketch_source(html):
        raise SketchError("--file holds Sketch source; give the HTML fragment")
    return html


def encode_to(html_path: str, title: str, style: str, out_path: Path) -> dict[str, str]:
    """Create the SKT file at out_path for an HTML file; return title, style, and file."""
    source = build_source(read_html(html_path), title, style)
    create_file(out_path, source)
    return {"title": clean_title(title), "style": clean_style(style), "file": str(out_path)}


def decode_to(skt_path: str, out_path: Path) -> dict[str, str]:
    """Create the HTML file at out_path for a SKT file; return title, style, and file."""
    parsed = parse_source(read_file(skt_path, "SKT"))
    create_file(out_path, parsed["html"])
    return {"title": parsed["title"], "style": parsed["style"], "file": str(out_path)}
