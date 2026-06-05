"""Sunucuyu başlatır, hazır olunca tarayıcıyı açar."""
from __future__ import annotations

import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
URL = "http://127.0.0.1:5000/"
WAIT_SECONDS = 60


def wait_for_server() -> bool:
    deadline = time.time() + WAIT_SECONDS
    while time.time() < deadline:
        try:
            with urlopen(URL, timeout=2) as response:
                if 200 <= response.status < 500:
                    return True
        except (URLError, OSError, TimeoutError):
            pass
        time.sleep(0.5)
    return False


def main() -> int:
    app_py = ROOT / "app.py"
    if not app_py.is_file():
        print("[HATA] app.py bulunamadi.")
        return 1

    print("Sunucu baslatiliyor...")
    proc = subprocess.Popen(
        [sys.executable, str(app_py)],
        cwd=str(ROOT),
    )

    try:
        if wait_for_server():
            print(f"Tarayici aciliyor: {URL}")
            webbrowser.open(URL)
        else:
            print(f"[HATA] Sunucu {WAIT_SECONDS} saniye icinde yanit vermedi.")
            proc.terminate()
            proc.wait(timeout=5)
            return 1

        print("Kapatmak icin bu pencerede Ctrl+C basin.")
        return proc.wait()
    except KeyboardInterrupt:
        print("\nSunucu kapatiliyor...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
