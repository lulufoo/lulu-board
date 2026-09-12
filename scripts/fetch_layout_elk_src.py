#!/usr/bin/env python3
"""Fetch pinned @mermaid-js/layout-elk TypeScript sources into packages/mermaid-vendor."""
from __future__ import annotations

import hashlib
import shutil
import tarfile
import tempfile
import urllib.request
from pathlib import Path

VENDOR = Path(__file__).resolve().parents[1] / "packages" / "mermaid-vendor"
PIN = VENDOR / "mermaid-layout-elk" / "LAYOUT_ELK_SRC_PIN"
DEST = VENDOR / "mermaid-layout-elk"
KEEP_SRC = frozenset({"layouts.ts", "render.ts", "find-common-ancestor.ts"})


def read_pin() -> dict[str, str]:
    out: dict[str, str] = {}
    for raw in PIN.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip()
    for key in ("tarball", "sha256", "path"):
        if not out.get(key):
            raise SystemExit(f"missing {key} in {PIN}")
    return out


def main() -> None:
    pin = read_pin()
    pin_text = PIN.read_text(encoding="utf-8")
    vendor_md = (DEST / "VENDOR.md").read_text(encoding="utf-8") if (DEST / "VENDOR.md").exists() else ""
    tsconfig = (DEST / "tsconfig.json").read_text(encoding="utf-8") if (DEST / "tsconfig.json").exists() else ""
    with tempfile.TemporaryDirectory() as tmp:
        tgz = Path(tmp) / "src.tgz"
        print(f"fetch {pin['tarball']}")
        urllib.request.urlretrieve(pin["tarball"], tgz)
        digest = hashlib.sha256(tgz.read_bytes()).hexdigest()
        if digest != pin["sha256"]:
            raise SystemExit(f"sha256 mismatch: got {digest}")
        with tarfile.open(tgz, "r:gz") as tf:
            tf.extractall(tmp)
        roots = [p for p in Path(tmp).iterdir() if p.is_dir()]
        root = next(p for p in roots if (p / pin["path"]).is_dir())
        pkg = root / pin["path"]
        if DEST.exists():
            shutil.rmtree(DEST)
        DEST.mkdir(parents=True)
        for name in ("package.json", "README.md"):
            if (pkg / name).exists():
                shutil.copy2(pkg / name, DEST / name)
        lic = pkg / "LICENSE" if (pkg / "LICENSE").exists() else root / "LICENSE"
        shutil.copy2(lic, DEST / "LICENSE")
        (DEST / "src").mkdir()
        for name in KEEP_SRC:
            shutil.copy2(pkg / "src" / name, DEST / "src" / name)
        PIN.write_text(pin_text, encoding="utf-8")
        if vendor_md:
            (DEST / "VENDOR.md").write_text(vendor_md, encoding="utf-8")
        if tsconfig:
            (DEST / "tsconfig.json").write_text(tsconfig, encoding="utf-8")
        print(f"ok {DEST} ({pin.get('package')})")


if __name__ == "__main__":
    main()
