import io
import json
import os
import tempfile
import unittest
from server.app import make_handler
from server.store import Store


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.path = tempfile.mktemp(suffix=".sqlite")
        self.store = Store(self.path)

    def tearDown(self):
        os.remove(self.path)

    def test_register_login_and_reject_bad_password(self):
        self.store.register("Ada", "secret-pass")
        session = self.store.login("ada", "secret-pass")
        self.assertEqual(session["profile"]["name"], "Ada")
        self.assertTrue(session["token"])
        with self.assertRaises(ValueError):
            self.store.login("Ada", "wrong")

    def test_claim_run_is_idempotent_and_pays_first_clear_once(self):
        token = self.store.register("Ada", "secret-pass")["token"]
        facts = {
            "runId": "run-1",
            "kills": {"circle": 1, "boss": 1},
            "wavesCleared": 6,
            "levelsCleared": 1,
            "endedLevel": 1,
            "endedWave": 6,
            "won": False,
        }
        now = "2026-09-23T12:00:00+03:00"
        first = self.store.claim_run(token, facts, now)
        second = self.store.claim_run(token, facts, now)
        self.assertEqual(first, second)
        self.assertEqual(first["granted"]["crystals"], 8 + 8 + 4)
        self.assertEqual(first["granted"]["coins"], 36)
        self.assertEqual(first["profile"]["clearedLevels"], [1])
        self.assertEqual(first["profile"]["accountLevel"], 2)
        self.assertEqual(first["profile"]["xp"], 22)
        self.assertEqual(first["profile"]["coins"], 36)

    def test_endless_claim_grants_five_once_per_level_wave(self):
        token = self.store.register("Ada", "secret-pass")["token"]
        first = self.store.claim_endless(token, 1, 3)
        self.assertEqual(first["granted"], 5)
        self.assertEqual(first["crystals"], 5)
        self.assertEqual(first["profile"]["crystals"], 5)
        second = self.store.claim_endless(token, 1, 3)
        self.assertEqual(second["granted"], 0)
        self.assertEqual(second["crystals"], 5)
        other = self.store.claim_endless(token, 1, 4)
        self.assertEqual(other["granted"], 5)
        self.assertEqual(other["crystals"], 10)
        self.assertEqual(other["profile"]["crystals"], 10)
        with self.assertRaises(ValueError):
            self.store.claim_endless(token, 0, 1)

    def test_reroll_charges_the_ladder_once_per_offer(self):
        token = self.store.register("Ada", "secret-pass")["token"]
        self.store.db.execute("UPDATE accounts SET coins = 1000, crystals = 1")
        self.store.db.commit()
        first = self.store.buy_reroll(token, "run-1", 2)
        second = self.store.buy_reroll(token, "run-1", 2)
        self.assertEqual(first["price"]["kind"], "free")
        self.assertEqual(second["price"]["kind"], "free")
        third = self.store.buy_reroll(token, "run-1", 2)
        self.assertEqual(third["price"], {"kind": "coins", "amount": 1000})
        self.assertEqual(third["profile"]["coins"], 0)
        with self.assertRaises(ValueError):
            self.store.buy_reroll(token, "run-1", 2)
        other = self.store.buy_reroll(token, "run-1", 3)
        self.assertEqual(other["price"]["kind"], "free")
        later = self.store.buy_reroll(token, "run-1", 16)
        self.assertEqual(later["price"]["kind"], "free")

    def test_parts_roll_dry_equip(self):
        token = self.store.register("Ada", "secret-pass")["token"]
        profile = self.store.account_for_token(token)
        self.assertEqual(profile["parts"], [])
        self.assertEqual(profile["loadout"], [None] * 8)
        self.assertEqual(profile["partsDry"], 0)

        seq = {"n": 0}

        def roller(_rng, _owned):
            seq["n"] += 1
            return {
                "id": f"p{seq['n']}",
                "base": "barrel",
                "baseName": "Ствол",
                "family": "gun",
                "rarity": "common",
                "affixes": [{"id": "dmg", "name": "урон", "step": 1}],
            }

        def common_roller(_rng, _owned):
            return {
                "id": "c1",
                "base": "core",
                "baseName": "Ядро",
                "family": None,
                "rarity": "common",
                "affixes": [],
            }

        lucky = lambda: 0.1
        dry = lambda: 0.9

        first = self.store.roll_part(token, "run-a", "level", 1, None, lucky, roller=roller)
        self.assertIsNotNone(first["part"])
        self.assertEqual(first["part"]["id"], "p1")
        self.assertEqual(len(first["profile"]["parts"]), 1)
        again = self.store.roll_part(token, "run-a", "level", 1, None, lucky, roller=roller)
        self.assertEqual(again["part"]["id"], "p1")
        self.assertEqual(len(again["profile"]["parts"]), 1)

        for level in range(2, 7):
            out = self.store.roll_part(token, "run-a", "level", level, None, dry, roller=roller)
            self.assertIsNone(out["part"])
        self.assertEqual(self.store.account_for_token(token)["partsDry"], 5)

        sixth = self.store.roll_part(token, "run-a", "level", 7, None, dry, roller=roller)
        self.assertIsNotNone(sixth["part"])
        self.assertEqual(sixth["part"]["id"], "p2")
        self.assertEqual(sixth["profile"]["partsDry"], 0)

        no_drop = self.store.roll_part(token, "run-b", "endless", None, 4, lucky, roller=roller)
        self.assertIsNone(no_drop["part"])
        self.assertEqual(no_drop["profile"]["partsDry"], 0)

        endless = self.store.roll_part(token, "run-b", "endless", None, 5, lucky, roller=roller)
        self.assertIsNotNone(endless["part"])
        self.assertEqual(endless["part"]["id"], "p3")
        repeat_endless = self.store.roll_part(token, "run-b", "endless", None, 5, lucky, roller=roller)
        self.assertEqual(repeat_endless["part"]["id"], "p3")
        self.assertEqual(len(repeat_endless["profile"]["parts"]), 3)
        self.assertEqual(repeat_endless["profile"]["partsDry"], 0)

        self.store.equip_part(token, "p1")
        with self.assertRaises(ValueError) as ctx:
            self.store.equip_part(token, "p2")
        self.assertEqual(str(ctx.exception), "Такая уже надета")

        self.store.unequip_part(token, 0)
        self.store.roll_part(token, "run-d", "level", 1, None, lucky, roller=common_roller)
        equipped = self.store.equip_part(token, "c1")
        self.assertEqual(equipped["profile"]["loadout"][4], "c1")
        self.assertIsNone(equipped["profile"]["loadout"][0])


