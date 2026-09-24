import { readFileSync } from "node:fs";
import { rollPart, firstSlot, equipAt, unequip } from "../src/parts.js";

const raw = readFileSync(0, "utf8");
const input = JSON.parse(raw || "{}");

function makeRng(values) {
  let i = 0;
  return () => {
    if (i < values.length) return values[i++];
    return 0;
  };
}

let out;
switch (input.cmd) {
  case "rollPart":
    out = rollPart(makeRng(input.rngValues || []), input.ownedWeapons || [], input.options || {});
    break;
  case "firstSlot":
    out = firstSlot(input.parts || [], input.slots || [], input.partId);
    break;
  case "equipAt":
    out = equipAt(input.parts || [], input.slots || [], input.partId, input.index);
    break;
  case "unequip":
    out = { slots: unequip(input.slots || [], input.index) };
    break;
  default:
    out = { error: "unknown cmd" };
}

process.stdout.write(JSON.stringify(out));
