import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  text: {
    type: String,
  },
  imageUrl: {
    type: String,
    default: "",
  },
  expenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Expense",
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// At least `text` must be present (non-empty string) unless expenseId is present
messageSchema.pre("validate", function () {
  if (!this.expenseId && (!this.text || this.text.trim().length === 0)) {
    throw new Error("Message must have non-empty text");
  }
});

const Message = mongoose.model("Message", messageSchema);
export default Message;
