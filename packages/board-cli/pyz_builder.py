"""Build board-cli.pyz: one executable file that holds the board_cli package.

  python3 packages/board-cli/pyz_builder.py [--out DIR] [--tag TAG]

--out  directory for board-cli.pyz (default: dist next to this file, ignored by git)
--tag  fail unless TAG is board-cli-v<VERSION>; the release workflow passes the
       pushed tag, so a tag that disagrees with the code never publishes

Standard library only (zipapp). The file starts with #!/usr/bin/env python3 and
is executable, so running it needs python3 and nothing else. The archive holds
the board_cli sources only: no tests, no bytecode, not this script.
"""
from __future__ import annotations

import argparse
import sys
import zipapp
from pathlib import Path

from board_cli.version import VERSION

PACKAGE_ROOT = Path(__file__).resolve().parent
ARCHIVE_NAME = "board-cli.pyz"
TAG_PREFIX = "board-cli-v"
ENTRY = "board_cli.board_control:run"
INTERPRETER = "/usr/bin/env python3"


def name_release_tag() -> str:
    """The tag a release of this version must have."""
    return TAG_PREFIX + VERSION


def check_tag(tag: str) -> None:
    """Refuse a tag that is not the one this version releases under."""
    if tag != name_release_tag():
        raise RuntimeError(f"tag {tag!r} does not match the package version; expected {name_release_tag()!r}")


def include_file(path: Path) -> bool:
    """Keep the board_cli sources; leave out tests, bytecode, and this script."""
    return path.parts[0] == "board_cli" and "__pycache__" not in path.parts


def build_pyz(out_dir: Path) -> Path:
    """Write board-cli.pyz into out_dir (made when missing) and return its path."""
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / ARCHIVE_NAME
    zipapp.create_archive(PACKAGE_ROOT, target, interpreter=INTERPRETER, main=ENTRY, filter=include_file)
    return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="pyz_builder", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default=str(PACKAGE_ROOT / "dist"), help="output directory")
    parser.add_argument("--tag", help="fail unless the tag is board-cli-v<VERSION>")
    args = parser.parse_args(argv)
    try:
        if args.tag is not None:
            check_tag(args.tag)
        print(build_pyz(Path(args.out)))
    except (RuntimeError, OSError, zipapp.ZipAppError) as err:
        print(str(err), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
