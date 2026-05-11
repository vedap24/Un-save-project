/**
 * db.js — Database setup for Un{save}
 *
 * What this does (plain English):
 * - Creates a SQLite database file at backend/data/unsave.db
 * - Creates three tables:
 *     1. waitlist  — email signups
 *     2. saved_links — links a user has pasted and saved as cards
 *     3. reminders   — when the user plans to act on a saved link
 * - Provides functions to read/write each table
 *
 * SQLite is like a single-file spreadsheet.
 * Open unsave.db with "DB Browser for SQLite" (free app) to see all data.
 */

require("dotenv").config();
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, "data", "unsave.db");

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Could not open database:", err.message);
    process.exit(1);
  }
  console.log(`✅ Database ready at: ${dbPath}`);
});

const { sql } = require("@vercel/postgres");

// --- Create all tables (SQLite) ---
db.serialize(() => {
  // 1. Waitlist (SQLite - kept for local fallback)
  db.run(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT    NOT NULL UNIQUE,
      name        TEXT,
      saves_most  TEXT,
      source      TEXT    DEFAULT 'direct',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 2. Saved links — each pasted URL becomes one row
  db.run(`
    CREATE TABLE IF NOT EXISTS saved_links (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      url         TEXT    NOT NULL,
      title       TEXT,
      description TEXT,
      domain      TEXT,
      type_guess  TEXT    DEFAULT 'link',
      emoji       TEXT    DEFAULT '🔗',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 3. Reminders — one per saved link, records when user plans to act
  db.run(`
    CREATE TABLE IF NOT EXISTS reminders (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id       INTEGER NOT NULL,
      timing_label  TEXT    NOT NULL,
      reminder_at   TEXT,
      status        TEXT    NOT NULL DEFAULT 'pending',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (link_id) REFERENCES saved_links(id)
    )
  `);
});

/* =============================================
   WAITLIST functions
   ============================================= */

/**
 * addToWaitlist
 * Production: Vercel Postgres (if POSTGRES_URL exists)
 * Development: Local SQLite
 */
async function addToWaitlist({ email, name, savesMost, source }) {
  const cleanEmail = email.toLowerCase().trim();
  const cleanName = name ? name.trim() : null;
  const cleanSaves = savesMost ? savesMost.trim() : null;
  const cleanSource = source || "direct";

  // --- 1. Production Flow (Vercel Postgres) ---
  if (process.env.POSTGRES_URL) {
    try {
      await sql`
        INSERT INTO waitlist (email, name, saves_most, source)
        VALUES (${cleanEmail}, ${cleanName}, ${cleanSaves}, ${cleanSource})
      `;
      return { success: true };
    } catch (err) {
      // Postgres error codes: 23505 is unique violation
      if (err.code === "23505" || (err.message && err.message.includes("unique constraint"))) {
        return { duplicate: true };
      }
      throw err;
    }
  }

  // --- 2. Local Flow (SQLite Fallback) ---
  return new Promise((resolve, reject) => {
    const query = `INSERT INTO waitlist (email, name, saves_most, source) VALUES (?, ?, ?, ?)`;
    db.run(query, [cleanEmail, cleanName, cleanSaves, cleanSource], function (err) {
      if (err) {
        if (err.message && err.message.includes("UNIQUE constraint failed")) {
          return resolve({ duplicate: true });
        }
        return reject(err);
      }
      resolve({ success: true });
    });
  });
}

/**
 * getWaitlistCount
 */
async function getWaitlistCount() {
  // --- 1. Production Flow (Vercel Postgres) ---
  if (process.env.POSTGRES_URL) {
    try {
      const { rows } = await sql`SELECT COUNT(*) as count FROM waitlist`;
      return rows[0] ? parseInt(rows[0].count) : 0;
    } catch (err) {
      console.error("Postgres count error:", err);
      throw err;
    }
  }

  // --- 2. Local Flow (SQLite Fallback) ---
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM waitlist", [], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.count : 0);
    });
  });
}

/* =============================================
   SAVED LINKS functions (new)
   ============================================= */

/**
 * saveLink — saves a pasted link as a card
 * Returns { id, success: true }
 */
function saveLink({ url, title, description, domain, typeGuess, emoji }) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO saved_links (url, title, description, domain, type_guess, emoji)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.run(sql, [url, title || null, description || null, domain || null, typeGuess || "link", emoji || "🔗"],
      function (err) {
        if (err) return reject(err);
        resolve({ success: true, id: this.lastID });
      }
    );
  });
}

/* =============================================
   REMINDERS functions (new)
   ============================================= */

/**
 * saveReminder — saves when user plans to act on a link
 * timingLabel: "today" | "tomorrow" | "weekend" | "later" | "custom"
 * reminderAt:  ISO date string or null
 */
function saveReminder({ linkId, timingLabel, reminderAt }) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO reminders (link_id, timing_label, reminder_at)
      VALUES (?, ?, ?)
    `;
    db.run(sql, [linkId, timingLabel, reminderAt || null], function (err) {
      if (err) return reject(err);
      resolve({ success: true, id: this.lastID });
    });
  });
}

module.exports = {
  addToWaitlist,
  getWaitlistCount,
  saveLink,
  saveReminder,
};
