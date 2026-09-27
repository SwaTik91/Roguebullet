import { upgradeCost } from "./storage.js";

export const HANGAR_TREE = [
  { id: "atk", title: "Мощность ядра", desc: "+12% урона пулемёта за уровень", legacy: true, requires: null },
  { id: "hp", title: "Обшивка", desc: "+40 HP ядра за уровень", legacy: true, requires: null },
  { id: "charge", title: "Конденсатор", desc: "Овердрайв копится быстрее", legacy: true, requires: null },
  { id: "crit", title: "Прицельный контур", desc: "+1% базового крита за уровень", max: 5, base: 60, growth: 1.6, requires: { node: "atk", level: 2 } },
  { id: "regen", title: "Ремонтный дрон", desc: "+0.5 реген ядра за уровень", max: 4, base: 70, growth: 1.7, requires: { node: "hp", level: 2 } },
  { id: "drive", title: "Овертайм", desc: "+0.3 с овердрайва за уровень", max: 3, base: 90, growth: 1.8, requires: { node: "charge", level: 2 } },
];

export const HANGAR_EFFECTS = { crit: 0.01, regen: 0.5, drive: 0.3 };

export function hangarNode(id) {
  return HANGAR_TREE.find((n) => n.id === id) || null;
}

export function hangarCost(id, level) {
  const node = hangarNode(id);
  if (!node) return null;
  if (node.legacy) return upgradeCost(level);
  return Math.round(node.base * Math.pow(node.growth, level));
}

export function hangarMax(id) {
  const node = hangarNode(id);
  if (!node) return 0;
  return node.legacy ? Infinity : node.max;
}

export function hangarUnlocked(hangar, id) {
  const node = hangarNode(id);
  if (!node || !node.requires) return true;
  return (hangar?.[node.requires.node] || 0) >= node.requires.level;
}

export function applyHangarTree(run, hangar) {
  if (!run || !hangar) return;
  if (run.crit) run.crit.chance += (hangar.crit || 0) * HANGAR_EFFECTS.crit;
  if (run.tower) run.tower.regen += (hangar.regen || 0) * HANGAR_EFFECTS.regen;
  if (run.overdrive) run.overdrive.dur += (hangar.drive || 0) * HANGAR_EFFECTS.drive;
}
