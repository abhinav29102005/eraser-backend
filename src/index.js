// src/index.js
const express = require("express");
const cors = require("cors");
const prisma = require("./services/prisma"); // Import the single Prisma instance\
const { Server } = require("socket.io");
const { createServer } = require("http");

const app = express();
const server = createServer(app);

//configure socket.io
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:5173', 'YOUR_PROD_FRONTEND_URL'],
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

app.use(
  cors({
    origin: ["http://localhost:5173", "YOUR_PROD_FRONTEND_URL"], // Crucial: ensure frontend URL is allowed
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// --- Import and Register Routes ---
const authRoutes = require("./routes/auth.routes"); // Public auth routes (NO AUTH MIDDLEWARE HERE)
const appRoutes = require("./routes"); // Your current routes.js, which now contains PROTECTED routes

// Register public auth routes FIRST
app.use("/api/auth", authRoutes); // e.g., /api/auth/test-token is now public

// Register all other protected app routes
app.use("/api", appRoutes); // e.g., /api/boards, /api/users/me are protected

// Root route (Health Check)
app.get("/", (req, res) => {
  res.send("Eraser v1 backend running");
});

const socketHandler = require('../websocket/src/socketHandler') ;
io.on('connection', (socket) => {
  console.log('User connected', socket.id);
  socketHandler(io,socket);
})

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err.stack);
  res.status(err.statusCode || 500).json({
    message: err.message || "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

// Conditional Server Start
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
  });
}

module.exports = app;
