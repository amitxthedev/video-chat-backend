const textChatHandler = require("./socket/textChat");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

/* ================== STATE ================== */
// SEPARATE QUEUES FOR VIDEO AND TEXT CHAT (CRITICAL FOR ISOLATION)
const videoWaitingQueue = [];  // Only video chat users
const textWaitingQueue = [];   // Only text chat users
const activeRooms = new Map(); // socketId -> roomId
const rooms = new Map();       // roomId -> [socketId, socketId]
const lastPartner = new Map();
const userInfo = new Map();    // socketId -> location
const socketChatType = new Map(); // socketId -> "video" | "text"

let onlineUsers = 0;

/* ================== HELPERS ================== */
function removeFromQueue(id) {
  const chatType = socketChatType.get(id);
  const queue = chatType === "text" ? textWaitingQueue : videoWaitingQueue;
  const i = queue.indexOf(id);
  if (i !== -1) queue.splice(i, 1);
}

function getPartner(socketId) {
  const roomId = activeRooms.get(socketId);
  if (!roomId) return null;
  const users = rooms.get(roomId) || [];
  return users.find((u) => u !== socketId) || null;
}

/* ================== MATCH ================== */
function tryMatch(chatType = "video") {
  const queue = chatType === "text" ? textWaitingQueue : videoWaitingQueue;
  
  if (queue.length < 2) return;

  const user1 = queue.shift();

  let index = queue.findIndex(
    (u) => lastPartner.get(u) !== user1
  );
  if (index === -1) index = 0;

  const user2 = queue.splice(index, 1)[0];
  const roomId = `room_${chatType}_${Date.now()}_${Math.random()}`;

  activeRooms.set(user1, roomId);
  activeRooms.set(user2, roomId);
  rooms.set(roomId, [user1, user2]);

  lastPartner.set(user1, user2);
  lastPartner.set(user2, user1);

  io.to(user1).emit("partner-found", {
    initiator: true,
    partner: userInfo.get(user2),
  });

  io.to(user2).emit("partner-found", {
    initiator: false,
    partner: userInfo.get(user1),
  });

  console.log(`✅ Matched [${chatType}]:`, user1, "<->", user2);
}

/* ================== SOCKET ================== */
io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  /* ===== ONLINE COUNT ===== */
  onlineUsers++;
  io.emit("online-count", onlineUsers);

  /* ===== STORE LOCATION AND CHAT TYPE ===== */
  socket.on("join", ({ country, state, chatType }) => {
    // Store location info
    userInfo.set(socket.id, {
      country: country || "Unknown",
      state: state || "Unknown",
    });
    // CRITICAL: Store chat type (default to "video" if not provided)
    const type = chatType === "text" ? "text" : "video";
    socketChatType.set(socket.id, type);
    
    console.log(`📍 ${socket.id} joined [${type}] from ${country}, ${state}`);
  });

  /* ===== TEXT CHAT ===== */
  textChatHandler(io, socket, activeRooms, rooms);

  /* ===== FIND PARTNER (VIDEO OR TEXT) ===== */
  socket.on("find-partner", () => {
    // Get the chat type for this socket
    const chatType = socketChatType.get(socket.id) || "video";
    const queue = chatType === "text" ? textWaitingQueue : videoWaitingQueue;
    
    removeFromQueue(socket.id);

    if (!activeRooms.has(socket.id)) {
      queue.push(socket.id);
      socket.emit("waiting");
      console.log(`⏳ ${socket.id} waiting [${chatType}]`);
      tryMatch(chatType);
    }
  });

  /* ===== WEBRTC SIGNALING ===== */
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
    const chatType = socketChatType.get(socket.id) || "video";
    const roomId = activeRooms.get(socket.id);
    if (!roomId) return;

    const partner = getPartner(socket.id);

    activeRooms.delete(socket.id);
    removeFromQueue(socket.id);

    if (partner) {
      activeRooms.delete(partner);
      io.to(partner).emit("partner-left");
      const partnerQueue = chatType === "text" ? textWaitingQueue : videoWaitingQueue;
      partnerQueue.push(partner);
    }

    rooms.delete(roomId);

    const queue = chatType === "text" ? textWaitingQueue : videoWaitingQueue;
    queue.push(socket.id);
    socket.emit("waiting");
    console.log(`⏳ ${socket.id} waiting again [${chatType}]`);
    tryMatch(chatType);
  });

  /* ===== DISCONNECT ===== */
  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);

    const chatType = socketChatType.get(socket.id) || "video";
    onlineUsers--;
    io.emit("online-count", onlineUsers);

    removeFromQueue(socket.id);

    const roomId = activeRooms.get(socket.id);
    const partner = getPartner(socket.id);

    activeRooms.delete(socket.id);
    userInfo.delete(socket.id);
    socketChatType.delete(socket.id);
    lastPartner.delete(socket.id);

    if (partner) {
      activeRooms.delete(partner);
      io.to(partner).emit("partner-left");
      const queue = chatType === "text" ? textWaitingQueue : videoWaitingQueue;
      queue.push(partner);
      tryMatch(chatType);
    }

    if (roomId) rooms.delete(roomId);
  });
});

/* ================== START ================== */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
