import argparse
import json
import random
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

from server.store import Store


def make_handler(store):
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
    HTTPServer((host, port), make_handler(Store(db_path))).serve_forever()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--db", default="/var/lib/roguebullet/account.sqlite")
    args = parser.parse_args()
    serve(args.host, args.port, args.db)
