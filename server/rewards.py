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
