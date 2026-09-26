#!/usr/bin/env python3
"""Nightly backup of the PolySpire account database.

Copies the SQLite database with the online backup API so a running API is not
disturbed, verifies the copy, and keeps the newest COPIES_TO_KEEP files.
"""
import os
import sqlite3
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

SOURCE = os.environ.get("ROGUEBULLET_DB", "/var/lib/roguebullet/account.sqlite")
BACKUP_DIR = os.environ.get("ROGUEBULLET_BACKUP_DIR", "/var/backups/roguebullet")
COPIES_TO_KEEP = 14
MOSCOW = ZoneInfo("Europe/Moscow")


def make_backup(source=SOURCE, backup_dir=BACKUP_DIR, now=None):
    now = now or datetime.now(timezone.utc)
    day = now.astimezone(MOSCOW).date().isoformat()
    os.makedirs(backup_dir, exist_ok=True)
    target = os.path.join(backup_dir, f"account-{day}.sqlite")

    src = sqlite3.connect(source)
    try:
        dst = sqlite3.connect(target)
        try:
            src.backup(dst)
        finally:
            dst.close()
    finally:
        src.close()

    check = sqlite3.connect(target)
    try:
        result = check.execute("PRAGMA integrity_check").fetchone()
    finally:
        check.close()
    if not result or result[0] != "ok":
        os.remove(target)
        raise RuntimeError(f"Проверка копии не прошла: {result}")

    prune(backup_dir)
    return target


def prune(backup_dir=BACKUP_DIR, keep=COPIES_TO_KEEP):
    copies = sorted(
        name for name in os.listdir(backup_dir)
        if name.startswith("account-") and name.endswith(".sqlite")
    )
    for name in copies[:-keep]:
        os.remove(os.path.join(backup_dir, name))


if __name__ == "__main__":
    try:
        path = make_backup()
    except Exception as exc:  # noqa: BLE001
        print(f"backup failed: {exc}", file=sys.stderr)
        sys.exit(1)
    print(f"backup ok: {path}")
