/**
 * server.js — The main server for Un{save}
 *
 * What this does (plain English):
 * - Starts a web server on port 3000 (or whatever PORT is set to in .env)
 * - Serves the frontend HTML/CSS/JS from the /frontend folder
 * - Provides three API groups:
 *     /api/waitlist      — email signups
 *     /api/preview-link  — fetch metadata for a pasted URL
 *     /api/links         — save a link card + reminder choice
 *
 * Logs events to the terminal (and Vercel logs in production).
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { log, logError } = require("./logger");

// Import routes
const waitlistRouter = require("./routes/waitlist");
const previewRouter  = require("./routes/preview");
const linksRouter    = require("./routes/links");

// Initialize the database (creates file + tables if needed)
require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Static Files ---
app.use(express.static(path.join(__dirname, "../frontend")));

// --- API Routes ---
app.use("/api/waitlist",      waitlistRouter);
app.use("/api/preview-link",  previewRouter);
app.use("/api/links",         linksRouter);

// --- Global error handler (catches any unhandled route errors) ---
app.use((err, req, res, _next) => {
  logError("UNHANDLED_ERROR", `Unhandled error on ${req.method} ${req.path}`, err);
  res.status(500).json({
    ok: false,
    message: "An unexpected error occurred. Please try again.",
  });
});

// --- Catch-all (serves index.html for any unknown path) ---
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// --- Start Server ---
app.listen(PORT, () => {
  log("SERVER_START", `Un{save} server running on port ${PORT}`);
  console.log(`
  ╔═══════════════════════════════════╗
  ║   Un{save} server is running      ║
  ║   http://localhost:${PORT}           ║
  ║   Press Ctrl+C to stop            ║
  ╚═══════════════════════════════════╝
  `);
});
