const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const socketHandler = require("./socket/socketHandler");
const { PORT } = require("./config/config");

const app = express();
app.use(cors());

// basic route (health check)
app.get("/", (req, res) => {
  res.send("Video Chat Backend Running");
});

// create HTTP server
const server = http.createServer(app);

// attach socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// load socket logic
socketHandler(io);

// start server
server.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
