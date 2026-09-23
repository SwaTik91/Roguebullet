import unittest
from server.rewards import (
    achievement_crystals,
    apply_account_xp,
    buy_crystal_item,
    coin_reward,
    daily_tasks,
    first_clear_crystals,
    hangar_price,
    ready_achievements,
    roll_chest,
    xp_reward,
)


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
