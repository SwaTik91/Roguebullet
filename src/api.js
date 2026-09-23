const TOKEN_KEY = "roguebullet-token";

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
