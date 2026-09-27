export const RARITY_ORDER = ["common", "rare", "epic", "legendary"];

export const SALVAGE_CRYSTALS = {
  common: 3,
  rare: 8,
  epic: 18,
  legendary: 40,
};

export const UPGRADE_COST = {
  common: 12,
  rare: 30,
  epic: 70,
};

export function nextRarity(rarity) {
  const idx = RARITY_ORDER.indexOf(rarity);
  if (idx < 0 || idx >= RARITY_ORDER.length - 1) return null;
  return RARITY_ORDER[idx + 1];
}

export function salvageValue(rarity) {
  return SALVAGE_CRYSTALS[rarity] || 0;
}

export function upgradeCost(rarity) {
  return UPGRADE_COST[rarity] ?? null;
}

export function canUpgrade(rarity) {
  return nextRarity(rarity) !== null;
}
