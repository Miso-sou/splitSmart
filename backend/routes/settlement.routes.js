import express from "express";
import { protect, requireRegistered } from "../middleware/auth.middleware.js";
import {
  createSettlement,
  getSettlementsByGroup,
} from "../controllers/settlement.controller.js";

const router = express.Router();

router.use(protect);
router.use(requireRegistered);

router.post("/", createSettlement);
router.get("/", getSettlementsByGroup);

export default router;
