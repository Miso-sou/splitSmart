import express from "express";
import { registerUser, loginUser, logoutUser, getMe, refreshToken, guestLogin, upgradeGuest } from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", registerUser)
router.post("/login", loginUser)
router.post("/guest", guestLogin)

router.post("/logout", protect, logoutUser)
router.get("/me", protect, getMe)
router.post("/upgrade", protect, upgradeGuest)
router.post('/refresh', refreshToken)

export default router;