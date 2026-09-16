"""Local server process and HTTP API."""
from __future__ import annotations

import fcntl
import json
import os
import shutil
import signal
import subprocess
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import ProxyHandler, build_opener

from drawer_ctl import paths

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MAX_EXPORT_PNG_BYTES = 64_000_000
VENDOR_FILES = (
    "board.min.js",
    "snapdom.mjs",
    "drawer-app.css",
    "drawer-app.js",
    "drawer-app-early-head.js",
    "drawer-app-early-hydrate.js",
)
SERVE_COMMAND = "_board_serve"


def is_valid_png_export(data: bytes) -> bool:
    return len(data) > len(PNG_SIGNATURE) and data.startswith(PNG_SIGNATURE)


def read_server():
    try:
        data = json.loads(paths.server_path().read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def pid_alive(pid) -> bool:
    if not isinstance(pid, int) or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        return False


def write_server(pid: int, port: int) -> None:
    payload = {
        "pid": pid,
        "port": port,
        "root": str(paths.STATE_DIR),
        "kind": "draw-serve-v2",
        "url": f"http://127.0.0.1:{port}/{paths.VIEWER_FILE}",
    }
    temp = paths.server_path().with_suffix(".json.tmp")
    temp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    temp.replace(paths.server_path())


def _cmdline(pid: int) -> str:
    try:
        return subprocess.check_output(
            ["ps", "-p", str(pid), "-o", "command="],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return ""


def is_drawer_serve_pid(pid: int) -> bool:
    """True if pid looks like this skill's `drawer_control.py _board_serve`."""
    if not pid_alive(pid):
        return False
    cmd = _cmdline(pid)
    return "drawer_control.py" in cmd and SERVE_COMMAND in cmd


def list_drawer_serve_pids() -> list[int]:
    """All live Board `_board_serve` PIDs on this machine (not only server.json)."""
    try:
        out = subprocess.check_output(
            ["pgrep", "-f", f"drawer_control.py {SERVE_COMMAND}"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.CalledProcessError):
        return []
    pids: list[int] = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            pid = int(line)
        except ValueError:
            continue
        if is_drawer_serve_pid(pid):
            pids.append(pid)
    return pids


def _pids_listening_on_port(port: int) -> list[int]:
    try:
        out = subprocess.check_output(
            ["lsof", "-nP", f"-iTCP:{int(port)}", "-sTCP:LISTEN", "-t"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.CalledProcessError):
        return []
    pids: list[int] = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            pids.append(int(line))
        except ValueError:
            continue
    return pids


def serve_pid_on_port(port: int) -> int | None:
    """Our `_board_serve` listening on port, if any."""
    for pid in _pids_listening_on_port(port):
        if is_drawer_serve_pid(pid):
            return pid
    return None


def port_busy_by_foreign(port: int) -> bool:
    """True when something other than our drawer serve holds the port."""
    pids = _pids_listening_on_port(port)
    if not pids:
        return False
    return not any(is_drawer_serve_pid(pid) for pid in pids)


def _kill_pid(pid: int) -> None:
    if not pid_alive(pid):
        return
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    deadline = time.monotonic() + 2
    while pid_alive(pid) and time.monotonic() < deadline:
        time.sleep(0.05)
    if pid_alive(pid):
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def stop_other_serves(keep_pid: int | None = None) -> None:
    """Kill every Board `_board_serve` except keep_pid (orphan sweep)."""
    for pid in list_drawer_serve_pids():
        if keep_pid is not None and pid == keep_pid:
            continue
        _kill_pid(pid)


def stop_server() -> None:
    """Stop all Board `_board_serve` processes and clear server.json."""
    stop_other_serves(keep_pid=None)
    info = read_server()
    if info and pid_alive(info.get("pid")):
        _kill_pid(int(info["pid"]))
    try:
        paths.server_path().unlink()
    except FileNotFoundError:
        pass


def mount_lock_path() -> Path:
    return paths.STATE_DIR / "mount.lock"


def server_ready(url: str, process: subprocess.Popen) -> bool:
    deadline = time.monotonic() + 4
    opener = build_opener(ProxyHandler({}))
    while time.monotonic() < deadline:
        if process.poll() is not None:
            return False
        try:
            with opener.open(url, timeout=0.4) as response:
                return response.status == 200
        except (OSError, URLError):
            time.sleep(0.08)
    return False


def with_mount_lock(fn):
    """Serialize mount/stop so parallel callers cannot orphan serves."""
    paths.STATE_DIR.mkdir(parents=True, exist_ok=True)
    lock = mount_lock_path()
    with open(lock, "a+", encoding="utf-8") as fh:
        fcntl.flock(fh.fileno(), fcntl.LOCK_EX)
        try:
            return fn()
        finally:
            fcntl.flock(fh.fileno(), fcntl.LOCK_UN)


def sync_assets() -> None:
    paths.STATE_DIR.mkdir(parents=True, exist_ok=True)
    if not paths.asset_path().is_file():
        raise RuntimeError(f"viewer asset missing: {paths.asset_path()}")
    shutil.copyfile(paths.asset_path(), paths.STATE_DIR / paths.VIEWER_FILE)
    for name in ("favicon.svg", "favicon-32.png", "favicon.ico"):
        src = paths.asset_path().parent / name
        if not src.is_file():
            raise RuntimeError(f"viewer asset missing: {src}")
        shutil.copyfile(src, paths.STATE_DIR / name)
    vendor_dir = paths.asset_path().parent / "vendor"
    vendor_dest = paths.STATE_DIR / "vendor"
    vendor_dest.mkdir(parents=True, exist_ok=True)
    for name in VENDOR_FILES:
        src = vendor_dir / name
        if not src.is_file():
            raise RuntimeError(f"viewer vendor missing: {src}")
        shutil.copyfile(src, vendor_dest / name)
    legacy = vendor_dest / "board-html"
    if legacy.exists():
        shutil.rmtree(legacy)


from drawer_ctl.serve_http import run_serve  # noqa: E402
