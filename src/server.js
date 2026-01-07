const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

/* ================== MATCHMAKING STATE ================== */
const waitingQueue = [];
const activeRooms = new Map(); // socketId -> roomId
const rooms = new Map();       // roomId -> [socketId, socketId]
const lastPartner = new Map();

/* ================== HELPERS ================== */
function removeFromQueue(id) {
  const i = waitingQueue.indexOf(id);
  if (i !== -1) waitingQueue.splice(i, 1);
}

function getPartner(socketId) {
  const roomId = activeRooms.get(socketId);
  if (!roomId) return null;
  const users = rooms.get(roomId) || [];
  return users.find((u) => u !== socketId) || null;
}

/* ================== MATCH FUNCTION ================== */
function tryMatch() {
  if (waitingQueue.length < 2) return;

  const user1 = waitingQueue.shift();

  let index = waitingQueue.findIndex(
    (u) => lastPartner.get(u) !== user1
  );
  if (index === -1) index = 0;

  const user2 = waitingQueue.splice(index, 1)[0];
  const roomId = `room_${Date.now()}_${Math.random()}`;

  activeRooms.set(user1, roomId);
  activeRooms.set(user2, roomId);
  rooms.set(roomId, [user1, user2]);

  lastPartner.set(user1, user2);
  lastPartner.set(user2, user1);

  io.to(user1).emit("partner-found", { initiator: true });
  io.to(user2).emit("partner-found", { initiator: false });

  console.log("✅ Matched:", user1, "<->", user2);
}

/* ================== SOCKET EVENTS ================== */
io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  socket.on("find-partner", () => {
    removeFromQueue(socket.id);

    if (!activeRooms.has(socket.id)) {
      waitingQueue.push(socket.id);
      socket.emit("waiting");
      tryMatch();
    }
  });

  /* ===== WEBRTC SIGNALING (FIX) ===== */
  socket.on("offer", (offer) => {
    const partner = getPartner(socket.id);
    if (partner) io.to(partner).emit("offer", offer);
  });

  socket.on("answer", (answer) => {
    const partner = getPartner(socket.id);
    if (partner) io.to(partner).emit("answer", answer);
  });

  socket.on("ice-candidate", (candidate) => {
    const partner = getPartner(socket.id);
    if (partner) io.to(partner).emit("ice-candidate", candidate);
  });

  /* ===== SKIP ===== */
  socket.on("skip", () => {
    const roomId = activeRooms.get(socket.id);
    if (!roomId) return;

    const partner = getPartner(socket.id);

    activeRooms.delete(socket.id);
    removeFromQueue(socket.id);

    if (partner) {
      activeRooms.delete(partner);
      io.to(partner).emit("partner-left");
      waitingQueue.push(partner);
    }

    rooms.delete(roomId);

    waitingQueue.push(socket.id);
    socket.emit("waiting");
    tryMatch();
  });

  /* ===== DISCONNECT ===== */
  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);

    removeFromQueue(socket.id);
    const roomId = activeRooms.get(socket.id);
    const partner = getPartner(socket.id);

    activeRooms.delete(socket.id);
    lastPartner.delete(socket.id);

    if (partner) {
      activeRooms.delete(partner);
      io.to(partner).emit("partner-left");
      waitingQueue.push(partner);
      tryMatch();
    }

    if (roomId) rooms.delete(roomId);
  });
});

/* ================== START SERVER ================== */
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
