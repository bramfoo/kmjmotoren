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

  CREATE TABLE IF NOT EXISTS requests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    naam        TEXT NOT NULL,
    email       TEXT NOT NULL,
    telefoon    TEXT,
    voertuig    TEXT,
    services    TEXT,
    bericht     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'Nieuw',
    notes       TEXT
  );

  CREATE TABLE IF NOT EXISTS pageviews (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    path        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    product_id   INTEGER,
    product_name TEXT,
    voornaam     TEXT NOT NULL,
    achternaam   TEXT NOT NULL,
    adres        TEXT NOT NULL,
    email        TEXT NOT NULL,
    telefoon     TEXT NOT NULL
  );
`);

// Migration: products gained an `images` column (JSON array of photo URLs).
const productCols = db.prepare("PRAGMA table_info(products)").all().map((c) => c.name);
if (!productCols.includes("images")) {
  db.exec("ALTER TABLE products ADD COLUMN images TEXT");
}
if (!productCols.includes("reserved")) {
  db.exec("ALTER TABLE products ADD COLUMN reserved INTEGER NOT NULL DEFAULT 0");
}

// Migration: requests gained a `deleted` flag (soft-delete / trash bin).
const requestCols = db.prepare("PRAGMA table_info(requests)").all().map((c) => c.name);
if (!requestCols.includes("deleted")) {
  db.exec("ALTER TABLE requests ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0");
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
