import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes.js"
import cookieParser from "cookie-parser";
import errorHandler from "./middleware/error.middleware.js";
import groupRoutes from "./routes/group.routes.js"
import expenseRoutes from "./routes/expense.routes.js"
import billRoutes from "./routes/bill.routes.js"

dotenv.config();
connectDB();

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser())
app.use(morgan("dev"));

app.use("/api/auth", authRoutes)
app.use("/api/group", groupRoutes)
app.use("/api/expense", expenseRoutes)
app.use("/api/bills", billRoutes)


app.get("/", (req, res) => {
  res.send("API running");
});

// Central error handler — must be after all routes
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});