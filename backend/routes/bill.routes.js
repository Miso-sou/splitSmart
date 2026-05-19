import express from "express";
import multer from "multer";
import { parseBill } from "../controllers/bill.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import rateLimit from "express-rate-limit"

const router = express.Router()

// Configure multerto store files as a buffer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 15 * 1024 * 1024, 
    }
})

// Create the rate limiter: 8 requests per 20 minutes per user
const billUploadLimiter = rateLimit({
  windowMs: 20 * 60 * 1000, // 20 minutes in milliseconds
  max: 8, // Limit each user to 8 requests per windowMs
  keyGenerator: (req) => {
    // req.user is set by the 'protect' middleware
    // We use the user's MongoDB ID as the unique key
    return req.user._id.toString();
  },
  message: { 
    error: "Too many bills uploaded. Please try again after 20 minutes." 
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// POST /api/bills/parse
// - protect: only authenticated users can upload bills
// - upload.single('billImage'): expects form-data with a file field named 'billImage'
router.post("/parse", protect, upload.single("billImage"), parseBill);

export default router