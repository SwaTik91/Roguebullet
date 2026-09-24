import crypto from "node:crypto";
import http from "node:http";

const rooms = new Map();
const FRAME = 1000 / 60;

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

function openRoom(msg) {
  const id = code();
  const room = {
    id,
    level: Math.min(3, Math.max(1, Number(msg.level) || 1)),
    worldW: Math.max(320, Number(msg.worldW) || 720),
    worldH: Math.max(480, Number(msg.worldH) || 1280),
    profile: msg.profile || {},
    players: [],
    seed: crypto.randomInt(1, 0x7fffffff),
  };
  rooms.set(id, room);
  return room;
}

function relay(room, player, msg) {
  const out = { ...msg, seat: player.seat };
  if (out.t !== "in") out.applyTick = Math.floor((Date.now() - room.t0) / FRAME) + 10;
  const text = JSON.stringify(out);
  for (const item of room.players) sendText(item.socket, text);
}

function begin(room) {
  room.t0 = Date.now();
  const now = room.t0;
  for (const player of room.players) {
    sendText(player.socket, JSON.stringify({
      t: "go",
      seed: room.seed,
      worldW: room.worldW,
      worldH: room.worldH,
      level: room.level,
      seat: player.seat,
      t0: room.t0,
      now,
      profile: room.profile,
    }));
  }
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
      const room = openRoom(msg);
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
    if (!player.room?.t0) return;
    relay(player.room, player, msg);
  });
  socket.on("close", () => {
    const room = player.room;
    if (!room) return;
    room.players = room.players.filter((item) => item !== player);
    if (!room.players.length) rooms.delete(room.id);
  });
  socket.on("error", () => socket.destroy());
});

const port = Number(process.env.PORT || 8090);
server.listen(port, "0.0.0.0");
