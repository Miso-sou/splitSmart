import mongoose from "mongoose";

const settlementSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // who paid
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // who received
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    note: {
      type: String,
      default: "",
    },
    settledAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Settlement = mongoose.model("Settlement", settlementSchema);
export default Settlement;
