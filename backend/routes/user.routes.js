import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { updateProfile, changePassword } from "../controllers/user.controller.js";

const router = express.Router();

// All routes here require authentication
router.use(protect);

router.put("/profile", updateProfile);
router.put("/reset-password", changePassword);

export default router;
