import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi, newId } from "../src/api.js";

test("newId works when the page cannot use randomUUID", () => {
  const id = newId({
    randomUUID() {
      throw new Error("insecure");
    },
    getRandomValues(bytes) {
      bytes.fill(7);
    },
  });
  assert.equal(id, "07070707-0707-4707-8707-070707070707");
});

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

test("claim posts run facts without coin totals", async () => {
  const calls = [];
  const api = createApi({
    base: "http://api.test",
    storage: {
      getItem: () => "abc",
      setItem: () => {},
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ granted: { coins: 1, crystals: 0, xp: 1 }, profile: {} }),
      };
    },
  });
  await api.claimRun({
    runId: "run-1",
    kills: { circle: 1 },
    wavesCleared: 1,
    levelsCleared: 0,
    endedLevel: 1,
    endedWave: 1,
    won: false,
  });
  const body = JSON.parse(calls[0].options.body);
  assert.equal(calls[0].url, "http://api.test/runs");
  assert.equal(body.runId, "run-1");
  assert.equal(body.kills.circle, 1);
  assert.equal("coins" in body, false);
  assert.equal(calls[0].options.headers.Authorization, "Bearer abc");
});

test("buyShop posts the weapon to /shop", async () => {
  const calls = [];
  const api = createApi({
    base: "http://api.test",
    storage: {
      getItem: () => "abc",
      setItem: () => {},
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ profile: { crystals: 0 } }) };
    },
  });
  await api.buyShop("weapon", "laser");
  assert.equal(calls[0].url, "http://api.test/shop");
  assert.deepEqual(JSON.parse(calls[0].options.body), { kind: "weapon", weapon: "laser" });
  assert.equal(calls[0].options.headers.Authorization, "Bearer abc");
});
