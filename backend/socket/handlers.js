import Message from "../models/message.model.js";

export function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    // Join a group room
    socket.on("join-group", (groupId) => {
      socket.join(groupId);
      socket.emit("joined", groupId);
    });

    // Send a message to the group
    socket.on("send-message", async ({ groupId, message }) => {
      try {
        const newMessage = new Message({
          groupId,
          sender: message.senderId,
          text: message.text,
        });

        const saved = await newMessage.save();
        const populated = await saved.populate("sender", "username avatar");

        io.to(groupId).emit("new-message", populated);
      } catch (err) {
        console.error("send-message error:", err.message);
      }
    });

    // Relay item assignment to all clients in the room
    socket.on("assign-item", ({ groupId, itemId, userId }) => {
      io.to(groupId).emit("item-assigned", { groupId, itemId, userId });
    });

    // Relay item claim/unclaim to all OTHER clients in the room
    socket.on("item-claimed", ({ groupId, expenseId }) => {
      socket.to(groupId).emit("item-claimed", { expenseId });
    });
  });
}
