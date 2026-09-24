const TOKEN_KEY = "roguebullet-token";

export function newId(cryptoObj = globalThis.crypto) {
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    try {
      return cryptoObj.randomUUID();
    } catch {
      // The game is served over plain HTTP, where some phones hide randomUUID.
    }
  }
  const bytes = new Uint8Array(16);
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") cryptoObj.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createApi({ base, storage, fetch: fetchImpl }) {
  const request = async (path, { method = "GET", body, auth = true } = {}) => {
    const headers = { "Content-Type": "application/json" };
    if (auth) {
      const token = storage.getItem(TOKEN_KEY) || "";
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Запрос не прошёл");
    return data;
  };

  return {
    token() {
      return storage.getItem(TOKEN_KEY) || "";
    },
    async register(name, password) {
      const data = await request("/register", { method: "POST", body: { name, password }, auth: false });
      storage.setItem(TOKEN_KEY, data.token || "");
      return data;
    },
    async login(name, password) {
      const data = await request("/login", { method: "POST", body: { name, password }, auth: false });
      storage.setItem(TOKEN_KEY, data.token || "");
      return data;
    },
    me() {
      return request("/me");
    },
    claimRun(facts) {
      return request("/runs", { method: "POST", body: facts });
    },
    takeCard(runId) {
      return request("/cards/take", { method: "POST", body: { runId } });
    },
    buyHangar(key) {
      return request("/hangar", { method: "POST", body: { key } });
    },
    buyShop(kind, weapon) {
      const body = { kind };
      if (weapon) body.weapon = weapon;
      return request("/shop", { method: "POST", body });
    },
    openChest(requestId) {
      return request("/chest", { method: "POST", body: { requestId } });
    },
    claimAchievement(id) {
      return request(`/achievements/${encodeURIComponent(id)}/claim`, { method: "POST", body: {} });
    },
    claimDaily(id) {
      return request(`/dailies/${encodeURIComponent(id)}/claim`, { method: "POST", body: {} });
    },
    claimEndless(level, wave) {
      return request("/endless", { method: "POST", body: { level, wave } });
    },
    buyReroll(runId, offerLevel) {
      return request("/reroll", { method: "POST", body: { runId, offerLevel } });
    },
    equipPart(partId) {
      return request("/parts/equip", { method: "POST", body: { partId } });
    },
    unequipPart(slot) {
      return request("/parts/unequip", { method: "POST", body: { slot } });
    },
    rollPart(body) {
      return request("/parts/roll", { method: "POST", body });
    },
    devCrystals(amount = 100) {
      return request("/dev/crystals", { method: "POST", body: { amount } });
    },
    devPart(rarity) {
      return request("/dev/part", { method: "POST", body: { rarity } });
    },
    battleStart(body) {
      return request("/battle/start", { method: "POST", body });
    },
    battleSync(body) {
      return request("/battle/sync", { method: "POST", body });
    },
  };
}

export const api =
  typeof localStorage === "undefined" || typeof fetch === "undefined"
    ? null
    : createApi({
        base: localStorage.getItem("roguebullet-api") || "http://157.22.230.112:8080",
        storage: localStorage,
        fetch: (...args) => fetch(...args),
      });
