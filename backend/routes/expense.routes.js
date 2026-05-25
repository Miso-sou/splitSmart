import express from "express";
import { protect, requireRegistered } from "../middleware/auth.middleware.js";
import {
  createExpense,
  getGroupExpenses,
  approveExpense,
  updateExpense,
  deleteExpense,
  getgroupBalances,
  getExpenseById,
  claimItem,
  unclaimItem,
} from "../controllers/expense.controller.js";

const router = express.Router();

router.use(protect);

router.post("/", createExpense);
router.get("/group/:groupId", getGroupExpenses);
router.get("/group/:groupId/balances", getgroupBalances);
router.put("/:id/approve", approveExpense);
router.put("/:id", updateExpense);
router.delete("/:id", deleteExpense);
router.get("/:id", getExpenseById);
router.post("/:id/items/:itemId/claim", claimItem);
router.delete("/:id/items/:itemId/claim", unclaimItem);

export default router;
