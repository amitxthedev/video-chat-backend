const {
  addToQueue,
  removeFromQueue,
  matchUser,
} = require("../services/matchService");

module.exports = function socketHandler(io) {
  io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    /* ================= USER JOIN ================= */

    socket.on("join", ({ country, state }) => {
      socket.country = country || "Unknown";
      socket.state = state || "Unknown";

      console.log(
        `📍 ${socket.id} joined from ${socket.country}, ${socket.state}`
      );
    });

    /* ================= FIND PARTNER ================= */

    socket.on("find-partner", () => {
      console.log("🔍 Find partner:", socket.id);

      const partner = matchUser(socket);

      if (partner) {
        socket.partner = partner;
        partner.partner = socket;

        socket.emit("partner-found", {
          initiator: true,
          partner: {
            country: partner.country,
            state: partner.state,
          },
        });

        partner.emit("partner-found", {
          initiator: false,
          partner: {
            country: socket.country,
            state: socket.state,
          },
        });

        console.log(`🤝 Matched ${socket.id} with ${partner.id}`);
      } else {
        addToQueue(socket);
        socket.emit("waiting");
        console.log("⏳ Waiting:", socket.id);
      }
    });

    /* ================= WEBRTC SIGNALING ================= */

    socket.on("offer", (data) => {
      socket.partner?.emit("offer", data);
    });

    socket.on("answer", (data) => {
      socket.partner?.emit("answer", data);
    });

    socket.on("ice-candidate", (data) => {
      socket.partner?.emit("ice-candidate", data);
    });

    /* ================= SKIP / NEXT ================= */

    socket.on("skip", () => {
      console.log("⏭ Skip requested:", socket.id);

      if (socket.partner) {
        socket.partner.emit("partner-left");
        socket.partner.partner = null;
      }

      socket.partner = null;
      removeFromQueue(socket);
      addToQueue(socket);
      socket.emit("waiting");
    });

    /* ================= DISCONNECT ================= */

    socket.on("disconnect", () => {
      console.log("🔴 Disconnected:", socket.id);

      removeFromQueue(socket);

      if (socket.partner) {
        socket.partner.emit("partner-left");
        socket.partner.partner = null;
      }
    });
  });
};
