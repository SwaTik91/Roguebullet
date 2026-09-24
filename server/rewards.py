import math

ENEMY_COINS = {
    "circle": 2,
    "triangle": 2,
    "square": 3,
    "hex": 3,
    "diamond": 3,
    "split": 1,
    "boss": 28,
}


def coin_reward(kills, ended_level, ended_wave, won, started_level=1):
    total = sum(int(kills.get(kind, 0)) * coins for kind, coins in ENEMY_COINS.items())
    total += (int(ended_level) - int(started_level)) * 6 + int(ended_wave)
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


def levels_in_run(started_level, levels_cleared, already):
    owned = set(already)
    played = []
    for offset in range(int(levels_cleared)):
        level = int(started_level) + offset
        if level < 1 or level > 3:
            break
        if not set(range(1, level)).issubset(owned | set(played)):
            break
        played.append(level)
    return played


def first_clear_crystals(already, levels_cleared, started_level=1):
    owned = set(already)
    new_levels = []
    crystals = 0
    autos = []
    payout = {1: 8, 2: 12, 3: 20}
    for level in levels_in_run(started_level, levels_cleared, owned):
        if level in owned:
            continue
        new_levels.append(level)
        crystals += payout[level]
        if level == 1:
            autos.append("first_boss")
        if level == 3:
            autos.append("three_levels")
    return new_levels, crystals, autos


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


def validate_endless(level, wave):
    if type(level) is not int or level not in range(1, 4):
        raise ValueError("Некорректный уровень")
    if type(wave) is not int or wave not in range(1, 41):
        raise ValueError("Некорректная волна")
    return level, wave


def endless_crystals(level, wave):
    validate_endless(level, wave)
    return 5


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
