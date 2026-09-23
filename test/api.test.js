import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../src/api.js";

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
