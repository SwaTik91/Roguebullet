export const REROLL_COINS = [1000, 2000, 3000, 4000, 5000];
export const REROLL_CRYSTALS = [1, 2, 3, 4, 5, 10, 20];

export function rerollPrice(used) {
  const count = Number(used) || 0;
  if (count < 2) return { kind: "free", amount: 0 };
  const coinIndex = count - 2;
  if (coinIndex < REROLL_COINS.length) return { kind: "coins", amount: REROLL_COINS[coinIndex] };
  const crystalIndex = coinIndex - REROLL_COINS.length;
  if (crystalIndex < REROLL_CRYSTALS.length) return { kind: "crystals", amount: REROLL_CRYSTALS[crystalIndex] };
  return null;
}

export function rerollLabel(price) {
  if (!price) return "РЕРОЛЛ ЗАКОНЧИЛСЯ";
  if (price.kind === "free") return "ЕЩЁ РАЗ · БЕСПЛАТНО";
  if (price.kind === "coins") return `ЕЩЁ РАЗ · ${price.amount} МОНЕТ`;
  return `ЕЩЁ РАЗ · ${price.amount} КРИСТ.`;
}
