const express = require("express");
const http = require("http");
const cors = require("cors");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5050;

app.use(cors());

app.get("/", (req, res) => {
  res.send("Server is running");
});

// Identity registry: stable userId (from the caller list) <-> current socket.
// Calls are routed by userId so a person keeps the same address across
// refreshes/reconnects, even though their socket.id changes each time.
const userToSocket = {}; // userId   -> socket.id
const socketToUser = {}; // socket.id -> userId

const onlineUserIds = () => Object.keys(userToSocket);

io.on("connection", (socket) => {
  // A client announces which caller it is (from its personal URL).
  socket.on("register", (userId) => {
    if (!userId) return;
    userToSocket[userId] = socket.id;
    socketToUser[socket.id] = userId;
    io.emit("presence", onlineUserIds());
  });

  socket.on(
    "initiateCall",
    ({ targetUserId, signalData, senderId, senderName }) => {
      const targetSocket = userToSocket[targetUserId];
      if (!targetSocket) {
        socket.emit("callError", {
          message: `${targetUserId} is not online right now.`,
        });
        return;
      }
      io.to(targetSocket).emit("incomingCall", {
        signal: signalData,
        from: senderId,
        name: senderName,
      });
    }
  );

  socket.on("changeMediaStatus", ({ targetUserId, mediaType, isActive }) => {
    const targetSocket = userToSocket[targetUserId];
    if (targetSocket) {
      io.to(targetSocket).emit("mediaStatusChanged", { mediaType, isActive });
    }
  });

  socket.on("sendMessage", ({ targetUserId, message, senderName }) => {
    const targetSocket = userToSocket[targetUserId];
    if (targetSocket) {
      io.to(targetSocket).emit("receiveMessage", { message, senderName });
    }
  });

  socket.on("answerCall", (data) => {
    const targetSocket = userToSocket[data.to];
    if (!targetSocket) return;
    io.to(targetSocket).emit("mediaStatusChanged", {
      mediaType: data.mediaType,
      isActive: data.mediaStatus,
    });
    io.to(targetSocket).emit("callAnswered", data);
  });

  socket.on("terminateCall", ({ targetUserId }) => {
    const targetSocket = userToSocket[targetUserId];
    if (targetSocket) {
      io.to(targetSocket).emit("callTerminated");
    }
  });

  socket.on("disconnect", () => {
    const userId = socketToUser[socket.id];
    delete socketToUser[socket.id];
    if (userId && userToSocket[userId] === socket.id) {
      delete userToSocket[userId];
    }
    io.emit("presence", onlineUserIds());
  });
});

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
