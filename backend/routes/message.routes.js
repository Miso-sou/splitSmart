import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import Message from "../models/message.model.js";

const router = express.Router();

// GET /api/group/:id/messages
router.get("/:id/messages", protect, async (req, res) => {
  try {
    const messages = await Message.find({ groupId: req.params.id })
      .populate("sender", "username avatar")
      .sort({ createdAt: 1 }); // oldest first
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// POST /api/group/:id/messages
router.post("/:id/messages", protect, async (req, res) => {
  try {
    const { text, expenseId, imageUrl } = req.body;
    
    // We get sender from req.user
    const sender = req.user._id;
    const groupId = req.params.id;

    const newMessage = await Message.create({
      groupId,
      sender,
      text: text || "",
      expenseId: expenseId || null,
      imageUrl: imageUrl || ""
    });

    const populatedMsg = await Message.findById(newMessage._id).populate("sender", "username avatar");

    res.status(201).json(populatedMsg);
  } catch (err) {
    res.status(400).json({ message: err.message || "Failed to create message" });
  }
});

export default router;
