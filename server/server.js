// ── KMJ Motoren – API server (Express + better-sqlite3) ─────────────
// Serves the static site, a JSON API under /api, and uploaded media
// under /uploads. In production nginx serves the static + /uploads
// files directly and reverse-proxies /api here; running everything on
// one port keeps local dev simple and same-origin (so cookies work).

const path = require("path");
const fs = require("fs");
const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { db, getSessionSecret } = require("./db");

const PORT = process.env.PORT || 3000;
const STATIC_DIR = path.resolve(__dirname, "..");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const SECRET = getSessionSecret();
const PROD = process.env.NODE_ENV === "production";
const COOKIE = "kmj_session";

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
app.use(express.json());
app.use(cookieParser());

// ── File uploads ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150 MB (short videos)
  fileFilter: (_req, file, cb) => {
    if (/^image\/|^video\//.test(file.mimetype)) cb(null, true);
    else cb(new Error("Alleen afbeeldingen of video's zijn toegestaan."));
  },
});

// ── Helpers ─────────────────────────────────────────────────────────
function detectPlatform(url) {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  return "other";
}

function removeLocalFile(url) {
  if (typeof url === "string" && url.startsWith("/uploads/")) {
    const f = path.join(UPLOADS_DIR, path.basename(url));
    fs.promises.unlink(f).catch(() => {}); // best-effort
  }
}

function signSession(admin) {
  return jwt.sign({ sub: admin.id, email: admin.email }, SECRET, { expiresIn: "7d" });
}

function currentAdmin(req) {
  const token = req.cookies[COOKIE];
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const admin = currentAdmin(req);
  if (!admin) return res.status(401).json({ error: "Niet ingelogd." });
  req.admin = admin;
  next();
}

// ── Auth routes ─────────────────────────────────────────────────────
app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  const row = db.prepare("SELECT * FROM admin LIMIT 1").get();
  if (!row || row.email !== email || !bcrypt.compareSync(password || "", row.password_hash)) {
    return res.status(401).json({ error: "Onjuiste inloggegevens." });
  }
  res.cookie(COOKIE, signSession(row), {
    httpOnly: true,
    sameSite: "lax",
    secure: PROD,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
  res.json({ admin: true, email: row.email });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const admin = currentAdmin(req);
  res.json({ admin: !!admin, email: admin ? admin.email : null });
});

// ── Products ────────────────────────────────────────────────────────
// Parse the stored images JSON into an array (falling back to image_url).
function withImages(row) {
  if (!row) return row;
  let imgs = [];
  if (row.images) { try { imgs = JSON.parse(row.images); } catch { imgs = []; } }
  if (!imgs.length && row.image_url) imgs = [row.image_url];
  row.images = imgs;
  return row;
}

app.get("/api/products", (_req, res) => {
  const rows = db.prepare("SELECT * FROM products ORDER BY created_at DESC, id DESC").all();
  res.json(rows.map(withImages));
});

app.get("/api/products/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Niet gevonden." });
  res.json(withImages(row));
});

app.post("/api/products", requireAuth, upload.array("images", 12), (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Naam is verplicht." });
  const urls = (req.files || []).map((f) => `/uploads/${f.filename}`);
  const info = db
    .prepare("INSERT INTO products (name, price, description, image_url, images) VALUES (?, ?, ?, ?, ?)")
    .run(
      name,
      (req.body.price || "").trim() || null,
      (req.body.description || "").trim() || null,
      urls[0] || null,
      JSON.stringify(urls)
    );
  res.status(201).json(withImages(db.prepare("SELECT * FROM products WHERE id = ?").get(info.lastInsertRowid)));
});

app.delete("/api/products/:id", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Niet gevonden." });
  db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  withImages(row).images.forEach(removeLocalFile);
  res.json({ ok: true });
});

// Toggle reservation (e.g. release a reserved product back to available)
app.patch("/api/products/:id", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Niet gevonden." });
  if (req.body.reserved !== undefined) {
    db.prepare("UPDATE products SET reserved = ? WHERE id = ?").run(req.body.reserved ? 1 : 0, req.params.id);
  }
  if (req.body.sold !== undefined) {
    db.prepare("UPDATE products SET sold = ? WHERE id = ?").run(req.body.sold ? 1 : 0, req.params.id);
  }
  res.json(withImages(db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id)));
});

