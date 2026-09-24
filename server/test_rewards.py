import unittest
from server.rewards import (
    achievement_crystals,
    apply_account_xp,
    buy_crystal_item,
    coin_reward,
    daily_tasks,
    endless_crystals,
    first_clear_crystals,
    hangar_price,
    validate_endless,
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

    def test_endless_wave_pays_five_and_rejects_a_bad_level(self):
        self.assertEqual(endless_crystals(1, 1), 5)
        self.assertEqual(endless_crystals(3, 40), 5)
        self.assertEqual(validate_endless(2, 7), (2, 7))
        with self.assertRaises(ValueError):
            endless_crystals(0, 1)
        with self.assertRaises(ValueError):
            validate_endless(4, 1)

    def test_later_level_pays_only_after_earlier_ones(self):
        levels, crystals, autos = first_clear_crystals(set(), 1, 3)
        self.assertEqual((levels, crystals, autos), ([], 0, []))
        levels, crystals, autos = first_clear_crystals({1}, 2, 2)
        self.assertEqual(levels, [2, 3])
        self.assertEqual(crystals, 12 + 20)
        self.assertEqual(autos, ["three_levels"])


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


if __name__ == "__main__":
    unittest.main()
