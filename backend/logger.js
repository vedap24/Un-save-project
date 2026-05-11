/**
 * logger.js — Simple structured logger for Un{save}
 *
 * What this does (plain English):
 * - Prints log messages to the terminal with a timestamp and event name
 * - Makes it easy to understand what the server is doing at any moment
 * - In production (Vercel), these same logs appear in the Vercel dashboard
 *
 * Format: [2025-05-11T10:00:00Z] [EVENT_NAME] message {extra data}
 *
 * To check logs:
 *   - Locally: just watch the terminal where you ran `npm start`
 *   - Vercel: go to your project → Deployments → click a deployment → Logs tab
 */

function timestamp() {
  return new Date().toISOString();
}

/**
 * log(event, message, data)
 * event  — short all-caps name like "PREVIEW_SUCCESS" or "WAITLIST_SAVED"
 * message — human-readable description
 * data   — optional extra object (avoid putting user passwords or emails here)
 */
function log(event, message, data) {
  const line = {
    time: timestamp(),
    event,
    message,
    ...(data ? { data } : {}),
  };
  // Use JSON format so it's easy to search/filter in Vercel logs
  console.log(JSON.stringify(line));
}

/**
 * logError(event, message, err)
 * Same as log() but prints to stderr so Vercel flags it as an error
 */
function logError(event, message, err) {
  const line = {
    time: timestamp(),
    event,
    message,
    error: err ? (err.message || String(err)) : "unknown",
  };
  console.error(JSON.stringify(line));
}

module.exports = { log, logError };
