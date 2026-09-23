# Account Rewards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a username-and-password account on the existing server so the browser game grants coins, account XP, and crystals from server rules at the end of a run.

**Architecture:** The battle stays in the browser. At the end of a run the client posts facts (`runId`, kills by type, waves and levels cleared). A Python standard-library API on port 8080 applies the reward rules and stores the account in SQLite. Purchases, chests, dailies, and achievements are separate POST requests. Port 80 keeps serving the static game. Ports 443 and 8443 stay untouched.

**Tech Stack:** Python 3.12 standard library (`http.server`, `sqlite3`, `hashlib`, `unittest`), existing Vite browser client, systemd on Ubuntu.

## Global Constraints

- Browser combat stays client-side. The server grants rewards from posted facts. This is variant 1.
- Android later needs variant 3: the server confirms every shot and every kill. Do not build that now. Account, coins, crystals, hangar, crystal shop, chest, achievements, and dailies stay the same.
- Login is a name and a password. No email. Store only a password hash. Session token lasts 30 days.
- No session means no battle, hangar, crystal shop, chest, dailies, or achievements.
- Static game stays on port 80. API listens on port 8080. SQLite file lives on the server. Do not bind 443 or 8443.
- The client never sends reward totals. It sends `runId`, kill counts by type, cleared waves, cleared levels, the level where the run ended, and the wave where it ended.
- The same `runId` returns the stored reward and does not grant it again.
- If the claim response is lost, the result screen stays and the same `runId` is retried.
- Coins per kill: sphere 2, wedge 2, cube 3, prism 3, shield 3, splinter 1, boss 28. Add `(endedLevel - 1) * 6 + endedWave`. Add 40 only when all 3 levels are cleared.
- Hangar coin prices start at 40 and each owned level multiplies the next price by 1.65, rounded.
- Account XP is battle only: 1 per kill, 10 per cleared wave, 40 per cleared level. Dailies and achievements give no XP.
- XP to advance from account level N is `80 * N`. Each new account level grants 4 crystals.
- First clear crystals: level 1 gives 8, level 2 gives 12, level 3 gives 20. Repeats give coins and XP only.
- Dailies reset at 00:00 Europe/Moscow. Clear wave 3 gives 2 crystals. Kill 40 enemies gives 2. Clear 1 level gives 4. Unclaimed daily rewards expire at reset.
- Achievements are once per account: first blood 2, first boss 8, all three levels 20, 100 kills 5, 500 kills 10, first hangar purchase 3, first chest 3. First boss and all three levels are granted with the matching first clear. The others are claimed from the achievements screen.
- Crystal shop: crit +2% for 25 crystals, maximum 5 purchases. One starting secondary weapon for 40 crystals, each weapon once. Fourth card offer for 50 crystals, once.
- Shared bonus-crit cap from shop and chest is +10% on top of the existing 8% base.
- Starting weapons are laser, scatter, grenade, emp, orb, and drone.
- Chest costs 20 crystals. Equal chance among the available outcomes: 100 coins, 200 coins, 4 crystals back, +1% crit only while bonus crit is under +10%, or one random common card. Common cards are Калибр, Темп, Сервопривод, and Пластины. Chest cards queue, and one is consumed at the start of the next run.
- Out of scope: per-shot server authority, email, password recovery, payments, and levels beyond the current three.

## File structure

- `server/rewards.py` — pure reward, shop, chest, daily, and achievement rules. No I/O.
- `server/store.py` — SQLite accounts, sessions, claims, and purchases.
- `server/app.py` — HTTP API over those two modules.
- `server/test_rewards.py` — rule tests.
- `server/test_store.py` — database tests against a temporary file.
- `src/api.js` — browser calls and session token.
- `src/game.js` — collect run facts, apply server profile at run start, retry claim.
- `src/main.js` — login gate and meta screens.
- `index.html` — login, crystal shop, chest, dailies, achievements.
- `src/style.css` — only the new screen layout that the existing screens do not cover.
- `deploy/roguebullet-api.service` — systemd unit for port 8080.

---

### Task 1: Battle reward rules

**Files:**
- Create: `server/rewards.py`
- Test: `server/test_rewards.py`

