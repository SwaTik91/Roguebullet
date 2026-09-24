import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from server.rewards import (
    ACHIEVEMENT_CRYSTALS,
    CRIT_CAP,
    achievement_crystals,
    apply_account_xp,
    buy_crystal_item,
    coin_reward,
    daily_tasks,
    endless_crystals,
    reroll_price,
    first_clear_crystals,
    hangar_price,
    ready_achievements,
    roll_chest,
    xp_reward,
    ENEMY_COINS,
)

HANGAR_KEYS = {"atk": "hangar_atk", "hp": "hangar_hp", "charge": "hangar_charge"}
MOSCOW = ZoneInfo("Europe/Moscow")


def moscow_day(now):
    if isinstance(now, str):
        now = datetime.fromisoformat(now)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return now.astimezone(MOSCOW).date().isoformat()


class Store:
    def __init__(self, path):
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        self.path = path
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self._init()

    def _init(self):
        self.db.executescript(
            """
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password TEXT NOT NULL,
                coins INTEGER NOT NULL DEFAULT 0,
                crystals INTEGER NOT NULL DEFAULT 0,
                xp INTEGER NOT NULL DEFAULT 0,
                account_level INTEGER NOT NULL DEFAULT 1,
                crit_bonus INTEGER NOT NULL DEFAULT 0,
                fourth_card INTEGER NOT NULL DEFAULT 0,
                hangar_atk INTEGER NOT NULL DEFAULT 0,
                hangar_hp INTEGER NOT NULL DEFAULT 0,
                hangar_charge INTEGER NOT NULL DEFAULT 0,
                hangar_buys INTEGER NOT NULL DEFAULT 0,
                chests_opened INTEGER NOT NULL DEFAULT 0,
                kills_total INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                account_id INTEGER NOT NULL,
                expires_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS cleared_levels (
                account_id INTEGER NOT NULL,
                level INTEGER NOT NULL,
                PRIMARY KEY (account_id, level)
            );
            CREATE TABLE IF NOT EXISTS claimed_runs (
                account_id INTEGER NOT NULL,
                run_id TEXT NOT NULL,
                response_json TEXT NOT NULL,
                PRIMARY KEY (account_id, run_id)
            );
            CREATE TABLE IF NOT EXISTS achievements (
                account_id INTEGER NOT NULL,
                achievement_id TEXT NOT NULL,
                claimed INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY (account_id, achievement_id)
            );
            CREATE TABLE IF NOT EXISTS daily (
                account_id INTEGER NOT NULL,
                day TEXT NOT NULL,
                kills INTEGER NOT NULL DEFAULT 0,
                wave3 INTEGER NOT NULL DEFAULT 0,
                level_clear INTEGER NOT NULL DEFAULT 0,
                claimed_json TEXT NOT NULL DEFAULT '[]',
                PRIMARY KEY (account_id, day)
            );
            CREATE TABLE IF NOT EXISTS owned_weapons (
                account_id INTEGER NOT NULL,
                weapon TEXT NOT NULL,
                PRIMARY KEY (account_id, weapon)
            );
            CREATE TABLE IF NOT EXISTS card_queue (
                id INTEGER PRIMARY KEY,
                account_id INTEGER NOT NULL,
                card TEXT NOT NULL,
                seq INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS card_takes (
                account_id INTEGER NOT NULL,
                run_id TEXT NOT NULL,
                card TEXT,
                PRIMARY KEY (account_id, run_id)
            );
            CREATE TABLE IF NOT EXISTS chest_requests (
                account_id INTEGER NOT NULL,
                request_id TEXT NOT NULL,
                response_json TEXT NOT NULL,
                PRIMARY KEY (account_id, request_id)
            );
            CREATE TABLE IF NOT EXISTS endless_claims (
                account_id INTEGER NOT NULL,
                level INTEGER NOT NULL,
                wave INTEGER NOT NULL,
                PRIMARY KEY (account_id, level, wave)
            );
            CREATE TABLE IF NOT EXISTS reroll_counts (
                account_id INTEGER NOT NULL,
                run_id TEXT NOT NULL,
                offer_level INTEGER NOT NULL,
                used INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (account_id, run_id, offer_level)
            );
            """
        )
        self.db.commit()

    def register(self, name, password):
        name = (name or "").strip()
        if not name or len(name) > 24:
            raise ValueError("Имя от 1 до 24 символов")
        if not isinstance(password, str) or len(password) < 4:
            raise ValueError("Пароль слишком короткий")
        salt = secrets.token_bytes(16)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200000)
        try:
            cur = self.db.execute(
                "INSERT INTO accounts (name, password) VALUES (?, ?)",
                (name, f"{salt.hex()}${digest.hex()}"),
            )
            self.db.commit()
        except sqlite3.IntegrityError as exc:
            self.db.rollback()
            raise ValueError("Имя уже занято") from exc
        token = self._new_session(cur.lastrowid)
        return {"token": token, "profile": self._profile(cur.lastrowid)}

    def login(self, name, password):
        row = self.db.execute(
            "SELECT * FROM accounts WHERE name = ?",
            ((name or "").strip(),),
        ).fetchone()
        if row is None or not _password_ok(row["password"], password or ""):
            raise ValueError("Неверное имя или пароль")
        token = self._new_session(row["id"])
        return {"token": token, "profile": self._profile(row["id"])}

    def account_for_token(self, token):
        row = self._account_row(token)
        return self._profile(row["id"])

    def claim_run(self, token, facts, now):
        account_id = self._account_row(token)["id"]
        run_id = str((facts or {}).get("runId") or "").strip()
        if not run_id:
            raise ValueError("Нет номера забега")
        self.db.execute("BEGIN IMMEDIATE")
        try:
            existing = self.db.execute(
                "SELECT response_json FROM claimed_runs WHERE account_id = ? AND run_id = ?",
                (account_id, run_id),
            ).fetchone()
            if existing:
                self.db.commit()
                return json.loads(existing["response_json"])
            kills, levels_cleared, ended_level, ended_wave, waves_cleared, started_level = _validate_facts(facts)
            row = self.db.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
            full_campaign = started_level == 1 and levels_cleared >= 3
            coin_gain = coin_reward(kills, ended_level, ended_wave, full_campaign, started_level)
            xp_gain = xp_reward(kills, waves_cleared, levels_cleared)
            new_level, new_xp, level_crystals = apply_account_xp(row["account_level"], row["xp"], xp_gain)
            already = {
                item["level"]
                for item in self.db.execute("SELECT level FROM cleared_levels WHERE account_id = ?", (account_id,))
            }
            new_levels, clear_crystals, autos = first_clear_crystals(already, levels_cleared, started_level)
            claimed = {
                item["achievement_id"]
                for item in self.db.execute(
                    "SELECT achievement_id FROM achievements WHERE account_id = ? AND claimed = 1",
                    (account_id,),
                )
            }
            auto_crystals = 0
            for achievement_id in autos:
                if achievement_id in claimed:
                    continue
                self.db.execute(
                    "INSERT INTO achievements (account_id, achievement_id, claimed) VALUES (?, ?, 1)",
                    (account_id, achievement_id),
                )
                auto_crystals += achievement_crystals(achievement_id)
                claimed.add(achievement_id)
            for level in new_levels:
                self.db.execute(
                    "INSERT INTO cleared_levels (account_id, level) VALUES (?, ?)",
                    (account_id, level),
                )
            crystal_gain = clear_crystals + auto_crystals + level_crystals
            kill_count = sum(kills.values())
            self.db.execute(
                """
                UPDATE accounts
                SET coins = coins + ?, crystals = crystals + ?, xp = ?, account_level = ?, kills_total = kills_total + ?
                WHERE id = ?
                """,
                (coin_gain, crystal_gain, new_xp, new_level, kill_count, account_id),
            )
            self._add_daily(account_id, now, kill_count, waves_cleared, levels_cleared)
            payload = {
                "granted": {"coins": coin_gain, "xp": xp_gain, "crystals": crystal_gain},
                "profile": self._profile(account_id),
            }
            encoded = json.dumps(payload, ensure_ascii=False)
            self.db.execute(
                "INSERT INTO claimed_runs (account_id, run_id, response_json) VALUES (?, ?, ?)",
                (account_id, run_id, encoded),
            )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return json.loads(encoded)

    def claim_endless(self, token, level, wave):
        account_id = self._account_row(token)["id"]
        payout = endless_crystals(level, wave)
        self.db.execute("BEGIN IMMEDIATE")
        try:
            existing = self.db.execute(
                "SELECT 1 FROM endless_claims WHERE account_id = ? AND level = ? AND wave = ?",
                (account_id, level, wave),
            ).fetchone()
            granted = 0 if existing else payout
            if not existing:
                self.db.execute(
                    "INSERT INTO endless_claims (account_id, level, wave) VALUES (?, ?, ?)",
                    (account_id, level, wave),
                )
                self.db.execute(
                    "UPDATE accounts SET crystals = crystals + ? WHERE id = ?",
                    (granted, account_id),
                )
            profile = self._profile(account_id)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return {"granted": granted, "crystals": profile["crystals"], "profile": profile}

    def buy_reroll(self, token, run_id, offer_level):
        run_id = str(run_id or "").strip()
        try:
            offer_level = int(offer_level)
        except (TypeError, ValueError):
            raise ValueError("Некорректный реролл")
        if not run_id or offer_level < 1:
            raise ValueError("Некорректный реролл")
        account_id = self._account_row(token)["id"]
        self.db.execute("BEGIN IMMEDIATE")
        try:
            row = self.db.execute(
                "SELECT used FROM reroll_counts WHERE account_id = ? AND run_id = ? AND offer_level = ?",
                (account_id, run_id, offer_level),
            ).fetchone()
            used = int(row["used"]) if row else 0
            price = reroll_price(used)
            if price is None:
                raise ValueError("Реролл больше недоступен")
            account = self.db.execute("SELECT coins, crystals FROM accounts WHERE id = ?", (account_id,)).fetchone()
            if price["kind"] == "coins" and account["coins"] < price["amount"]:
                raise ValueError("Не хватает монет")
            if price["kind"] == "crystals" and account["crystals"] < price["amount"]:
                raise ValueError("Не хватает кристаллов")
            if price["kind"] == "coins":
                self.db.execute("UPDATE accounts SET coins = coins - ? WHERE id = ?", (price["amount"], account_id))
            elif price["kind"] == "crystals":
                self.db.execute(
                    "UPDATE accounts SET crystals = crystals - ? WHERE id = ?",
                    (price["amount"], account_id),
                )
            used += 1
            self.db.execute(
                """
                INSERT INTO reroll_counts (account_id, run_id, offer_level, used)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(account_id, run_id, offer_level) DO UPDATE SET used = excluded.used
                """,
                (account_id, run_id, offer_level, used),
            )
            profile = self._profile(account_id)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return {"used": used, "price": price, "next": reroll_price(used), "profile": profile}

    def buy_hangar(self, token, key):
        if key not in HANGAR_KEYS:
            raise ValueError("Неизвестное улучшение")
        account_id = self._account_row(token)["id"]
        column = HANGAR_KEYS[key]
        self.db.execute("BEGIN IMMEDIATE")
        try:
            row = self.db.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
            price = hangar_price(row[column])
            if row["coins"] < price:
                raise ValueError("Не хватает монет")
            self.db.execute(
                f"UPDATE accounts SET coins = coins - ?, {column} = {column} + 1, hangar_buys = hangar_buys + 1 WHERE id = ?",
                (price, account_id),
            )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return {"profile": self._profile(account_id)}

    def buy_shop(self, token, kind, weapon=None):
        account_id = self._account_row(token)["id"]
        self.db.execute("BEGIN IMMEDIATE")
        try:
            row = self.db.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
            weapons = self._weapons(account_id)
            updated = buy_crystal_item(
                {
                    "crystals": row["crystals"],
                    "crit_bonus": row["crit_bonus"],
                    "weapons": weapons,
                    "fourth_card": bool(row["fourth_card"]),
                },
                kind,
                weapon,
            )
            self.db.execute(
                "UPDATE accounts SET crystals = ?, crit_bonus = ?, fourth_card = ? WHERE id = ?",
                (updated["crystals"], updated["crit_bonus"], int(updated["fourth_card"]), account_id),
            )
            for item in updated["weapons"]:
                self.db.execute(
                    "INSERT OR IGNORE INTO owned_weapons (account_id, weapon) VALUES (?, ?)",
                    (account_id, item),
                )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return {"profile": self._profile(account_id)}

    def open_chest(self, token, rng, request_id=None):
        account_id = self._account_row(token)["id"]
        request_id = str(request_id or "").strip()
        self.db.execute("BEGIN IMMEDIATE")
        try:
            if request_id:
                saved = self.db.execute(
                    "SELECT response_json FROM chest_requests WHERE account_id = ? AND request_id = ?",
                    (account_id, request_id),
                ).fetchone()
                if saved:
                    self.db.commit()
                    return json.loads(saved["response_json"])
            row = self.db.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
            if row["crystals"] < 20:
                raise ValueError("Не хватает кристаллов")
            drop = roll_chest({"crit_bonus": row["crit_bonus"]}, rng)
            crystals = row["crystals"] - 20
            coins = row["coins"]
            crit_bonus = row["crit_bonus"]
            if drop["kind"] == "coins":
                coins += int(drop["amount"])
            elif drop["kind"] == "crystals":
                crystals += int(drop["amount"])
            elif drop["kind"] == "crit":
                crit_bonus = min(CRIT_CAP, crit_bonus + int(drop["amount"]))
            elif drop["kind"] == "card":
                seq = self.db.execute(
                    "SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM card_queue WHERE account_id = ?",
                    (account_id,),
                ).fetchone()["seq"]
                self.db.execute(
                    "INSERT INTO card_queue (account_id, card, seq) VALUES (?, ?, ?)",
                    (account_id, drop["card"], seq),
                )
            self.db.execute(
                """
                UPDATE accounts
                SET coins = ?, crystals = ?, crit_bonus = ?, chests_opened = chests_opened + 1
                WHERE id = ?
                """,
                (coins, crystals, crit_bonus, account_id),
            )
            payload = {"drop": drop, "profile": self._profile(account_id)}
            encoded = json.dumps(payload, ensure_ascii=False)
            if request_id:
                self.db.execute(
                    "INSERT INTO chest_requests (account_id, request_id, response_json) VALUES (?, ?, ?)",
                    (account_id, request_id, encoded),
                )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return json.loads(encoded)

    def claim_achievement(self, token, achievement_id):
        if achievement_id not in ACHIEVEMENT_CRYSTALS:
            raise ValueError("Нет такого достижения")
        account_id = self._account_row(token)["id"]
        self.db.execute("BEGIN IMMEDIATE")
        try:
            claimed = self._claimed(account_id)
            stats = self._stats(account_id)
            if achievement_id not in ready_achievements(stats, claimed):
                raise ValueError("Достижение ещё нельзя забрать")
            self.db.execute(
                "INSERT INTO achievements (account_id, achievement_id, claimed) VALUES (?, ?, 1)",
                (account_id, achievement_id),
            )
            self.db.execute(
                "UPDATE accounts SET crystals = crystals + ? WHERE id = ?",
                (achievement_crystals(achievement_id), account_id),
            )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return {"profile": self._profile(account_id)}

    def claim_daily(self, token, task_id, now):
        account_id = self._account_row(token)["id"]
        day = moscow_day(now)
        self.db.execute("BEGIN IMMEDIATE")
        try:
            self.db.execute(
                "INSERT OR IGNORE INTO daily (account_id, day) VALUES (?, ?)",
                (account_id, day),
            )
            daily = self._daily_state(account_id, day)
            tasks = daily_tasks(daily["kills"], daily["wave3"], daily["level_clear"], json.loads(daily["claimed_json"]))
            task = next((item for item in tasks if item["id"] == task_id), None)
            if task is None or not task["done"] or task["claimed"]:
                raise ValueError("Задание ещё нельзя забрать")
            claimed = json.loads(daily["claimed_json"])
            claimed.append(task_id)
            self.db.execute(
                "UPDATE daily SET claimed_json = ? WHERE account_id = ? AND day = ?",
                (json.dumps(claimed), account_id, day),
            )
            self.db.execute(
                "UPDATE accounts SET crystals = crystals + ? WHERE id = ?",
                (task["crystals"], account_id),
            )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return {"profile": self._profile(account_id)}

    def take_card(self, token, run_id):
        account_id = self._account_row(token)["id"]
        run_id = str(run_id or "").strip()
        if not run_id:
            raise ValueError("Нет номера забега")
        self.db.execute("BEGIN IMMEDIATE")
        try:
            existing = self.db.execute(
                "SELECT card FROM card_takes WHERE account_id = ? AND run_id = ?",
                (account_id, run_id),
            ).fetchone()
            if existing:
                card = existing["card"]
            else:
                queued = self.db.execute(
                    "SELECT id, card FROM card_queue WHERE account_id = ? ORDER BY seq, id LIMIT 1",
                    (account_id,),
                ).fetchone()
                card = queued["card"] if queued else None
                if queued:
                    self.db.execute("DELETE FROM card_queue WHERE id = ?", (queued["id"],))
                self.db.execute(
                    "INSERT INTO card_takes (account_id, run_id, card) VALUES (?, ?, ?)",
                    (account_id, run_id, card),
                )
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return {"card": card, "profile": self._profile(account_id)}

    def _new_session(self, account_id):
        token = secrets.token_hex(32)
        expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        self.db.execute(
            "INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)",
            (hashlib.sha256(token.encode()).hexdigest(), account_id, expires),
        )
        self.db.commit()
        return token

    def _account_row(self, token):
        if not token:
            raise ValueError("Нужна сессия")
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        row = self.db.execute(
            """
            SELECT accounts.*, sessions.expires_at AS session_expires
            FROM sessions JOIN accounts ON accounts.id = sessions.account_id
            WHERE sessions.token_hash = ?
            """,
            (token_hash,),
        ).fetchone()
        if row is None:
            raise ValueError("Нужна сессия")
        expires = datetime.fromisoformat(row["session_expires"])
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires <= datetime.now(timezone.utc):
            raise ValueError("Сессия истекла")
        return row

    def _profile(self, account_id):
        row = self.db.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
        claimed = self._claimed(account_id)
        stats = self._stats(account_id)
        ready = set(ready_achievements(stats, claimed))
        day = moscow_day(datetime.now(timezone.utc))
        daily = self._daily_state(account_id, day)
        return {
            "name": row["name"],
            "coins": row["coins"],
            "crystals": row["crystals"],
            "xp": row["xp"],
            "accountLevel": row["account_level"],
            "critBonus": row["crit_bonus"],
            "fourthCard": bool(row["fourth_card"]),
            "weapons": self._weapons(account_id),
            "hangar": {"atk": row["hangar_atk"], "hp": row["hangar_hp"], "charge": row["hangar_charge"]},
            "cardQueue": [
                item["card"]
                for item in self.db.execute(
                    "SELECT card FROM card_queue WHERE account_id = ? ORDER BY seq, id",
                    (account_id,),
                )
            ],
            "clearedLevels": [
                item["level"]
                for item in self.db.execute(
                    "SELECT level FROM cleared_levels WHERE account_id = ? ORDER BY level",
                    (account_id,),
                )
            ],
            "achievements": [
                {
                    "id": achievement_id,
                    "ready": achievement_id in ready or achievement_id in claimed,
                    "claimed": achievement_id in claimed,
                    "crystals": crystals,
                }
                for achievement_id, crystals in ACHIEVEMENT_CRYSTALS.items()
            ],
            "dailies": daily_tasks(
                daily["kills"],
                daily["wave3"],
                daily["level_clear"],
                json.loads(daily["claimed_json"]),
            ),
        }

    def _weapons(self, account_id):
        return [
            item["weapon"]
            for item in self.db.execute(
                "SELECT weapon FROM owned_weapons WHERE account_id = ? ORDER BY weapon",
                (account_id,),
            )
        ]

    def _claimed(self, account_id):
        return {
            item["achievement_id"]
            for item in self.db.execute(
                "SELECT achievement_id FROM achievements WHERE account_id = ? AND claimed = 1",
                (account_id,),
            )
        }

    def _stats(self, account_id):
        row = self.db.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
        cleared = {
            item["level"]
            for item in self.db.execute("SELECT level FROM cleared_levels WHERE account_id = ?", (account_id,))
        }
        return {
            "kills": row["kills_total"],
            "cleared_levels": cleared,
            "hangar_buys": row["hangar_buys"],
            "chests": row["chests_opened"],
        }

    def _daily_state(self, account_id, day):
        row = self.db.execute(
            "SELECT * FROM daily WHERE account_id = ? AND day = ?",
            (account_id, day),
        ).fetchone()
        if row:
            return row
        return {"kills": 0, "wave3": 0, "level_clear": 0, "claimed_json": "[]"}

    def _add_daily(self, account_id, now, kill_count, waves_cleared, levels_cleared):
        day = moscow_day(now)
        self.db.execute(
            "INSERT OR IGNORE INTO daily (account_id, day) VALUES (?, ?)",
            (account_id, day),
        )
        daily = self._daily_state(account_id, day)
        wave3 = int(daily["wave3"] or waves_cleared >= 3 or levels_cleared >= 1)
        level_clear = int(daily["level_clear"] or levels_cleared >= 1)
        self.db.execute(
            """
            UPDATE daily
            SET kills = kills + ?, wave3 = ?, level_clear = ?
            WHERE account_id = ? AND day = ?
            """,
            (kill_count, wave3, level_clear, account_id, day),
        )


