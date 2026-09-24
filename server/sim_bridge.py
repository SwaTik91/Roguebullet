import json
import subprocess
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class SimBridge:
    def __init__(self):
        self.lock = threading.Lock()
        self.proc = None
        self.seq = 0
        self.pending = {}

    def call(self, payload):
        with self.lock:
            self._ensure()
            self.seq += 1
            msg_id = self.seq
            payload = {**payload, "id": msg_id}
            self.proc.stdin.write(json.dumps(payload, ensure_ascii=False) + "\n")
            self.proc.stdin.flush()
            while True:
                line = self.proc.stdout.readline()
                if not line:
                    self.proc = None
                    raise ValueError("Симулятор боя остановился")
                data = json.loads(line)
                if data.get("id") != msg_id:
                    continue
                if not data.get("ok"):
                    raise ValueError(data.get("error") or "Бой остановился")
                return data

    def _ensure(self):
        if self.proc and self.proc.poll() is None:
            return
        self.proc = subprocess.Popen(
            ["node", "server/sim-host.mjs"],
            cwd=str(ROOT),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
        )
