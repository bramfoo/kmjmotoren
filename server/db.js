// ── KMJ Motoren – database (SQLite via better-sqlite3) ──────────────
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const db = new Database(path.join(__dirname, "data.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    name        TEXT NOT NULL,
    price       TEXT,
    description TEXT,
    image_url   TEXT
  );

  CREATE TABLE IF NOT EXISTS gallery (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    kind        TEXT NOT NULL,        -- 'image' | 'video' | 'embed'
    url         TEXT NOT NULL,
    caption     TEXT,
    platform    TEXT                  -- 'youtube' | 'tiktok' | 'instagram' | null
  );

  CREATE TABLE IF NOT EXISTS admin (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Migration: products gained an `images` column (JSON array of photo URLs).
const productCols = db.prepare("PRAGMA table_info(products)").all().map((c) => c.name);
if (!productCols.includes("images")) {
  db.exec("ALTER TABLE products ADD COLUMN images TEXT");
}

// Persistent session secret (env overrides; otherwise generated + stored once).
function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const row = db.prepare("SELECT value FROM settings WHERE key = 'session_secret'").get();
  if (row) return row.value;
  const secret = crypto.randomBytes(48).toString("hex");
  db.prepare("INSERT INTO settings (key, value) VALUES ('session_secret', ?)").run(secret);
  return secret;
}

module.exports = { db, getSessionSecret };
