#!/usr/bin/env python3
"""Fetch pinned mermaid + parser production sources into packages/mermaid-vendor."""
from __future__ import annotations

import hashlib
import shutil
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path

VENDOR = Path(__file__).resolve().parents[1] / "packages" / "mermaid-vendor"
PIN = VENDOR / "MERMAID_SRC_PIN"
DEST_MERMAID = VENDOR / "mermaid"
DEST_PARSER = VENDOR / "parser"

KEEP_EXTRACT_TOP = frozenset({"LICENSE", "packages"})
KEEP_PACKAGES = frozenset({"mermaid", "parser"})
KEEP_MERMAID = frozenset({"LICENSE", "package.json", "tsconfig.json", "src"})
KEEP_PARSER = frozenset(
    {"LICENSE", "package.json", "tsconfig.json", "langium-config.json", "src"}
)
DROP_IN_SRC = frozenset({"docs", "vitepress", "tests", "__mocks__"})
TEST_SUFFIXES = (".spec.ts", ".spec.js", ".spec.mjs", ".test.ts", ".test.js")


def read_pin() -> dict[str, str]:
    out: dict[str, str] = {}
    for raw in PIN.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        out[key.strip()] = value.strip()
    for key in ("tag", "tarball", "sha256"):
        if not out.get(key):
            raise SystemExit(f"missing {key} in {PIN}")
    return out


def _remove(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)


def _keep_children(parent: Path, names: frozenset[str]) -> None:
    if not parent.is_dir():
        return
    for child in list(parent.iterdir()):
        if child.name not in names:
            _remove(child)


def _drop_tests(root: Path) -> None:
    src = root / "src"
    if src.is_dir():
        for name in DROP_IN_SRC:
            extra = src / name
            if extra.exists():
                _remove(extra)
    for path in root.rglob("*"):
        if path.is_file() and path.name.endswith(TEST_SUFFIXES):
            path.unlink()


def prune_mermaid(pkg: Path) -> None:
    _keep_children(pkg, KEEP_MERMAID)
    _drop_tests(pkg)


def prune_parser(pkg: Path) -> None:
    _keep_children(pkg, KEEP_PARSER)
    _drop_tests(pkg)


def prune_extract(root: Path) -> None:
    _keep_children(root, KEEP_EXTRACT_TOP)
    _keep_children(root / "packages", KEEP_PACKAGES)
    prune_mermaid(root / "packages" / "mermaid")
    prune_parser(root / "packages" / "parser")


def _replace_dir(src: Path, dest: Path) -> None:
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest)


def lift_from_extract(root: Path) -> None:
    mermaid = root / "packages" / "mermaid"
    parser = root / "packages" / "parser"
    if not mermaid.is_dir() or not parser.is_dir():
        raise SystemExit(f"extract missing packages: {root}")
    license_file = root / "LICENSE"
    staging_m = VENDOR / ".lift-mermaid"
    staging_p = VENDOR / ".lift-parser"
    for staging in (staging_m, staging_p):
        if staging.exists():
            shutil.rmtree(staging)
    shutil.copytree(mermaid, staging_m)
    shutil.copytree(parser, staging_p)
    if license_file.is_file():
        shutil.copy2(license_file, staging_m / "LICENSE")
    _replace_dir(staging_m, DEST_MERMAID)
    _replace_dir(staging_p, DEST_PARSER)
    shutil.rmtree(staging_m)
    shutil.rmtree(staging_p)
    prune_mermaid(DEST_MERMAID)
    prune_parser(DEST_PARSER)


def fetch() -> None:
    pin = read_pin()
    VENDOR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tgz = Path(tmp) / "mermaid.tgz"
        urllib.request.urlretrieve(pin["tarball"], tgz)
        digest = hashlib.sha256(tgz.read_bytes()).hexdigest()
        if digest != pin["sha256"]:
            raise SystemExit(f"sha256 mismatch: {digest} != {pin['sha256']}")
        extract = Path(tmp) / "extract"
        extract.mkdir()
        with tarfile.open(tgz, "r:gz") as archive:
            archive.extractall(extract)
        roots = [p for p in extract.iterdir() if p.is_dir()]
        if len(roots) != 1:
            raise SystemExit(f"expected one tarball root, got {roots}")
        prune_extract(roots[0])
        lift_from_extract(roots[0])
    print(f"ok {pin['tag']} -> {DEST_MERMAID} + {DEST_PARSER}")


def main() -> None:
    if sys.argv[1:] == ["--prune"]:
        if (DEST_MERMAID / "packages" / "mermaid").is_dir():
            lift_from_extract(DEST_MERMAID)
        else:
            if not DEST_MERMAID.is_dir() or not DEST_PARSER.is_dir():
                raise SystemExit(f"missing {DEST_MERMAID} or {DEST_PARSER}")
            prune_mermaid(DEST_MERMAID)
            prune_parser(DEST_PARSER)
        print(f"pruned {DEST_MERMAID} {DEST_PARSER}")
        return
    fetch()


if __name__ == "__main__":
    main()
