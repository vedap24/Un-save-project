/**
 * links.js — Save a link card + reminder
 *
 * What this does (plain English):
 * POST /api/links
 *   - Receives a card (url, title, description, domain, typeGuess, emoji)
 *     and a reminder choice (today / tomorrow / weekend / later / custom)
 *   - Saves the card to saved_links table
 *   - Saves the reminder to reminders table
 *   - Returns the saved card + reminder ID
 *
 * Logged events:
 *   LINK_SAVE_SUCCESS — card + reminder saved
 *   LINK_SAVE_ERROR   — something went wrong
 */

const express = require("express");
const router = express.Router();
const { saveLink, saveReminder } = require("../db");
const { log, logError } = require("../logger");

// Calculate a real datetime from a timing label
function resolveReminderAt(timingLabel, customDateTime) {
  const now = new Date();
  switch (timingLabel) {
    case "today":
      // End of today, 9pm
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0).toISOString();
    case "tomorrow":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0).toISOString();
    case "weekend": {
      // Find the next Saturday
      const daysUntilSat = (6 - now.getDay() + 7) % 7 || 7;
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSat, 10, 0, 0).toISOString();
    }
    case "later":
      return null; // no specific time — just "someday"
    case "custom":
      return customDateTime || null;
    default:
      return null;
  }
}

router.post("/", async (req, res) => {
  const { url, title, description, domain, typeGuess, emoji, timing, customDateTime } = req.body;

  // Basic validation
  if (!url || typeof url !== "string") {
    return res.status(400).json({ ok: false, message: "URL is required." });
  }
  if (!timing) {
    return res.status(400).json({ ok: false, message: "Please choose when you want to act on this." });
  }

  try {
    // 1. Save the link card
    const linkResult = await saveLink({ url, title, description, domain, typeGuess, emoji });

    // 2. Save the reminder
    const reminderAt = resolveReminderAt(timing, customDateTime);
    const reminderResult = await saveReminder({
      linkId: linkResult.id,
      timingLabel: timing,
      reminderAt,
    });

    log("LINK_SAVE_SUCCESS", "Link + reminder saved", { domain, timing });

    return res.status(201).json({
      ok: true,
      linkId: linkResult.id,
      reminderId: reminderResult.id,
      timing,
      reminderAt,
      message: "Saved! We'll remind you when it's time.",
    });

  } catch (err) {
    logError("LINK_SAVE_ERROR", "Failed to save link or reminder", err);
    return res.status(500).json({
      ok: false,
      message: "Something went wrong saving your link. Please try again.",
    });
  }
});

module.exports = router;
