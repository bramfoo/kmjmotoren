// ── Create or update the single admin account ───────────────────────
// Usage:  node set-admin.js <email> <password>
const bcrypt = require("bcryptjs");
const { db } = require("./db");

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Usage: node set-admin.js <email> <password>");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
const existing = db.prepare("SELECT id FROM admin LIMIT 1").get();
if (existing) {
  db.prepare("UPDATE admin SET email = ?, password_hash = ? WHERE id = ?").run(email, hash, existing.id);
} else {
  db.prepare("INSERT INTO admin (email, password_hash) VALUES (?, ?)").run(email, hash);
}
console.log("Admin account set for:", email);
