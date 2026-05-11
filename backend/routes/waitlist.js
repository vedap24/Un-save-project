/**
 * waitlist.js — Waitlist API route
 *
 * What this does (plain English):
 * POST /api/waitlist
 *   - Receives form data (email, name, what they save, where they came from)
 *   - Validates the email is real-looking
 *   - Saves to database
 *   - Returns a success or error message in JSON format
 *
 * GET /api/waitlist/count
 *   - Returns how many people have joined the waitlist
 *   - Safe to make public (no personal data returned)
 */

const express = require("express");
const router = express.Router();
const { addToWaitlist, getWaitlistCount } = require("../db");

// Simple email check — not perfect, but catches obvious mistakes
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
}

// POST /api/waitlist — add someone to the waitlist
router.post("/", async (req, res) => {
  const { email, name, saves_most, source } = req.body;

  // 1. Check email was provided
  if (!email || typeof email !== "string") {
    return res.status(400).json({
      ok: false,
      message: "Email is required.",
    });
  }

  // 2. Check email looks valid
  if (!isValidEmail(email)) {
    return res.status(400).json({
      ok: false,
      message: "Please enter a valid email address.",
    });
  }

  // 3. Check email isn't too long (prevents abuse)
  if (email.length > 254) {
    return res.status(400).json({
      ok: false,
      message: "That email address is too long.",
    });
  }

  // 4. Save to database
  try {
    const result = await addToWaitlist({
      email,
      name: name || null,
      savesMost: saves_most || null,
      source: source || "direct",
    });

    if (result.duplicate) {
      // Already on the list — be friendly, not harsh
      return res.status(200).json({
        ok: true,
        duplicate: true,
        message: "You're already on the list! We'll be in touch soon. 🎉",
      });
    }

    return res.status(201).json({
      ok: true,
      message: "You're on the list! We'll reach out when Un{save} is ready.",
    });
  } catch (err) {
    console.error("Waitlist save error:", err);
    return res.status(500).json({
      ok: false,
      message: "Something went wrong on our end. Please try again.",
    });
  }
});

// GET /api/waitlist/count — how many people have signed up
router.get("/count", async (req, res) => {
  try {
    const count = await getWaitlistCount();
    return res.json({ ok: true, count });
  } catch (err) {
    console.error("Waitlist count error:", err);
    return res.status(500).json({ ok: false, count: 0 });
  }
});

module.exports = router;
