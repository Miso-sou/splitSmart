import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  createSettlement,
  getSettlementsByGroup,
} from "../controllers/settlement.controller.js";

const router = express.Router();

router.use(protect);

router.post("/", createSettlement);
router.get("/", getSettlementsByGroup);

export default router;