class HandlerTests(unittest.TestCase):
    def test_register_then_me(self):
        store = Store(tempfile.mktemp(suffix=".sqlite"))
        handler_cls = make_handler(store)
        status, body = call(handler_cls, "POST", "/register", {"name": "Ada", "password": "secret-pass"})
        self.assertEqual(status, 200)
        token = body["token"]
        status, me = call(handler_cls, "GET", "/me", None, token)
        self.assertEqual(me["profile"]["coins"], 0)
        status, claimed = call(handler_cls, "POST", "/endless", {"level": 2, "wave": 40}, token)
        self.assertEqual(status, 200)
        self.assertEqual(claimed["granted"], 5)
        self.assertEqual(set(claimed), {"granted", "crystals", "profile"})
        status, repeat = call(handler_cls, "POST", "/endless", {"level": 2, "wave": 40}, token)
        self.assertEqual(repeat["granted"], 0)
        self.assertEqual(repeat["crystals"], claimed["crystals"])
        status, bad = call(handler_cls, "POST", "/endless", {"level": 9, "wave": 1}, token)
        self.assertEqual(status, 400)
        self.assertEqual(bad, {"error": "Некорректный уровень"})
        os.remove(store.path)


def call(handler_cls, method, path, payload, token=None):
    class Result:
        status = None
        body = b""

    result = Result()

    class Fake(handler_cls):
        def __init__(self):
            self.path = path
            self.headers = {"Authorization": f"Bearer {token}"} if token else {}
            self.rfile = io.BytesIO(json.dumps(payload or {}).encode())
            self.wfile = io.BytesIO()
            self.requestline = f"{method} {path} HTTP/1.1"
            self.request_version = "HTTP/1.1"
            self.command = method

        def send_response(self, code, message=None):
            result.status = code

        def send_header(self, key, value):
            pass

        def end_headers(self):
            pass

        def log_message(self, fmt, *args):
            pass

    fake = Fake()
    getattr(fake, f"do_{method}")()
    return result.status, json.loads(fake.wfile.getvalue() or b"{}")


if __name__ == "__main__":
    unittest.main()
