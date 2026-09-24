import crypto from "node:crypto";
import http from "node:http";
import { Game } from "../src/game.js";
import { coopSnapshot, ensureSeats } from "../src/coop.js";

const rooms = new Map();
const audio = new Proxy({}, { get: () => () => {} });

function acceptKey(key) {
  return crypto.createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
}

function sendText(socket, text) {
  const data = Buffer.from(text);
  const len = data.length;
  let header;
  if (len < 126) header = Buffer.from([0x81, len]);
  else {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  }
  if (!socket.destroyed) socket.write(Buffer.concat([header, data]));
}

function readFrames(socket, onMsg) {
  let buf = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const opcode = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        len = Number(buf.readBigUInt64BE(2));
        off = 10;
      }
      const maskLen = masked ? 4 : 0;
      if (buf.length < off + maskLen + len) return;
      let payload = buf.subarray(off + maskLen, off + maskLen + len);
      if (masked) {
        const mask = buf.subarray(off, off + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      }
      buf = buf.subarray(off + maskLen + len);
      if (opcode === 8) {
        socket.end();
        return;
      }
      if (opcode === 1) onMsg(payload.toString());
    }
  });
}

function code() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return rooms.has(out) ? code() : out;
}

function openRoom(level) {
  const id = code();
  const room = {
    id,
    level: Math.min(3, Math.max(1, Number(level) || 1)),
    players: [],
    game: null,
    acc: 0,
    ui: {},
  };
  room.ui = {
    showPlay() {},
    updateHud() {},
    setCombo() {},
    save() {},
    hideCards() {},
    hideLevelClear() {},
    applyProfile() {},
    toast() {},
    onEndlessWave() {},
    showCards(cards, heading) {
      if (!room.game) return;
      room.game.run._cards = cards;
      room.game.run._heading = heading;
    },
    showLevelClear(info) {
      if (room.game) room.game.run._levelClear = info;
    },
    showResult(win, _run, granted) {
      if (room.game) room.game.run._result = { won: !!win, granted: granted || null };
    },
  };
  rooms.set(id, room);
  return room;
}

function begin(room) {
  const game = new Game(null, room.ui, audio, { bestWave: 0, bestLevel: 1 }, {
    headless: true,
    worldW: 720,
    worldH: 1280,
  });
  game.profile = {};
  game.startRun(room.level);
  game.run.worldW = 720;
  game.run.worldH = 1280;
  ensureSeats(game.run, 720, 1280);
  room.game = game;
}

function act(room, msg) {
  const game = room.game;
  if (!game) return;
  if (msg.t === "in") {
    const seat = game.run.seats?.[msg.seat];
    if (!seat) return;
    seat.pointer.x = Number(msg.x) || seat.x;
    seat.pointer.y = Number(msg.y) || seat.y;
    seat.pointer.down = !!msg.down;
  } else if (msg.t === "pick") {
    const card = (game.run._cards || []).find((item) => item.id === msg.id);
    if (card) game.applyCard(card);
  } else if (msg.t === "reroll") {
    game.rerollOffer(Number(msg.used) || 0);
  } else if (msg.t === "continue") game.continueLevel();
  else if (msg.t === "endless") game.beginEndless();
  else if (msg.t === "exit") game.exitAfterLevel();
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Access-Control-Allow-Origin": "*" });
  res.end("ok");
});

server.on("upgrade", (req, socket) => {
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }
  socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`,
  );
  const player = { socket, room: null, seat: 0 };
  readFrames(socket, (text) => {
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (msg.t === "host") {
      const room = openRoom(msg.level);
      player.room = room;
      player.seat = 0;
      room.players.push(player);
      sendText(socket, JSON.stringify({ t: "room", code: room.id, seat: 0 }));
      return;
    }
    if (msg.t === "join") {
      const room = rooms.get(String(msg.code || "").toUpperCase());
      if (!room || room.players.length >= 2) {
        sendText(socket, JSON.stringify({ t: "err", error: "Комната не найдена" }));
        return;
      }
      player.room = room;
      player.seat = 1;
      room.players.push(player);
      begin(room);
      sendText(socket, JSON.stringify({ t: "room", code: room.id, seat: 1 }));
      return;
    }
    if (!player.room) return;
    act(player.room, { ...msg, seat: player.seat });
  });
  socket.on("close", () => {
    const room = player.room;
    if (!room) return;
    room.players = room.players.filter((item) => item !== player);
    if (!room.players.length) rooms.delete(room.id);
  });
  socket.on("error", () => socket.destroy());
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.game || room.players.length < 2) continue;
    room.game.update(1 / 30);
    room.acc += 1;
    if (room.acc % 2) continue;
    const snap = JSON.stringify(coopSnapshot(room.game.run, room.game.state));
    for (const player of room.players) sendText(player.socket, snap);
  }
}, 1000 / 30);

const port = Number(process.env.PORT || 8090);
server.listen(port, "0.0.0.0");
