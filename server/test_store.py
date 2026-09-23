import os
import tempfile
import unittest
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


if __name__ == "__main__":
    unittest.main()
