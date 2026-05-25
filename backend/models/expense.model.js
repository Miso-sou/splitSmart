import mongoose, { Schema } from "mongoose";

const expenseSchema = new Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      default: "",
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    splits: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        amount: { type: Number, required: true },
        settled: { type: Boolean, default: false },
      },
    ],
    approvalStatus: {
      type: String,
      enum: ["approved", "pending"],
      default: "approved",
    },
    billImageUrl: { type: String, default: "" }, // Cloudinary URL — only present if created via bill upload
    items: [
      {
        // Line items — from AI parsing OR manual entry
        name: { type: String, required: true },
        price: { type: Number, required: true }, // price per unit
        quantity: { type: Number, default: 1, min: 1 }, // e.g., 4 naans — defaults to 1
        claims: [
          {
            user: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            quantity: { type: Number, required: true, min: 1 },
          },
        ],
      },
    ],
    category: {
      type: String,
      enum: [
        "food",
        "travel",
        "accommodation",
        "entertainment",
        "utilities",
        "other",
      ],
      default: "other",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

const Expense = mongoose.model("Expense", expenseSchema);
export default Expense;