**Interfaces:**
- Consumes: nothing
- Produces: `coin_reward(kills, ended_level, ended_wave, won) -> int`, `xp_reward(kills, waves_cleared, levels_cleared) -> int`, `apply_account_xp(level, xp, gained) -> tuple[int, int, int]` returning `(new_level, new_xp, crystals)`, `first_clear_crystals(already, levels_cleared) -> tuple[list[int], int, list[str]]` returning `(new_levels, crystals, auto_achievements)`

- [ ] **Step 1: Write the failing test**

```python
import unittest
from server.rewards import apply_account_xp, coin_reward, first_clear_crystals, xp_reward

class RewardTests(unittest.TestCase):
    def test_coins_add_kill_table_progress_and_win_bonus(self):
        kills = {"circle": 2, "triangle": 0, "square": 1, "hex": 0, "diamond": 0, "split": 1, "boss": 1}
        self.assertEqual(coin_reward(kills, 3, 6, True), 2 * 2 + 3 + 1 + 28 + 12 + 6 + 40)

    def test_death_has_no_win_bonus(self):
        kills = {"circle": 1, "triangle": 0, "square": 0, "hex": 0, "diamond": 0, "split": 0, "boss": 0}
        self.assertEqual(coin_reward(kills, 2, 3, False), 2 + 6 + 3)

    def test_xp_ignores_anything_but_battle_counts(self):
        kills = {"circle": 4, "boss": 1}
        self.assertEqual(xp_reward(kills, 6, 1), 5 + 60 + 40)

    def test_account_level_grants_four_crystals_per_level(self):
        self.assertEqual(apply_account_xp(1, 70, 20), (2, 10, 4))

    def test_first_clear_pays_once_and_names_auto_achievements(self):
        levels, crystals, autos = first_clear_crystals(set(), 3)
        self.assertEqual(levels, [1, 2, 3])
        self.assertEqual(crystals, 8 + 12 + 20)
        self.assertEqual(autos, ["first_boss", "three_levels"])
        again, crystals2, autos2 = first_clear_crystals({1, 2, 3}, 3)
        self.assertEqual((again, crystals2, autos2), ([], 0, []))

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest server.test_rewards -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'server.rewards'`

- [ ] **Step 3: Write minimal implementation**

Create `server/__init__.py` as an empty file and `server/rewards.py`:

```python
ENEMY_COINS = {
    "circle": 2,
    "triangle": 2,
    "square": 3,
    "hex": 3,
    "diamond": 3,
    "split": 1,
    "boss": 28,
}

def coin_reward(kills, ended_level, ended_wave, won):
    total = sum(int(kills.get(kind, 0)) * coins for kind, coins in ENEMY_COINS.items())
    total += (int(ended_level) - 1) * 6 + int(ended_wave)
    if won:
        total += 40
    return total

def xp_reward(kills, waves_cleared, levels_cleared):
    kills_total = sum(int(kills.get(kind, 0)) for kind in ENEMY_COINS)
    return kills_total + 10 * int(waves_cleared) + 40 * int(levels_cleared)

def apply_account_xp(level, xp, gained):
    level = int(level)
    xp = int(xp) + int(gained)
    crystals = 0
    while xp >= 80 * level:
        xp -= 80 * level
        level += 1
        crystals += 4
    return level, xp, crystals

def first_clear_crystals(already, levels_cleared):
    owned = set(already)
    new_levels = []
    crystals = 0
    autos = []
    payout = {1: 8, 2: 12, 3: 20}
    for level in range(1, int(levels_cleared) + 1):
        if level in owned:
            continue
        new_levels.append(level)
        crystals += payout[level]
        if level == 1:
            autos.append("first_boss")
        if level == 3:
            autos.append("three_levels")
    return new_levels, crystals, autos
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest server.test_rewards -v`

Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add server/__init__.py server/rewards.py server/test_rewards.py
git commit -m "Add pure battle reward rules."
```

### Task 2: Dailies, achievements, shop, and chest

**Files:**
- Modify: `server/rewards.py`
- Modify: `server/test_rewards.py`

**Interfaces:**
- Consumes: `ENEMY_COINS` from Task 1
- Produces: `daily_tasks(kills_today, cleared_wave3, cleared_level, claimed) -> list[dict]`, `ready_achievements(stats, claimed) -> list[str]`, `achievement_crystals(achievement_id) -> int`, `hangar_price(owned_level) -> int`, `buy_crystal_item(profile, kind, weapon=None) -> dict`, `roll_chest(profile, rng) -> dict`

- [ ] **Step 1: Write the failing test**

Append to `server/test_rewards.py`:

```python
from server.rewards import (
    achievement_crystals,
    buy_crystal_item,
    daily_tasks,
    hangar_price,
    ready_achievements,
    roll_chest,
)

