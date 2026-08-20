import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes.js"
import userRoutes from "./routes/user.routes.js"
import cookieParser from "cookie-parser";
import errorHandler from "./middleware/error.middleware.js";
import groupRoutes from "./routes/group.routes.js"
import expenseRoutes from "./routes/expense.routes.js"
import billRoutes from "./routes/bill.routes.js"
import settlementRoutes from "./routes/settlement.routes.js"
import { registerSocketHandlers } from "./socket/handlers.js";
import messageRoutes from "./routes/message.routes.js"

dotenv.config();
connectDB();

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, '') : null,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like health checks, curl, mobile apps)
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (
      allowedOrigins.some(
        (allowed) => allowed === origin || allowed === normalizedOrigin
      ) ||
      normalizedOrigin.includes('localhost')
    ) {
      return callback(null, true);
    }
    return callback(null, true); // Fallback to allow or pass origin
  },
  credentials: true,
};

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions,
});

app.set("io", io);
registerSocketHandlers(io);

app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser())
app.use(morgan("dev"));

app.use("/api/auth", authRoutes)
app.use("/api/user", userRoutes)
app.use("/api/group", groupRoutes)
app.use("/api/expense", expenseRoutes)
app.use("/api/bills", billRoutes)
app.use("/api/settlements", settlementRoutes)
app.use("/api/group", messageRoutes)


app.get("/", (req, res) => {
  res.send("API running");
});

app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Central error handler — must be after all routes
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});