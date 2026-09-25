import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildCodex } from "../scripts/build-codex.mjs";

test("codex page lists the gun, the orb branch, a part and waves", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-"));
  const file = path.join(dir, "index.html");
  buildCodex(file);
  const html = fs.readFileSync(file, "utf8");
  assert.match(html, /Пулемёт/);
  assert.match(html, /Серп/);
  assert.match(html, /Ствол/);
  assert.match(html, /Волны/);
  assert.match(html, /Орбита/);
});
