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
