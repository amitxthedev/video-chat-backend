// src/socket/textChat.js

module.exports = function textChatHandler(io, socket, activeRooms) {
  // Helper: find partner
  function getPartner() {
    const roomId = activeRooms.get(socket.id);
    if (!roomId) return null;

    for (const [id, r] of activeRooms.entries()) {
      if (r === roomId && id !== socket.id) return id;
    }
    return null;
  }

  /* ================= SEND MESSAGE ================= */
  socket.on("send-message", (text) => {
    if (!text || !text.trim()) return;

    const partner = getPartner();
    if (!partner) return;

    io.to(partner).emit("receive-message", {
      from: "partner",
      text,
      time: Date.now(),
    });
  });

  /* ================= TYPING ================= */
  socket.on("typing", () => {
    const partner = getPartner();
    if (partner) {
      io.to(partner).emit("partner-typing");
    }
  });
};
