import readline from "node:readline";
import { clearEndless, createBattle, snapshot, stepBattle } from "../src/battle.js";

const sessions = new Map();
const rl = readline.createInterface({ input: process.stdin });

function reply(id, payload) {
  process.stdout.write(`${JSON.stringify({ id, ...payload })}\n`);
}

rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const id = msg.id;
  try {
    if (msg.cmd === "start") {
      const session = createBattle(msg);
      sessions.set(msg.token, session);
      reply(id, { ok: true, snap: stepBattle(session, {}, session.last) });
      return;
    }
    const session = sessions.get(msg.token);
    if (!session) throw new Error("Бой не запущен");
    if (msg.cmd === "clear-endless") {
      clearEndless(session);
      reply(id, { ok: true });
      return;
    }
    if (msg.cmd === "snap") {
      reply(id, { ok: true, snap: snapshot(session) });
      return;
    }
    if (msg.cmd === "step") {
      reply(id, { ok: true, snap: stepBattle(session, msg) });
      return;
    }
    throw new Error("Неизвестная команда боя");
  } catch (error) {
    reply(id, { ok: false, error: error.message || "Бой остановился" });
  }
});
