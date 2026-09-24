import argparse
import json
import random
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

from server.sim_bridge import SimBridge
from server.store import Store


def make_handler(store, battles=None):
    battles = battles if battles is not None else SimBridge()
    class Handler(BaseHTTPRequestHandler):
        def do_OPTIONS(self):
            self._send(204, b"")

        def do_GET(self):
            self._handle("GET")

        def do_POST(self):
            self._handle("POST")

        def log_message(self, fmt, *args):
            return

        def _handle(self, method):
            try:
                self._route(method)
            except ValueError as exc:
                self._send_json(400, {"error": str(exc)})

        def _route(self, method):
            path = self.path.split("?", 1)[0]
            if method == "POST" and path == "/register":
                body = self._body()
                self._send_json(200, store.register(body.get("name"), body.get("password")))
                return
            if method == "POST" and path == "/login":
                body = self._body()
                self._send_json(200, store.login(body.get("name"), body.get("password")))
                return
            if method == "GET" and path == "/me":
                self._send_json(200, {"profile": store.account_for_token(self._token())})
                return
            if method == "POST" and path == "/runs":
                now = datetime.now(timezone.utc).astimezone()
                self._send_json(200, store.claim_run(self._token(), self._body(), now))
                return
            if method == "POST" and path == "/reroll":
                body = self._body()
                self._send_json(200, store.buy_reroll(self._token(), body.get("runId"), body.get("offerLevel")))
                return
            if method == "POST" and path == "/endless":
                body = self._body()
                self._send_json(200, store.claim_endless(self._token(), body.get("level"), body.get("wave")))
                return
            if method == "POST" and path == "/hangar":
                body = self._body()
                self._send_json(200, store.buy_hangar(self._token(), body.get("key")))
                return
            if method == "POST" and path == "/shop":
                body = self._body()
                self._send_json(200, store.buy_shop(self._token(), body.get("kind"), body.get("weapon")))
                return
            if method == "POST" and path == "/chest":
                body = self._body()
                self._send_json(200, store.open_chest(self._token(), random.SystemRandom(), body.get("requestId")))
                return
            if method == "POST" and path == "/battle/start":
                body = self._body()
                token = self._token()
                profile = store.account_for_token(token)
                run_id = body.get("runId") or __import__("uuid").uuid4().hex
                taken = store.take_card(token, run_id)
                snap = battles.call({
                    "cmd": "start",
                    "token": token,
                    "profile": profile,
                    "level": body.get("level") or 1,
                    "worldW": body.get("worldW") or 720,
                    "worldH": body.get("worldH") or 1280,
                    "runId": run_id,
                    "queuedCard": taken.get("card"),
                })
                self._send_json(200, {"snap": snap.get("snap"), "profile": taken.get("profile")})
                return
            if method == "POST" and path == "/battle/sync":
                body = self._body()
                token = self._token()
                action = body.get("action") or ""
                payload = {
                    "cmd": "step",
                    "token": token,
                    "pointer": body.get("pointer") or {},
                    "speed": body.get("speed") or 1,
                    "worldW": body.get("worldW") or 0,
                    "worldH": body.get("worldH") or 0,
                    "action": action,
                    "cardId": body.get("cardId") or "",
                }
                profile = None
                if action == "reroll":
                    preview = battles.call({"cmd": "snap", "token": token})
                    snap = preview.get("snap") or {}
                    paid = store.buy_reroll(token, snap.get("runId"), snap.get("offerLevel"))
                    profile = paid.get("profile")
                    payload["action"] = "reroll"
                    payload["rerollUsed"] = paid.get("used")
                data = battles.call(payload)
                snap = data.get("snap") or {}
                endless = snap.get("endless")
                if endless:
                    claimed = store.claim_endless(token, endless.get("level"), endless.get("wave"))
                    profile = claimed.get("profile")
                    battles.call({"cmd": "clear-endless", "token": token})
                    if claimed.get("granted"):
                        snap.setdefault("toasts", []).append(f"+{claimed['granted']} кристаллов за волну {endless.get('wave')}")
                if snap.get("state") == "result" and snap.get("facts"):
                    now = datetime.now(timezone.utc).astimezone()
                    claimed = store.claim_run(token, snap["facts"], now)
                    profile = claimed.get("profile")
                    result = snap.get("result") or {}
                    result["granted"] = claimed.get("granted")
                    result["pending"] = False
                    snap["result"] = result
                self._send_json(200, {"snap": snap, "profile": profile})
                return
            if method == "POST" and path == "/cards/take":
                body = self._body()
                self._send_json(200, store.take_card(self._token(), body.get("runId")))
                return
            achievement = _suffix(path, "/achievements/", "/claim")
            if method == "POST" and achievement:
                self._send_json(200, store.claim_achievement(self._token(), achievement))
                return
            daily = _suffix(path, "/dailies/", "/claim")
            if method == "POST" and daily:
                now = datetime.now(timezone.utc).astimezone()
                self._send_json(200, store.claim_daily(self._token(), daily, now))
                return
            raise ValueError("Неизвестный запрос")

        def _token(self):
            header = self.headers.get("Authorization") if self.headers else ""
            header = header or ""
            if not header.startswith("Bearer "):
                raise ValueError("Нужна сессия")
            return header[7:].strip()

        def _body(self):
            length = self.headers.get("Content-Length") if self.headers else None
            raw = self.rfile.read(int(length)) if length else self.rfile.read()
            if not raw:
                return {}
            try:
                data = json.loads(raw.decode())
            except json.JSONDecodeError as exc:
                raise ValueError("Некорректный запрос") from exc
            if not isinstance(data, dict):
                raise ValueError("Некорректный запрос")
            return data

        def _send_json(self, status, payload):
            self._send(status, json.dumps(payload, ensure_ascii=False).encode())

        def _send(self, status, data):
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            if data:
                self.wfile.write(data)

    return Handler


def _suffix(path, prefix, suffix):
    if path.startswith(prefix) and path.endswith(suffix):
        value = path[len(prefix) : -len(suffix)]
        if value and "/" not in value:
            return value
    return ""


def serve(host, port, db_path):
    HTTPServer((host, port), make_handler(Store(db_path), SimBridge())).serve_forever()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--db", default="/var/lib/roguebullet/account.sqlite")
    args = parser.parse_args()
    serve(args.host, args.port, args.db)
