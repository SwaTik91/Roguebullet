import os
import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone

from server.backup_db import make_backup, prune


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.source = os.path.join(self.dir, "account.sqlite")
        self.backups = os.path.join(self.dir, "backups")
        db = sqlite3.connect(self.source)
        db.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)")
        db.execute("INSERT INTO t (v) VALUES ('hi')")
        db.commit()
        db.close()

    def test_backup_creates_a_verified_copy(self):
        now = datetime(2026, 9, 26, 3, 0, tzinfo=timezone.utc)
        path = make_backup(self.source, self.backups, now=now)
        self.assertTrue(os.path.exists(path))
        copy = sqlite3.connect(path)
        rows = copy.execute("SELECT v FROM t").fetchall()
        copy.close()
        self.assertEqual(rows, [("hi",)])

    def test_prune_keeps_the_newest_copies(self):
        os.makedirs(self.backups, exist_ok=True)
        for day in range(1, 20):
            name = f"account-2026-09-{day:02d}.sqlite"
            open(os.path.join(self.backups, name), "w").close()
        prune(self.backups, keep=14)
        left = sorted(os.listdir(self.backups))
        self.assertEqual(len(left), 14)
        self.assertEqual(left[0], "account-2026-09-06.sqlite")


if __name__ == "__main__":
    unittest.main()
