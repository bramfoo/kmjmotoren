// ── KMJ Motoren – shared frontend API client + admin login ──────────
// Talks to the self-hosted API (see server/). Loaded on producten.html
// and socials.html, after config.js.

(function () {
  const API = (window.KMJ_CONFIG && window.KMJ_CONFIG.API_BASE) || "";

  const KMJ = {
    api: API,
    isAdmin: false,
    _adminCallbacks: [],

    onAdminChange(fn) {
      this._adminCallbacks.push(fn);
      fn(this.isAdmin);
    },

    _setAdmin(state) {
      this.isAdmin = state;
      document.body.classList.toggle("is-admin", state);
      this._adminCallbacks.forEach((fn) => fn(state));
    },

    // GET JSON from the API.
    async get(path) {
      const res = await fetch(API + path, { credentials: "include" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    },

    // Send a write request. `body` is either a plain object (JSON) or a
    // FormData (multipart, for file uploads).
    async send(path, method, body) {
      const opts = { method, credentials: "include" };
      if (body instanceof FormData) {
        opts.body = body;
      } else if (body !== undefined) {
        opts.headers = { "Content-Type": "application/json" };
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(API + path, opts);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "HTTP " + res.status);
      return data;
    },
  };

  window.KMJ = KMJ;

  // ── Login modal + admin floating button ─────────────────────────────
  function buildAdminUI() {
    const fab = document.createElement("button");
    fab.className = "beheer-btn";
    fab.type = "button";
    fab.textContent = "Beheer";
    // Place it in the footer bar; fall back to body if a page has no footer.
    const footerInner = document.querySelector(".footer-inner");
    (footerInner || document.body).appendChild(fab);

    const modal = document.createElement("div");
    modal.className = "admin-modal";
    modal.innerHTML = `
      <div class="admin-modal-box">
        <button class="admin-modal-close" type="button" aria-label="Sluiten">&times;</button>
        <h3>Beheer – inloggen</h3>
        <form class="admin-login-form">
          <div class="form-group">
            <label for="admin-email">E-mail</label>
            <input type="email" id="admin-email" required autocomplete="username" />
          </div>
          <div class="form-group">
            <label for="admin-pass">Wachtwoord</label>
            <input type="password" id="admin-pass" required autocomplete="current-password" />
          </div>
          <button type="submit" class="btn btn-primary btn-full">Inloggen</button>
          <p class="admin-login-msg" aria-live="polite"></p>
        </form>
      </div>`;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector(".admin-modal-close");
    const form = modal.querySelector(".admin-login-form");
    const msg = modal.querySelector(".admin-login-msg");

    const openModal = () => modal.classList.add("open");
    const closeModal = () => { modal.classList.remove("open"); msg.textContent = ""; };

    closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

    fab.addEventListener("click", async () => {
      if (KMJ.isAdmin) {
        await KMJ.send("/api/logout", "POST");
        KMJ._setAdmin(false);
      } else {
        openModal();
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.textContent = "Bezig met inloggen…";
      msg.className = "admin-login-msg";
      try {
        await KMJ.send("/api/login", "POST", {
          email: form.querySelector("#admin-email").value.trim(),
          password: form.querySelector("#admin-pass").value,
        });
        KMJ._setAdmin(true);
        closeModal();
        form.reset();
      } catch (err) {
        msg.textContent = "Inloggen mislukt: " + err.message;
        msg.className = "admin-login-msg error";
      }
    });

    KMJ.onAdminChange((isAdmin) => {
      fab.textContent = isAdmin ? "Uitloggen" : "Beheer";
      fab.classList.toggle("active", isAdmin);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    buildAdminUI();
    // Restore session state from the server.
    KMJ.get("/api/me")
      .then((d) => KMJ._setAdmin(!!d.admin))
      .catch(() => {});
  });
})();