// ── Orders (purchases / reservations) ───────────────────────────────
app.post("/api/orders", (req, res) => {
  const b = req.body || {};
  const fields = {
    voornaam: (b.voornaam || "").trim(),
    achternaam: (b.achternaam || "").trim(),
    adres: (b.adres || "").trim(),
    email: (b.email || "").trim(),
    telefoon: (b.telefoon || "").trim(),
  };
  if (!fields.voornaam || !fields.achternaam || !fields.adres || !fields.email || !fields.telefoon) {
    return res.status(400).json({ error: "Vul alle velden in." });
  }
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(b.product_id);
  if (!product) return res.status(404).json({ error: "Product niet gevonden." });
  if (product.sold) return res.status(409).json({ error: "Dit product is al verkocht." });
  if (product.reserved) return res.status(409).json({ error: "Dit product is al gereserveerd." });

  const code = (b.discount_code || "").trim().toUpperCase() || null;
  const base = Number(product.price);
  const price = isNaN(base) ? null : base;
  let finalPrice = price;
  if (code && price != null) {
    const disc = db.prepare("SELECT * FROM discounts WHERE UPPER(code) = ?").get(code);
    if (disc) {
      finalPrice = disc.type === "amount"
        ? Math.max(0, price - disc.value)
        : Math.round(price * (1 - disc.value / 100) * 100) / 100;
    }
  }
  db.prepare(
    "INSERT INTO orders (product_id, product_name, voornaam, achternaam, adres, email, telefoon, discount_code, price, final_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(product.id, product.name, fields.voornaam, fields.achternaam, fields.adres, fields.email, fields.telefoon, code, price, finalPrice);
  db.prepare("UPDATE products SET reserved = 1 WHERE id = ?").run(product.id);
  res.status(201).json({ ok: true });
});

app.get("/api/orders", requireAuth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM orders WHERE deleted = 0 ORDER BY created_at DESC, id DESC").all());
});

app.get("/api/orders/trash", requireAuth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM orders WHERE deleted = 1 ORDER BY created_at DESC, id DESC").all());
});

