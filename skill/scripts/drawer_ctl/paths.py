"""Shared paths and mutable STATE_DIR."""
from __future__ import annotations

from pathlib import Path

STATE_DIR = Path.home() / ".cache" / "drawer"
DEFAULT_PORT = 49867  # fixed loopback; CLI --port 0 means "use this"
SERVER_FILE = "server.json"
SOURCE_FILE = "diagram.mmd"
META_FILE = "diagram.meta.json"
BOARD_SOURCE_FILE = "board.bmd"
LEGACY_BOARD_SOURCE_FILE = "board.dsl"
BOARD_META_FILE = "board.meta.json"
VIEWER_FILE = "drawer.html"
HISTORY_DIR_NAME = "history"
MERMAID_HISTORY_NAME = "mermaid"
BOARD_HISTORY_NAME = "board"
EXPORT_DIR_NAME = "export"
HISTORY_SOURCE_READ_CAP = 256_000



def skill_root() -> Path:
    """Install root: skill/ (parent of this scripts/ dir)."""
    return Path(__file__).resolve().parents[2]


def asset_path() -> Path:
    return skill_root() / "assets" / VIEWER_FILE


def server_path() -> Path:
    return STATE_DIR / SERVER_FILE


def source_path():
    return STATE_DIR / SOURCE_FILE


def board_source_path() -> Path:
    return STATE_DIR / BOARD_SOURCE_FILE


def legacy_board_source_path() -> Path:
    return STATE_DIR / LEGACY_BOARD_SOURCE_FILE


def board_history_ext(name: str) -> str:
    raw = Path(str(name or "")).name
    if raw.endswith(".bmd"):
        return raw
    if raw.endswith(".dsl"):
        return raw[:-4] + ".bmd"
    return f"{raw}.bmd"


def board_history_candidates(name: str) -> list[Path]:
    raw = board_history_ext(name)
    return [board_history_dir() / raw]


def board_history_records() -> list[Path]:
    return sorted(
        (path for path in board_history_dir().glob("*.bmd") if path.is_file()),
        key=lambda path: path.name,
        reverse=True,
    )


def read_text_capped(path: Path, cap: int = HISTORY_SOURCE_READ_CAP) -> str:
    """Read a history source without pulling a runaway file into memory."""
    try:
        with path.open("rb") as fh:
            raw = fh.read(max(1, int(cap)))
        return raw.decode("utf-8", errors="replace")
    except OSError:
        return ""


def mermaid_history_records() -> list[Path]:
    return sorted(
        (path for path in history_dir().glob("*.mmd") if path.is_file()),
        key=lambda path: path.name,
        reverse=True,
    )


def board_meta_path() -> Path:
    return STATE_DIR / BOARD_META_FILE


def history_root() -> Path:
    d = STATE_DIR / HISTORY_DIR_NAME
    d.mkdir(parents=True, exist_ok=True)
    return d


def history_dir() -> Path:
    d = history_root() / MERMAID_HISTORY_NAME
    d.mkdir(parents=True, exist_ok=True)
    return d


def board_history_dir() -> Path:
    d = history_root() / BOARD_HISTORY_NAME
    d.mkdir(parents=True, exist_ok=True)
    return d


def meta_path() -> Path:
    return STATE_DIR / META_FILE


def export_dir() -> Path:
    d = STATE_DIR / EXPORT_DIR_NAME
    d.mkdir(parents=True, exist_ok=True)
    return d


def default_board_template_path() -> Path:
    """Preferred first-run board (packed from examples/board-onboarding)."""
    return skill_root() / "assets" / "templates" / "board" / "onboarding.bmd"


def board_example_template_dir() -> Path:
    return skill_root() / "assets" / "templates" / "board"


def mermaid_example_template_dir() -> Path:
    return skill_root() / "assets" / "templates" / "mermaid"


def board_example_template_sources() -> list[Path]:
    root = board_example_template_dir()
    if not root.is_dir():
        return []
    return sorted(p for p in root.glob("*.bmd") if p.is_file())


def mermaid_example_template_sources() -> list[Path]:
    root = mermaid_example_template_dir()
    if not root.is_dir():
        return []
    return sorted(p for p in root.glob("*.mmd") if p.is_file())


