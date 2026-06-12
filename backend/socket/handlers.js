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
          replyTo: message.replyTo || null,
        });

        const saved = await newMessage.save();
        const populated = await Message.findById(saved._id)
          .populate("sender", "username avatar")
          .populate({
            path: "replyTo",
            populate: { path: "sender", select: "username" }
          })
          .lean();

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