// Accept an order → product marked sold, order archived to trash
app.post("/api/orders/:id/accept", requireAuth, (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Niet gevonden." });
  if (order.product_id) db.prepare("UPDATE products SET sold = 1, reserved = 0 WHERE id = ?").run(order.product_id);
  db.prepare("UPDATE orders SET deleted = 1 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Release reservation → product available again, order archived to trash
app.post("/api/orders/:id/release", requireAuth, (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Niet gevonden." });
  if (order.product_id) db.prepare("UPDATE products SET reserved = 0 WHERE id = ?").run(order.product_id);
  db.prepare("UPDATE orders SET deleted = 1 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.post("/api/orders/:id/restore", requireAuth, (req, res) => {
  db.prepare("UPDATE orders SET deleted = 0 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.delete("/api/orders/:id/permanent", requireAuth, (req, res) => {
  db.prepare("DELETE FROM orders WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.delete("/api/orders/:id", requireAuth, (req, res) => {
  db.prepare("UPDATE orders SET deleted = 1 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ── Gallery ─────────────────────────────────────────────────────────
app.get("/api/gallery", (_req, res) => {
  const rows = db.prepare("SELECT * FROM gallery ORDER BY created_at DESC, id DESC").all();
  res.json(rows);
});

app.post("/api/gallery", requireAuth, upload.single("file"), (req, res) => {
  const kind = req.body.kind;
  const caption = (req.body.caption || "").trim() || null;
  let url, platform = null;

  if (kind === "embed") {
    url = (req.body.url || "").trim();
    if (!url) return res.status(400).json({ error: "Geef een link op." });
    platform = detectPlatform(url);
  } else if (kind === "image" || kind === "video") {
    if (!req.file) return res.status(400).json({ error: "Geen bestand ontvangen." });
    url = `/uploads/${req.file.filename}`;
  } else {
    return res.status(400).json({ error: "Ongeldig type." });
  }

  const info = db
    .prepare("INSERT INTO gallery (kind, url, caption, platform) VALUES (?, ?, ?, ?)")
    .run(kind, url, caption, platform);
  res.status(201).json(db.prepare("SELECT * FROM gallery WHERE id = ?").get(info.lastInsertRowid));
});

app.delete("/api/gallery/:id", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM gallery WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Niet gevonden." });
  db.prepare("DELETE FROM gallery WHERE id = ?").run(req.params.id);
  removeLocalFile(row.url);
  res.json({ ok: true });
});

// ── Contact requests ────────────────────────────────────────────────
app.post("/api/requests", (req, res) => {
  const b = req.body || {};
  const naam = (b.naam || "").trim();
  const email = (b.email || "").trim();
  const telefoon = (b.telefoon || "").trim();
  const bericht = (b.bericht || "").trim();
  if (!naam || !email || !telefoon || !bericht) {
    return res.status(400).json({ error: "Naam, telefoon, e-mail en bericht zijn verplicht." });
  }
  const services = Array.isArray(b.services) ? b.services.join(", ") : (b.services || "");
  db.prepare(
    "INSERT INTO requests (naam, email, telefoon, voertuig, services, bericht, discount_code) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(naam, email, telefoon, (b.voertuig || "").trim() || null, services || null, bericht, (b.discount_code || "").trim().toUpperCase() || null);
  res.status(201).json({ ok: true });
});

app.get("/api/requests", requireAuth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM requests WHERE deleted = 0 ORDER BY created_at DESC, id DESC").all());
});

// Trash: soft-deleted requests
app.get("/api/requests/trash", requireAuth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM requests WHERE deleted = 1 ORDER BY created_at DESC, id DESC").all());
});

app.post("/api/requests/:id/restore", requireAuth, (req, res) => {
  db.prepare("UPDATE requests SET deleted = 0 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Permanently remove a request (only from the trash)
app.delete("/api/requests/:id/permanent", requireAuth, (req, res) => {
  db.prepare("DELETE FROM requests WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.patch("/api/requests/:id", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Niet gevonden." });
  const status = req.body.status !== undefined ? req.body.status : row.status;
  const notes = req.body.notes !== undefined ? req.body.notes : row.notes;
  db.prepare("UPDATE requests SET status = ?, notes = ? WHERE id = ?").run(status, notes, req.params.id);
  res.json(db.prepare("SELECT * FROM requests WHERE id = ?").get(req.params.id));
});

app.delete("/api/requests/:id", requireAuth, (req, res) => {
  db.prepare("UPDATE requests SET deleted = 1 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ── Discount codes ──────────────────────────────────────────────────
app.get("/api/discounts", requireAuth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM discounts ORDER BY created_at DESC, id DESC").all());
});

app.post("/api/discounts", requireAuth, (req, res) => {
  const code = (req.body.code || "").trim().toUpperCase();
  const type = req.body.type === "amount" ? "amount" : "percent";
  const value = Number(req.body.value);
  if (!code || !(value > 0)) return res.status(400).json({ error: "Code en een geldige waarde zijn verplicht." });
  if (db.prepare("SELECT id FROM discounts WHERE UPPER(code) = ?").get(code)) {
    return res.status(409).json({ error: "Deze code bestaat al." });
  }
  const info = db
    .prepare("INSERT INTO discounts (code, type, value, description) VALUES (?, ?, ?, ?)")
    .run(code, type, value, (req.body.description || "").trim() || null);
  res.status(201).json(db.prepare("SELECT * FROM discounts WHERE id = ?").get(info.lastInsertRowid));
});

app.delete("/api/discounts/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM discounts WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Public: check a code (used by the buy modal and the contact form)
app.post("/api/discounts/validate", (req, res) => {
  const code = (req.body.code || "").trim().toUpperCase();
  if (!code) return res.json({ valid: false });
  const row = db.prepare("SELECT * FROM discounts WHERE UPPER(code) = ?").get(code);
  if (!row) return res.json({ valid: false });
  res.json({ valid: true, code: row.code, type: row.type, value: row.value, description: row.description });
});

// ── Opening hours (editable setting) ────────────────────────────────
app.get("/api/openingstijden", (_req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'openingstijden'").get();
  res.json({ value: row ? row.value : "Geen vaste openingstijden" });
});

app.put("/api/openingstijden", requireAuth, (req, res) => {
  const value = (req.body.value || "").trim();
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('openingstijden', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(value);
  res.json({ value });
});

// ── Analytics ───────────────────────────────────────────────────────
app.post("/api/track", (req, res) => {
  const path = (req.body && req.body.path ? String(req.body.path) : "").slice(0, 300);
  if (path) db.prepare("INSERT INTO pageviews (path) VALUES (?)").run(path);
  res.json({ ok: true });
});

app.get("/api/stats", requireAuth, (_req, res) => {
  const totalViews = db.prepare("SELECT COUNT(*) c FROM pageviews").get().c;
  const views7 = db.prepare("SELECT COUNT(*) c FROM pageviews WHERE created_at >= datetime('now','-7 days')").get().c;
  const topPages = db
    .prepare("SELECT path, COUNT(*) c FROM pageviews GROUP BY path ORDER BY c DESC LIMIT 6")
    .all();

  // Views per day for the last 14 days (fill gaps with 0)
  const rows = db
    .prepare("SELECT date(created_at) day, COUNT(*) c FROM pageviews WHERE created_at >= datetime('now','-13 days') GROUP BY day")
    .all();
  const byDayMap = Object.fromEntries(rows.map((r) => [r.day, r.c]));
  const viewsByDay = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    viewsByDay.push({ day: d, count: byDayMap[d] || 0 });
  }

  const statusRows = db.prepare("SELECT status, COUNT(*) c FROM requests WHERE deleted = 0 GROUP BY status").all();
  const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, r.c]));

  res.json({
    totalViews,
    views7,
    viewsByDay,
    topPages,
    requests: {
      total: db.prepare("SELECT COUNT(*) c FROM requests WHERE deleted = 0").get().c,
      byStatus,
    },
    products: db.prepare("SELECT COUNT(*) c FROM products").get().c,
    gallery: db.prepare("SELECT COUNT(*) c FROM gallery").get().c,
    orders: db.prepare("SELECT COUNT(*) c FROM orders WHERE deleted = 0").get().c,
  });
});

// ── Static files ────────────────────────────────────────────────────
// Never expose server internals / VCS / editor dirs.
app.use((req, res, next) => {
  if (/^\/(server|\.git|\.claude)(\/|$)/.test(req.path)) return res.status(404).end();
  next();
});
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(STATIC_DIR));

// ── Multer / generic error handler ──────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Bestand is te groot (max 150 MB)." });
  }
  res.status(400).json({ error: err.message || "Er ging iets mis." });
});

app.listen(PORT, () => console.log(`KMJ server listening on http://localhost:${PORT}`));
