import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from server import parts_bridge
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
    hangar_node_price,
    HANGAR_TREE,
    ready_achievements,
    roll_chest,
    xp_reward,
    ENEMY_COINS,
)

HANGAR_KEYS = {"atk": "hangar_atk", "hp": "hangar_hp", "charge": "hangar_charge"}
MOSCOW = ZoneInfo("Europe/Moscow")
DEFAULT_LOADOUT_JSON = "[null,null,null,null,null,null,null,null]"
PART_RARITY_ORDER = ["common", "rare", "epic", "legendary"]
PART_RARITY_STEP = {"common": 1, "rare": 2, "epic": 3, "legendary": 4}
SALVAGE_CRYSTALS = {"common": 3, "rare": 8, "epic": 18, "legendary": 40}
UPGRADE_COST = {"common": 12, "rare": 30, "epic": 70}
ENDLESS_PART_CHANCE = 0.30
ENDLESS_PART_EVERY = 5
LEVEL_PART_CHANCE = 0.40
LEVEL_PART_PITY = 3
TESTERS = {"sharon"}
GUESTS_PER_IP_PER_DAY = 20
EVENT_RETENTION_DAYS = 90


def is_tester_name(name):
    return str(name or "").strip().lower() in TESTERS


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
                kills_total INTEGER NOT NULL DEFAULT 0,
                loadout_json TEXT NOT NULL DEFAULT '[null,null,null,null,null,null,null,null]',
                parts_dry INTEGER NOT NULL DEFAULT 0
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
            CREATE TABLE IF NOT EXISTS account_parts (
                id TEXT PRIMARY KEY,
                account_id INTEGER NOT NULL,
                base TEXT NOT NULL,
                base_name TEXT NOT NULL,
                family TEXT,
                rarity TEXT NOT NULL,
                affixes_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS part_rolls (
                account_id INTEGER NOT NULL,
                roll_key TEXT NOT NULL,
                part_id TEXT NOT NULL,
                PRIMARY KEY (account_id, roll_key)
            );
            CREATE TABLE IF NOT EXISTS account_hangar_nodes (
                account_id INTEGER NOT NULL,
                node TEXT NOT NULL,
                level INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (account_id, node)
            );
            CREATE TABLE IF NOT EXISTS guest_ips (
                ip TEXT NOT NULL,
                day TEXT NOT NULL,
                count INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (ip, day)
            );
            CREATE TABLE IF NOT EXISTS run_events (
                run_id TEXT NOT NULL,
                account_id INTEGER NOT NULL,
                is_tester INTEGER NOT NULL DEFAULT 0,
                is_guest INTEGER NOT NULL DEFAULT 0,
                started_at TEXT,
                ended_at TEXT,
                start_level INTEGER,
                outcome TEXT,
                end_level INTEGER,
                end_wave INTEGER,
                duration REAL,
                kills INTEGER,
                weapons_json TEXT,
                parts_json TEXT,
                cards_json TEXT,
                branches_json TEXT,
                legendaries_json TEXT,
                damage_json TEXT,
                PRIMARY KEY (run_id, account_id)
            );
            """
        )
        self._ensure_column("accounts", "loadout_json", f"TEXT NOT NULL DEFAULT '{DEFAULT_LOADOUT_JSON}'")
        self._ensure_column("accounts", "parts_dry", "INTEGER NOT NULL DEFAULT 0")
        self._ensure_column("accounts", "is_guest", "INTEGER NOT NULL DEFAULT 0")
        self._ensure_column("run_events", "damage_json", "TEXT")
        self.db.commit()

    def _ensure_column(self, table, column, definition):
        columns = {row[1] for row in self.db.execute(f"PRAGMA table_info({table})")}
        if column not in columns:
            self.db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

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

    def create_guest(self, ip, now=None):
        now = now or datetime.now(timezone.utc)
        day = moscow_day(now)
        ip = (ip or "").strip() or "unknown"
        self.db.execute("BEGIN IMMEDIATE")
        try:
            row = self.db.execute(
                "SELECT count FROM guest_ips WHERE ip = ? AND day = ?",
                (ip, day),
            ).fetchone()
            used = int(row["count"]) if row else 0
            if used >= GUESTS_PER_IP_PER_DAY:
                raise ValueError("Слишком много новых аккаунтов, попробуй позже")
            for _ in range(20):
                name = f"Гость-{secrets.randbelow(9000) + 1000}"
                exists = self.db.execute(
                    "SELECT 1 FROM accounts WHERE name = ?", (name,)
                ).fetchone()
                if not exists:
                    break
            else:
                raise ValueError("Не вышло создать гостя")
            salt = secrets.token_bytes(16)
            digest = hashlib.pbkdf2_hmac("sha256", secrets.token_hex(16).encode(), salt, 200000)
            cur = self.db.execute(
                "INSERT INTO accounts (name, password, is_guest) VALUES (?, ?, 1)",
                (name, f"{salt.hex()}${digest.hex()}"),
            )
            self.db.execute(
                "INSERT INTO guest_ips (ip, day, count) VALUES (?, ?, 1) "
                "ON CONFLICT(ip, day) DO UPDATE SET count = count + 1",
                (ip, day),
            )
            account_id = cur.lastrowid
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        token = self._new_session(account_id)
        return {"token": token, "profile": self._profile(account_id)}

    def save_account(self, token, name, password):
        row = self._account_row(token)
        if not row["is_guest"]:
            raise ValueError("Аккаунт уже сохранён")
        name = (name or "").strip()
        if not name or len(name) > 24:
            raise ValueError("Имя от 1 до 24 символов")
        if not isinstance(password, str) or len(password) < 4:
            raise ValueError("Пароль слишком короткий")
        salt = secrets.token_bytes(16)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200000)
        try:
            self.db.execute(
                "UPDATE accounts SET name = ?, password = ?, is_guest = 0 WHERE id = ?",
                (name, f"{salt.hex()}${digest.hex()}", row["id"]),
            )
            self.db.commit()
        except sqlite3.IntegrityError as exc:
            self.db.rollback()
            raise ValueError("Имя уже занято") from exc
        return {"profile": self._profile(row["id"])}

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
        if key in HANGAR_KEYS:
            return self._buy_hangar_legacy(token, key)
        if key in HANGAR_TREE:
            return self._buy_hangar_node(token, key)
        raise ValueError("Неизвестное улучшение")

    def _buy_hangar_legacy(self, token, key):
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

    def _buy_hangar_node(self, token, key):
        account_id = self._account_row(token)["id"]
        spec = HANGAR_TREE[key]
        self.db.execute("BEGIN IMMEDIATE")
        try:
            row = self.db.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
            req_node, req_level = spec["requires"]
            req_column = HANGAR_KEYS[req_node]
            if row[req_column] < req_level:
                raise ValueError("Ветка ещё закрыта")
            node_row = self.db.execute(
                "SELECT level FROM account_hangar_nodes WHERE account_id = ? AND node = ?",
                (account_id, key),
            ).fetchone()
            level = int(node_row["level"]) if node_row else 0
            if level >= spec["max"]:
                raise ValueError("Уже максимум")
            price = hangar_node_price(key, level)
            if row["coins"] < price:
                raise ValueError("Не хватает монет")
            self.db.execute(
                "UPDATE accounts SET coins = coins - ?, hangar_buys = hangar_buys + 1 WHERE id = ?",
                (price, account_id),
            )
            self.db.execute(
                """
                INSERT INTO account_hangar_nodes (account_id, node, level)
                VALUES (?, ?, 1)
                ON CONFLICT(account_id, node) DO UPDATE SET level = level + 1
                """,
                (account_id, key),
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

    def roll_part(self, token, run_id, kind, level, wave, rng, roller=None):
        row = self._account_row(token)
        account_id = row["id"]
        tester = is_tester_name(row["name"])
        run_id = str(run_id or "").strip()
        kind = str(kind or "").strip()
        if not run_id:
            raise ValueError("Нет номера забега")
        if kind not in ("level", "endless"):
            raise ValueError("Некорректный бросок детали")
        self.db.execute("BEGIN IMMEDIATE")
        try:
            if kind == "endless":
                try:
                    wave_num = int(wave)
                except (TypeError, ValueError):
                    wave_num = 0
                if wave_num <= 0 or wave_num % ENDLESS_PART_EVERY != 0:
                    profile = self._profile(account_id)
                    self.db.commit()
                    return {"part": None, "profile": profile}
                roll_key = f"{run_id}:endless:{wave_num}"
            else:
                try:
                    level_num = int(level)
                except (TypeError, ValueError):
                    raise ValueError("Некорректный бросок детали")
                roll_key = f"{run_id}:level:{level_num}"

            existing = self.db.execute(
                "SELECT part_id FROM part_rolls WHERE account_id = ? AND roll_key = ?",
                (account_id, roll_key),
            ).fetchone()
            if existing:
                part_id = existing["part_id"]
                part = self._part_by_id(account_id, part_id) if part_id else None
                profile = self._profile(account_id)
                self.db.commit()
                return {"part": part, "profile": profile}

            drop = False
            if kind == "level":
                dry = int(row["parts_dry"] or 0)
                if tester or dry >= LEVEL_PART_PITY or rng() < LEVEL_PART_CHANCE:
                    drop = True
                else:
                    self._record_roll_miss(account_id, roll_key, kind="level")
                    profile = self._profile(account_id)
                    self.db.commit()
                    return {"part": None, "profile": profile}
            elif rng() < ENDLESS_PART_CHANCE:
                drop = True
            else:
                self._record_roll_miss(account_id, roll_key, kind="endless")
                profile = self._profile(account_id)
                self.db.commit()
                return {"part": None, "profile": profile}

            owned = self._owned_weapon_families(account_id)
            part_id = secrets.token_hex(16)
            if roller is None:
                part = parts_bridge.roll_part(rng, owned, part_id)
            else:
                part = roller(rng, owned)
                if not part.get("id"):
                    part = {**part, "id": part_id}
            self._insert_part(account_id, part)
            self.db.execute(
                "INSERT INTO part_rolls (account_id, roll_key, part_id) VALUES (?, ?, ?)",
                (account_id, roll_key, part["id"]),
            )
            if kind == "level":
                self.db.execute("UPDATE accounts SET parts_dry = 0 WHERE id = ?", (account_id,))
            profile = self._profile(account_id)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return {"part": part, "profile": profile}

    def dev_crystals(self, token, amount=100):
        row = self._account_row(token)
        if not is_tester_name(row["name"]):
            raise ValueError("Нет доступа")
        amount = int(amount or 100)
        if amount < 1 or amount > 1000:
            raise ValueError("Некорректная сумма")
        account_id = row["id"]
        self.db.execute(
            "UPDATE accounts SET crystals = crystals + ? WHERE id = ?",
            (amount, account_id),
        )
        self.db.commit()
        return {"granted": amount, "profile": self._profile(account_id)}

    def dev_part(self, token, rarity, rng, roller=None):
        row = self._account_row(token)
        if not is_tester_name(row["name"]):
            raise ValueError("Нет доступа")
        rarity = str(rarity or "").strip()
        if rarity not in ("common", "rare", "epic", "legendary"):
            raise ValueError("Некорректная редкость")
        account_id = row["id"]
        owned = list(self._owned_weapon_families(account_id))
        part_id = secrets.token_hex(16)
        if roller is None:
            part = parts_bridge.roll_part(rng, owned, part_id, rarity)
        else:
            part = roller(rng, owned, rarity)
            if not part.get("id"):
                part = {**part, "id": part_id}
            part = {**part, "rarity": rarity}
        self.db.execute("BEGIN IMMEDIATE")
        try:
            self._insert_part(account_id, part)
            profile = self._profile(account_id)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return {"part": part, "profile": profile}

    def equip_part(self, token, part_id):
        part_id = str(part_id or "").strip()
        if not part_id:
            raise ValueError("Нет детали")
        account_id = self._account_row(token)["id"]
        self.db.execute("BEGIN IMMEDIATE")
        try:
            if self._part_by_id(account_id, part_id) is None:
                raise ValueError("Нет детали")
            parts = self._parts_list(account_id)
            row = self.db.execute("SELECT loadout_json FROM accounts WHERE id = ?", (account_id,)).fetchone()
            slots = json.loads(row["loadout_json"] or DEFAULT_LOADOUT_JSON)
            result = parts_bridge.first_slot(parts, slots, part_id)
            if result.get("error"):
                raise ValueError(result["error"])
            self.db.execute(
                "UPDATE accounts SET loadout_json = ? WHERE id = ?",
                (json.dumps(result["slots"], ensure_ascii=False), account_id),
            )
            profile = self._profile(account_id)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return {"profile": profile}

    def unequip_part(self, token, slot):
        try:
            index = int(slot)
        except (TypeError, ValueError):
            raise ValueError("Некорректный слот")
        account_id = self._account_row(token)["id"]
        self.db.execute("BEGIN IMMEDIATE")
        try:
            row = self.db.execute("SELECT loadout_json FROM accounts WHERE id = ?", (account_id,)).fetchone()
            slots = json.loads(row["loadout_json"] or DEFAULT_LOADOUT_JSON)
            next_slots = parts_bridge.unequip_slots(slots, index)
            self.db.execute(
                "UPDATE accounts SET loadout_json = ? WHERE id = ?",
                (json.dumps(next_slots, ensure_ascii=False), account_id),
            )
            profile = self._profile(account_id)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return {"profile": profile}

    def salvage_part(self, token, part_id):
        part_id = str(part_id or "").strip()
        if not part_id:
            raise ValueError("Нет детали")
        account_id = self._account_row(token)["id"]
        self.db.execute("BEGIN IMMEDIATE")
        try:
            part = self._part_by_id(account_id, part_id)
            if part is None:
                raise ValueError("Нет детали")
            row = self.db.execute("SELECT loadout_json FROM accounts WHERE id = ?", (account_id,)).fetchone()
            slots = json.loads(row["loadout_json"] or DEFAULT_LOADOUT_JSON)
            if part_id in slots:
                raise ValueError("Деталь надета")
            refund = SALVAGE_CRYSTALS.get(part["rarity"], 0)
            self.db.execute(
                "DELETE FROM account_parts WHERE account_id = ? AND id = ?",
                (account_id, part_id),
            )
            self.db.execute(
                "UPDATE accounts SET crystals = crystals + ? WHERE id = ?",
                (refund, account_id),
            )
            profile = self._profile(account_id)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return {"profile": profile, "crystals": refund}

    def upgrade_part(self, token, part_id):
        part_id = str(part_id or "").strip()
        if not part_id:
            raise ValueError("Нет детали")
        account_id = self._account_row(token)["id"]
        self.db.execute("BEGIN IMMEDIATE")
        try:
            part = self._part_by_id(account_id, part_id)
            if part is None:
                raise ValueError("Нет детали")
            idx = PART_RARITY_ORDER.index(part["rarity"]) if part["rarity"] in PART_RARITY_ORDER else -1
            if idx < 0 or idx >= len(PART_RARITY_ORDER) - 1:
                raise ValueError("Уже максимум")
            next_rarity = PART_RARITY_ORDER[idx + 1]
            cost = UPGRADE_COST.get(part["rarity"])
            if cost is None:
                raise ValueError("Нельзя улучшить")
            account = self.db.execute("SELECT crystals FROM accounts WHERE id = ?", (account_id,)).fetchone()
            if account["crystals"] < cost:
                raise ValueError("Мало кристаллов")
            step = PART_RARITY_STEP[next_rarity]
            affixes = []
            for affix in part["affixes"]:
                updated = dict(affix)
                updated["step"] = step
                affixes.append(updated)
            self.db.execute(
                "UPDATE account_parts SET rarity = ?, affixes_json = ? WHERE account_id = ? AND id = ?",
                (next_rarity, json.dumps(affixes, ensure_ascii=False), account_id, part_id),
            )
            self.db.execute(
                "UPDATE accounts SET crystals = crystals - ? WHERE id = ?",
                (cost, account_id),
            )
            profile = self._profile(account_id)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
        return {"profile": profile, "part": self._part_by_id(account_id, part_id)}

    def record_run_start(self, token, body, now=None):
        row = self._account_row(token)
        now = (now or datetime.now(timezone.utc)).isoformat()
        run_id = str((body or {}).get("runId") or "").strip()
        if not run_id:
            raise ValueError("Нет номера забега")
        self.db.execute(
            """
            INSERT INTO run_events (
                run_id, account_id, is_tester, is_guest, started_at,
                start_level, weapons_json, parts_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(run_id, account_id) DO NOTHING
            """,
            (
                run_id,
                row["id"],
                1 if is_tester_name(row["name"]) else 0,
                1 if row["is_guest"] else 0,
                now,
                _as_int(body.get("level")),
                json.dumps(body.get("weapons") or [], ensure_ascii=False),
                json.dumps(body.get("parts") or [], ensure_ascii=False),
            ),
        )
        self.db.commit()
        return {"ok": True}

    def record_run_end(self, token, body, now=None):
        row = self._account_row(token)
        now = (now or datetime.now(timezone.utc)).isoformat()
        body = body or {}
        run_id = str(body.get("runId") or "").strip()
        if not run_id:
            raise ValueError("Нет номера забега")
        outcome = str(body.get("outcome") or "").strip()
        if outcome not in ("died", "cleared", "quit"):
            raise ValueError("Некорректный итог")
        self.db.execute(
            """
            INSERT INTO run_events (
                run_id, account_id, is_tester, is_guest, started_at, ended_at,
                outcome, end_level, end_wave, duration, kills,
                cards_json, branches_json, legendaries_json, damage_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(run_id, account_id) DO UPDATE SET
                ended_at = excluded.ended_at,
                outcome = excluded.outcome,
                end_level = excluded.end_level,
                end_wave = excluded.end_wave,
                duration = excluded.duration,
                kills = excluded.kills,
                cards_json = excluded.cards_json,
                branches_json = excluded.branches_json,
                legendaries_json = excluded.legendaries_json,
                damage_json = excluded.damage_json
            WHERE run_events.ended_at IS NULL
            """,
            (
                run_id,
                row["id"],
                1 if is_tester_name(row["name"]) else 0,
                1 if row["is_guest"] else 0,
                now,
                now,
                outcome,
                _as_int(body.get("level")),
                _as_int(body.get("wave")),
                _as_float(body.get("duration")),
                _as_int(body.get("kills")),
                json.dumps(body.get("cards") or [], ensure_ascii=False),
                json.dumps(body.get("branches") or {}, ensure_ascii=False),
                json.dumps(body.get("legendaries") or [], ensure_ascii=False),
                json.dumps(_clean_shares(body.get("damage")), ensure_ascii=False),
            ),
        )
        self.db.commit()
        return {"ok": True}

    def purge_old_events(self, now=None):
        now = now or datetime.now(timezone.utc)
        cutoff = (now - timedelta(days=EVENT_RETENTION_DAYS)).isoformat()
        self.db.execute(
            "DELETE FROM run_events WHERE COALESCE(ended_at, started_at) < ?",
            (cutoff,),
        )
        self.db.commit()

    def stats_summary(self, days=7, now=None):
        now = now or datetime.now(timezone.utc)
        where = "is_tester = 0"
        params = []
        if days != "all":
            cutoff = (now - timedelta(days=int(days))).isoformat()
            where += " AND COALESCE(started_at, ended_at) >= ?"
            params.append(cutoff)
        rows = self.db.execute(
            f"SELECT * FROM run_events WHERE {where}", params
        ).fetchall()

        by_day = {}
        deaths = {}
        weapon_branches = {}
        cards = {}
        legendaries = {}
        durations = []
        started = 0
        ended = 0
        abandoned = 0
        cleared_any = 0
        damage_totals = {}
        damage_runs = 0
        for row in rows:
            started += 1
            stamp = row["started_at"] or row["ended_at"] or ""
            day = stamp[:10]
            if day:
                by_day[day] = by_day.get(day, 0) + 1
            if row["ended_at"] is None:
                abandoned += 1
                continue
            ended += 1
            if row["outcome"] == "died":
                key = f"{row['end_level']}-{row['end_wave']}"
                deaths[key] = deaths.get(key, 0) + 1
            if row["outcome"] == "cleared" or (row["end_level"] or 0) > (row["start_level"] or 1):
                cleared_any += 1
            if row["duration"] is not None:
                durations.append(row["duration"])
            for weapon, branch in json.loads(row["branches_json"] or "{}").items():
                bucket = weapon_branches.setdefault(weapon, {})
                bucket[branch] = bucket.get(branch, 0) + 1
            for card in json.loads(row["cards_json"] or "[]"):
                name = card.get("title") if isinstance(card, dict) else card
                if name:
                    cards[name] = cards.get(name, 0) + 1
            for name in json.loads(row["legendaries_json"] or "[]"):
                legendaries[name] = legendaries.get(name, 0) + 1
            shares = _clean_shares(json.loads(row["damage_json"] or "{}"))
            if shares:
                damage_runs += 1
                for weapon, share in shares.items():
                    damage_totals[weapon] = damage_totals.get(weapon, 0) + share

        guests = self.db.execute(
            "SELECT COUNT(*) AS n FROM accounts WHERE is_guest = 1"
        ).fetchone()["n"]
        saved = self.db.execute(
            "SELECT COUNT(*) AS n FROM accounts WHERE is_guest = 0"
        ).fetchone()["n"]
        avg_duration = round(sum(durations) / len(durations), 1) if durations else 0
        top_cards = sorted(cards.items(), key=lambda kv: kv[1], reverse=True)[:15]
        avg_damage = (
            {weapon: round(total / damage_runs, 3) for weapon, total in damage_totals.items()}
            if damage_runs
            else {}
        )
        avg_damage = dict(sorted(avg_damage.items(), key=lambda kv: kv[1], reverse=True))
        return {
            "days": days,
            "runs": started,
            "ended": ended,
            "abandoned": abandoned,
            "clearRate": round(cleared_any / ended, 3) if ended else 0,
            "avgDuration": avg_duration,
            "byDay": dict(sorted(by_day.items())),
            "deaths": dict(sorted(deaths.items())),
            "weaponBranches": weapon_branches,
            "legendaries": dict(sorted(legendaries.items(), key=lambda kv: kv[1], reverse=True)),
            "topCards": top_cards,
            "avgDamage": avg_damage,
            "damageRuns": damage_runs,
            "guests": guests,
            "saved": saved,
        }

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
            "hangar": self._hangar_state(account_id, row),
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
            "parts": self._parts_list(account_id),
            "loadout": json.loads(row["loadout_json"] or DEFAULT_LOADOUT_JSON),
            "partsDry": int(row["parts_dry"] or 0),
            "tester": is_tester_name(row["name"]),
            "isGuest": bool(row["is_guest"]),
        }

    def _hangar_state(self, account_id, row):
        hangar = {"atk": row["hangar_atk"], "hp": row["hangar_hp"], "charge": row["hangar_charge"]}
        for node in HANGAR_TREE:
            hangar[node] = 0
        for item in self.db.execute(
            "SELECT node, level FROM account_hangar_nodes WHERE account_id = ?",
            (account_id,),
        ):
            hangar[item["node"]] = int(item["level"])
        return hangar

    def _parts_list(self, account_id):
        items = []
        for item in self.db.execute(
            """
            SELECT id, base, base_name, family, rarity, affixes_json
            FROM account_parts WHERE account_id = ? ORDER BY id
            """,
            (account_id,),
        ):
            items.append(
                {
                    "id": item["id"],
                    "base": item["base"],
                    "baseName": item["base_name"],
                    "family": item["family"],
                    "rarity": item["rarity"],
                    "affixes": json.loads(item["affixes_json"] or "[]"),
                }
            )
        return items

    def _part_by_id(self, account_id, part_id):
        row = self.db.execute(
            """
            SELECT id, base, base_name, family, rarity, affixes_json
            FROM account_parts WHERE account_id = ? AND id = ?
            """,
            (account_id, part_id),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "base": row["base"],
            "baseName": row["base_name"],
            "family": row["family"],
            "rarity": row["rarity"],
            "affixes": json.loads(row["affixes_json"] or "[]"),
        }

    def _record_roll_miss(self, account_id, roll_key, kind):
        self.db.execute(
            "INSERT INTO part_rolls (account_id, roll_key, part_id) VALUES (?, ?, ?)",
            (account_id, roll_key, ""),
        )
        if kind == "level":
            self.db.execute(
                "UPDATE accounts SET parts_dry = parts_dry + 1 WHERE id = ?",
                (account_id,),
            )

    def _insert_part(self, account_id, part):
        self.db.execute(
            """
            INSERT INTO account_parts (id, account_id, base, base_name, family, rarity, affixes_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                part["id"],
                account_id,
                part["base"],
                part.get("baseName") or part.get("base_name") or "",
                part.get("family"),
                part["rarity"],
                json.dumps(part.get("affixes") or [], ensure_ascii=False),
            ),
        )

    def _owned_weapon_families(self, account_id):
        owned = {"gun", "drone"}
        for item in self._weapons(account_id):
            if item not in owned:
                owned.add(item)
        return sorted(owned)

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


def _as_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _clean_shares(value):
    if not isinstance(value, dict):
        return {}
    cleaned = {}
    for key, raw in value.items():
        try:
            share = float(raw)
        except (TypeError, ValueError):
            continue
        if share > 0:
            cleaned[str(key)] = min(1.0, share)
    return cleaned


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