def _password_ok(stored, password):
    try:
        salt_hex, hash_hex = stored.split("$", 1)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 200000)
    except (TypeError, ValueError):
        return False
    return hmac.compare_digest(digest.hex(), hash_hex)


def _validate_facts(facts):
    try:
        levels_cleared = int(facts["levelsCleared"])
        ended_level = int(facts["endedLevel"])
        ended_wave = int(facts["endedWave"])
        waves_cleared = int(facts["wavesCleared"])
        started_level = int(facts.get("startedLevel") or 1)
        raw_kills = facts.get("kills") or {}
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Некорректный забег") from exc
    if levels_cleared not in range(0, 4):
        raise ValueError("Некорректный забег")
    if started_level not in range(1, 4):
        raise ValueError("Некорректный забег")
    if levels_cleared and started_level + levels_cleared - 1 > 3:
        raise ValueError("Некорректный забег")
    if ended_level not in range(1, 4) or ended_level < started_level:
        raise ValueError("Некорректный забег")
    if ended_wave not in range(1, 7):
        raise ValueError("Некорректный забег")
    if waves_cleared not in range(0, 19):
        raise ValueError("Некорректный забег")
    kills = {}
    for kind in ENEMY_COINS:
        try:
            count = int(raw_kills.get(kind, 0))
        except (TypeError, ValueError) as exc:
            raise ValueError("Некорректный забег") from exc
        if count < 0:
            raise ValueError("Некорректный забег")
        kills[kind] = count
    return kills, levels_cleared, ended_level, ended_wave, waves_cleared, started_level