class MetaTests(unittest.TestCase):
    def test_daily_tasks_mark_done_and_claimed(self):
        tasks = daily_tasks(40, True, False, {"wave3"})
        by_id = {task["id"]: task for task in tasks}
        self.assertEqual(by_id["wave3"], {"id": "wave3", "crystals": 2, "done": True, "claimed": True})
        self.assertEqual(by_id["kills40"]["done"], True)
        self.assertEqual(by_id["kills40"]["claimed"], False)
        self.assertEqual(by_id["level"]["done"], False)

    def test_ready_achievements_skip_claimed(self):
        stats = {"kills": 100, "cleared_levels": {1}, "hangar_buys": 1, "chests": 0}
        ready = ready_achievements(stats, {"first_blood"})
        self.assertEqual(ready, ["first_boss", "kills_100", "hangar"])

    def test_achievement_amounts(self):
        self.assertEqual(achievement_crystals("three_levels"), 20)
        self.assertEqual(achievement_crystals("chest"), 3)

    def test_hangar_price_matches_existing_curve(self):
        self.assertEqual(hangar_price(0), 40)
        self.assertEqual(hangar_price(1), 66)

    def test_shop_rejects_a_sixth_crit_and_a_repeat_weapon(self):
        profile = {"crystals": 100, "crit_bonus": 10, "weapons": ["laser"], "fourth_card": False}
        with self.assertRaises(ValueError):
            buy_crystal_item(profile, "crit")
        with self.assertRaises(ValueError):
            buy_crystal_item(profile, "weapon", "laser")

    def test_shop_buys_fourth_card_once(self):
        profile = {"crystals": 50, "crit_bonus": 0, "weapons": [], "fourth_card": False}
        bought = buy_crystal_item(profile, "fourth_card")
        self.assertEqual(bought["crystals"], 0)
        self.assertEqual(bought["fourth_card"], True)

    def test_chest_omits_crit_at_the_cap_and_queues_a_known_card(self):
        class Seq:
            def __init__(self, values):
                self.values = list(values)
            def randrange(self, count):
                return self.values.pop(0)
        profile = {"crit_bonus": 10}
        drop = roll_chest(profile, Seq([3, 1]))
        self.assertEqual(drop["kind"], "card")
        self.assertIn(drop["card"], ["Калибр", "Темп", "Сервопривод", "Пластины"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest server.test_rewards.MetaTests -v`

Expected: FAIL with `ImportError` for `daily_tasks`

- [ ] **Step 3: Write minimal implementation**

Append to `server/rewards.py`:

```python
import math

DAILY = (
    ("wave3", 2),
    ("kills40", 2),
    ("level", 4),
)
ACHIEVEMENT_CRYSTALS = {
    "first_blood": 2,
    "first_boss": 8,
    "three_levels": 20,
    "kills_100": 5,
    "kills_500": 10,
    "hangar": 3,
    "chest": 3,
}
WEAPONS = ("laser", "scatter", "grenade", "emp", "orb", "drone")
COMMON_CARDS = ("Калибр", "Темп", "Сервопривод", "Пластины")
CRIT_CAP = 10

def daily_tasks(kills_today, cleared_wave3, cleared_level, claimed):
    done = {"wave3": bool(cleared_wave3), "kills40": int(kills_today) >= 40, "level": bool(cleared_level)}
    return [
        {"id": task_id, "crystals": crystals, "done": done[task_id], "claimed": task_id in set(claimed)}
        for task_id, crystals in DAILY
    ]

def ready_achievements(stats, claimed):
    cleared = set(stats["cleared_levels"])
    ready = []
    if stats["kills"] >= 1:
        ready.append("first_blood")
    if 1 in cleared:
        ready.append("first_boss")
    if 3 in cleared:
        ready.append("three_levels")
    if stats["kills"] >= 100:
        ready.append("kills_100")
    if stats["kills"] >= 500:
        ready.append("kills_500")
    if stats["hangar_buys"] >= 1:
        ready.append("hangar")
    if stats["chests"] >= 1:
        ready.append("chest")
    owned = set(claimed)
    return [item for item in ready if item not in owned]

def achievement_crystals(achievement_id):
    return ACHIEVEMENT_CRYSTALS[achievement_id]

def hangar_price(owned_level):
    return round(40 * math.pow(1.65, int(owned_level)))

def buy_crystal_item(profile, kind, weapon=None):
    crystals = int(profile["crystals"])
    crit_bonus = int(profile["crit_bonus"])
    weapons = list(profile["weapons"])
    fourth_card = bool(profile["fourth_card"])
    if kind == "crit":
        if crit_bonus + 2 > CRIT_CAP:
            raise ValueError("crit cap")
        if crystals < 25:
            raise ValueError("crystals")
        return {**profile, "crystals": crystals - 25, "crit_bonus": crit_bonus + 2}
    if kind == "weapon":
        if weapon not in WEAPONS or weapon in weapons:
            raise ValueError("weapon")
        if crystals < 40:
            raise ValueError("crystals")
        return {**profile, "crystals": crystals - 40, "weapons": weapons + [weapon]}
    if kind == "fourth_card":
        if fourth_card:
            raise ValueError("owned")
        if crystals < 50:
            raise ValueError("crystals")
        return {**profile, "crystals": crystals - 50, "fourth_card": True}
    raise ValueError("kind")

def roll_chest(profile, rng):
    outcomes = [
        {"kind": "coins", "amount": 100},
        {"kind": "coins", "amount": 200},
        {"kind": "crystals", "amount": 4},
        {"kind": "card"},
    ]
    if int(profile["crit_bonus"]) < CRIT_CAP:
        outcomes.append({"kind": "crit", "amount": 1})
    pick = dict(outcomes[rng.randrange(len(outcomes))])
    if pick["kind"] == "card":
        pick["card"] = COMMON_CARDS[rng.randrange(len(COMMON_CARDS))]
    return pick
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest server.test_rewards -v`

Expected: PASS, 12 tests

- [ ] **Step 5: Commit**

```bash
git add server/rewards.py server/test_rewards.py
git commit -m "Add daily, achievement, shop, and chest rules."
```

### Task 3: Account store

**Files:**
- Create: `server/store.py`
- Test: `server/test_store.py`

**Interfaces:**
- Consumes: `coin_reward`, `xp_reward`, `apply_account_xp`, `first_clear_crystals`, `ready_achievements`, `achievement_crystals`, `hangar_price`, `buy_crystal_item`, `roll_chest`, `daily_tasks` from `server.rewards`
- Produces: `Store(path)`, `Store.register(name, password) -> dict`, `Store.login(name, password) -> dict`, `Store.account_for_token(token) -> dict`, `Store.claim_run(token, facts, now) -> dict`, `Store.buy_hangar(token, key) -> dict`, `Store.buy_shop(token, kind, weapon=None) -> dict`, `Store.open_chest(token, rng) -> dict`, `Store.claim_achievement(token, achievement_id) -> dict`, `Store.claim_daily(token, task_id, now) -> dict`. Every public profile dict has `name`, `coins`, `crystals`, `xp`, `accountLevel`, `critBonus`, `fourthCard`, `weapons`, `hangar`, `cardQueue`, `clearedLevels`, `achievements`, and `dailies`.

- [ ] **Step 1: Write the failing test**

```python
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
        self.assertEqual(first["profile"]["clearedLevels"], [1])

if __name__ == "__main__":
    unittest.main()
```

The expected crystal total is first-clear level 1 (8), automatic first-boss achievement (8), and one account level from XP. XP is 2 kills + 6 waves * 10 + 1 level * 40 = 102. Level 1 spends 80 XP and grants 4 crystals, leaving 22 XP. Coins are 2 + 28 + 0 * 6 + 6 = 36.

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest server.test_store -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'server.store'`

- [ ] **Step 3: Write minimal implementation**

Create `server/store.py` with SQLite tables `accounts`, `sessions`, `cleared_levels`, `claimed_runs`, `achievements`, `daily`, `owned_weapons`, and `card_queue`.

`register` inserts a row with `pbkdf2_hmac` SHA-256, 200000 iterations, and a 16-byte salt stored as `salt_hex$hash_hex`. It creates a session immediately. `login` checks the hash with `hmac.compare_digest` and inserts a session whose `expires_at` is 30 days after `datetime.now(timezone.utc)`. Store only `sha256(token)` in `sessions`.

`claim_run` reads the account inside a transaction. If `claimed_runs` already has `runId` for that account, return the saved JSON. Otherwise reject facts where `levelsCleared` is outside 0..3, `endedLevel` is outside 1..3, `endedWave` is outside 1..6, `wavesCleared` is outside 0..18, `won` is true while `levelsCleared != 3`, or any kill count is negative. Apply `coin_reward`, `xp_reward`, `apply_account_xp`, and `first_clear_crystals`. Insert automatic achievements `first_boss` and `three_levels` as claimed and add their crystals. Add today's kill count, set `wave3` when `wavesCleared >= 3` or an earlier level was cleared, and set `level_clear` when `levelsCleared >= 1`. Day key is the Moscow date of `now`. Save the full response JSON in `claimed_runs`.

Profile JSON uses the camelCase keys listed in Interfaces. `hangar` is `{"atk": n, "hp": n, "charge": n}`. `dailies` is the list from `daily_tasks`. `achievements` is a list of `{id, ready, claimed, crystals}`.

`buy_hangar` accepts `atk`, `hp`, or `charge`, charges `hangar_price`, increments that column and `hangar_buys`, and does not auto-claim the hangar achievement. `buy_shop` calls `buy_crystal_item` and writes the returned crystals, crit bonus, weapon, or fourth-card flag. `open_chest` requires 20 crystals, calls `roll_chest`, applies coins, crystals, crit, or appends a card queue row, increments `chests_opened`, and returns the drop. `claim_achievement` pays `achievement_crystals` only when the id is in `ready_achievements` and is not already claimed. `claim_daily` pays the task crystals only when that task is done, unclaimed, and the Moscow date is still `now`'s date.

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest server.test_store server.test_rewards -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/store.py server/test_store.py
git commit -m "Persist accounts and idempotent run claims."
```

### Task 4: HTTP API

**Files:**
- Create: `server/app.py`
- Modify: `server/test_store.py`

**Interfaces:**
- Consumes: `Store` from Task 3
- Produces: `make_handler(store)`, `serve(host, port, db_path)`. Routes: `POST /register`, `POST /login`, `GET /me`, `POST /runs`, `POST /hangar`, `POST /shop`, `POST /chest`, `POST /achievements/{id}/claim`, `POST /dailies/{id}/claim`. Authenticated routes read `Authorization: Bearer <token>`. JSON errors use status 400 and `{"error": "<message>"}`.

- [ ] **Step 1: Write the failing test**

Append to `server/test_store.py`:

```python
import json
from server.app import make_handler
from http.server import BaseHTTPRequestHandler

class HandlerTests(unittest.TestCase):
    def test_register_then_me(self):
        store = Store(tempfile.mktemp(suffix=".sqlite"))
        handler_cls = make_handler(store)
        status, body = call(handler_cls, "POST", "/register", {"name": "Ada", "password": "secret-pass"})
        self.assertEqual(status, 200)
        token = body["token"]
        status, me = call(handler_cls, "GET", "/me", None, token)
        self.assertEqual(me["profile"]["coins"], 0)
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
    import io
    fake = Fake()
    getattr(fake, f"do_{method}")()
    return result.status, json.loads(fake.wfile.getvalue() or b"{}")
```

Move `import io` to the top of the test file instead of leaving it inside `call`.

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest server.test_store.HandlerTests -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'server.app'`

- [ ] **Step 3: Write minimal implementation**

`server/app.py` subclasses `BaseHTTPRequestHandler`. It adds `Access-Control-Allow-Origin: *` and handles `OPTIONS`. `POST /register` and `POST /login` call the store and return `{token, profile}`. The other routes require a bearer token. `POST /runs` passes the JSON body and `datetime.now(timezone.utc).astimezone()` as `now`. `POST /chest` passes `random.SystemRandom()`. Map `ValueError` to status 400. `serve` builds `Store(db_path)` and calls `HTTPServer((host, port), make_handler(store)).serve_forever()`.

Add at the bottom:

```python
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--db", default="/var/lib/roguebullet/account.sqlite")
    args = parser.parse_args()
    serve(args.host, args.port, args.db)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest server.test_store server.test_rewards -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/app.py server/test_store.py
git commit -m "Expose account rewards over HTTP."
```

### Task 5: Login gate in the browser

**Files:**
- Create: `src/api.js`
- Modify: `index.html`
- Modify: `src/main.js`
- Modify: `src/style.css`
- Modify: `package.json`

**Interfaces:**
- Consumes: API routes from Task 4. Default base is `http://157.22.230.112:8080`, overridable with `localStorage["roguebullet-api"]`.
- Produces: `api.register(name, password)`, `api.login(name, password)`, `api.me()`, `api.token()` returns the saved token or `""`. `main.js` does not call `game.startRun()` unless `api.token()` is non-empty.

- [ ] **Step 1: Write the failing test**

There is no browser test runner. Add `server/test_client_contract.py` only for the URL join helper by exporting nothing from JS. Instead, test the client contract with a small node test that mocks `fetch` after adding `src/api.js`.

Create `test/api.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../src/api.js";

test("login stores the token and me sends it", async () => {
  const saved = {};
  const calls = [];
  const api = createApi({
    base: "http://api.test",
    storage: {
      getItem: (key) => saved[key] || "",
      setItem: (key, value) => {
        saved[key] = value;
      },
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ token: "abc", profile: { name: "Ada", coins: 0 } }),
      };
    },
  });
  const session = await api.login("Ada", "secret-pass");
  assert.equal(session.token, "abc");
  assert.equal(api.token(), "abc");
  await api.me();
  assert.equal(calls[1].options.headers.Authorization, "Bearer abc");
});
```

Change the `test` script in `package.json` to `node --test test/api.test.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/api.test.js`

Expected: FAIL with `Cannot find module '../src/api.js'`

- [ ] **Step 3: Write minimal implementation**

`src/api.js` exports `createApi({ base, storage, fetch })` and a default `api` using `localStorage`, `window.fetch`, and `localStorage.getItem("roguebullet-api") || "http://157.22.230.112:8080"`. Token key is `roguebullet-token`. `login` and `register` POST JSON and save `token`. `me` GETs `/me` with the bearer header. Non-200 responses throw `Error` with the server `error` string.

In `index.html`, add `#screen-login` before `#screen-menu` with name input `#login-name`, password input `#login-password`, button `#btn-login`, button `#btn-register`, and error paragraph `#login-error`. Add menu buttons `#btn-shop`, `#btn-chest`, `#btn-dailies`, `#btn-achievements`. Show account level, coins, and crystals as `#menu-account`, `#menu-coins`, and a new `#menu-crystals`.

In `src/main.js`, on load call `api.me()`. On success show the menu and replace the local coin display with `profile`. On failure show `#screen-login` and hide the menu. `#btn-play` returns immediately when `api.token()` is empty.

Add `.field` styles for the two inputs: full width, 14px padding, dark background, light text, same radius as `.btn`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/api.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api.js test/api.test.js package.json index.html src/main.js src/style.css
git commit -m "Require a server session before the menu."
```

### Task 6: Claim a run and apply the profile

**Files:**
- Modify: `src/api.js`
- Modify: `src/game.js`
- Modify: `test/api.test.js`

**Interfaces:**
- Consumes: `POST /runs` from Task 4 and the profile fields `critBonus`, `fourthCard`, `weapons`, `hangar`, `cardQueue`
- Produces: `api.claimRun(facts) -> {granted, profile}`. `Game.startRun()` copies server hangar, crit, weapons, and one queued card into the run. `Game.end()` and `Game.advanceLevel()` do not write local coins. `end()` posts facts once and retries the same `runId` from `localStorage["roguebullet-pending-run"]` when the request fails.

- [ ] **Step 1: Write the failing test**

Extend `test/api.test.js` with a claim call that posts `runId` and does not send a `coins` field. Assert the request body has `kills` and no `coins`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/api.test.js`

Expected: FAIL because `api.claimRun` is undefined

- [ ] **Step 3: Write minimal implementation**

Add `claimRun(facts)` to `createApi`. It POSTs `/runs`.

In `Game.startRun()`, set `this.run.runId = crypto.randomUUID()` and `this.run.kills = {circle:0, triangle:0, square:0, hex:0, diamond:0, split:0, boss:0}`. Increment the matching counter in `kill()` using `e.type`, mapping split spawns to `split`. Track `this.run.wavesCleared` by incrementing it in `queueWave` only after a wave is fully cleared, before `wave` increments. Track `this.run.levelsCleared` in `advanceLevel` before the level number changes, and include the final level when `end(true)` runs.

`facts()` returns `{runId, kills, wavesCleared, levelsCleared, endedLevel: this.run.level, endedWave: this.run.wave, won: this.run.won}`.

`end()` saves those facts under `roguebullet-pending-run`, calls `api.claimRun`, clears the key on success, and passes `granted` to `ui.showResult`. On failure it leaves the key and shows the result with the text `Награда будет выдана при появлении связи`. On the next `showPlay` or menu load, if the key exists, call `claimRun` again.

Apply profile at the start of the run: `gun.dmg` includes `1 + critBonus / 100` in the crit chance (`run.crit.chance = 0.08 + critBonus / 100`), hangar levels replace `meta.atk`, `meta.hp`, and `meta.charge`, owned weapons are active with `defaultWep`, and the first queued card is applied through the existing card `apply` function for Калибр, Темп, Сервопривод, or Пластины. `pickCards` asks for 4 cards when `profile.fourthCard` is true.

Remove the local `meta.coins += gain` write from `end()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/api.test.js && python3 -m unittest server.test_rewards server.test_store -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api.js src/game.js test/api.test.js
git commit -m "Claim run rewards from the server."
```

### Task 7: Hangar, crystal shop, chest, dailies, and achievements

**Files:**
- Modify: `src/api.js`
- Modify: `src/main.js`
- Modify: `index.html`
- Modify: `test/api.test.js`

**Interfaces:**
- Consumes: `POST /hangar`, `POST /shop`, `POST /chest`, `POST /achievements/{id}/claim`, `POST /dailies/{id}/claim`
- Produces: menu screens that render the profile lists and replace the shown profile with the response profile after every successful call

- [ ] **Step 1: Write the failing test**

Add a node test that `createApi().buyShop("weapon", "laser")` POSTs `{"kind":"weapon","weapon":"laser"}` to `/shop` with the bearer token.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/api.test.js`

Expected: FAIL because `buyShop` is undefined

- [ ] **Step 3: Write minimal implementation**

Add `buyHangar(key)`, `buyShop(kind, weapon)`, `openChest()`, `claimAchievement(id)`, and `claimDaily(id)` to `src/api.js`.

Replace the local hangar renderer so prices and levels come from `profile.hangar` and the button calls `api.buyHangar`. Add screens for the crystal shop, one chest button, three daily rows, and seven achievement rows. Each row shows the spec title, crystal amount, and a button enabled only when the profile says it is ready and unclaimed. The chest button shows the returned drop text: coins, crystals, crit, or the queued card name. After every success, repaint the menu counters from the returned profile.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/api.test.js && python3 -m unittest discover -s server -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api.js src/main.js index.html test/api.test.js
git commit -m "Add crystal shop, chest, dailies, and achievements."
```

### Task 8: Deploy the API beside the static game

**Files:**
- Create: `deploy/roguebullet-api.service`

**Interfaces:**
- Consumes: `python3 -m server.app --port 8080 --db /var/lib/roguebullet/account.sqlite`
- Produces: a systemd service that restarts the API on boot without binding ports 80, 443, or 8443

- [ ] **Step 1: Write the service file**

```ini
[Unit]
Description=Roguebullet account API
After=network.target

[Service]
WorkingDirectory=/var/www/roguebullet-src
ExecStart=/usr/bin/python3 -m server.app --host 0.0.0.0 --port 8080 --db /var/lib/roguebullet/account.sqlite
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Run the local test suite before copying files**

Run: `python3 -m unittest discover -s server -v && node --test test/api.test.js && npm run build`

Expected: all tests PASS and `dist/` is rebuilt

- [ ] **Step 3: Install on the server**

Copy `server/` to `/var/www/roguebullet-src/server` and copy `dist/` to `/var/www/roguebullet`. Create `/var/lib/roguebullet`. Install the unit as `/etc/systemd/system/roguebullet-api.service`, then run `systemctl daemon-reload && systemctl enable --now roguebullet-api`. Open `8080/tcp` in ufw. Do not restart xray and do not change listeners on 443 or 8443.

- [ ] **Step 4: Verify the public endpoints**

Run from the development machine:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://157.22.230.112/
curl -s -X POST http://157.22.230.112:8080/register -H 'Content-Type: application/json' -d '{"name":"deploy-check","password":"deploy-check-pass"}'
```

Expected: the first command prints `200`. The second returns JSON with `token` and `profile`.

- [ ] **Step 5: Commit**

```bash
git add deploy/roguebullet-api.service
git commit -m "Add the account API service unit."
```
