// ── KMJ Motoren – beheer dashboard (admin only) ─────────────────────
(function () {
  const locked = document.getElementById("beheer-locked");
  const dash = document.getElementById("beheer-dash");
  const STATUSES = ["Nieuw", "In behandeling", "Afgerond"];
  let loaded = false;

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function statusSlug(s) {
    return s === "Afgerond" ? "afgerond" : s === "In behandeling" ? "bezig" : "nieuw";
  }

  function fmtDate(s) {
    const d = new Date(String(s).replace(" ", "T") + "Z");
    if (isNaN(d)) return s;
    return d.toLocaleString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // ── Statistics ──────────────────────────────────────────────────────
  async function loadStats() {
    const s = await KMJ.get("/api/stats");

    document.getElementById("stats-cards").innerHTML = [
      ["Paginaweergaven", s.totalViews],
      ["Weergaven (7 dgn)", s.views7],
      ["Aanvragen", s.requests.total],
      ["Producten", s.products],
      ["Galerij", s.gallery],
    ].map(([label, val]) =>
      `<div class="stat-card"><span class="stat-card-num">${val}</span><span class="stat-card-label">${label}</span></div>`
    ).join("");

    const max = Math.max(1, ...s.viewsByDay.map((d) => d.count));
    document.getElementById("views-chart").innerHTML = s.viewsByDay.map((d) => {
      const h = Math.round((d.count / max) * 100);
      return `<div class="bar-col" title="${d.day}: ${d.count}">
        <span class="bar-val">${d.count || ""}</span>
        <div class="bar" style="height:${h}%"></div>
        <span class="bar-day">${d.day.slice(8)}</span>
      </div>`;
    }).join("");

    document.getElementById("top-pages").innerHTML =
      s.topPages.map((p) => `<li><span>${escapeHtml(p.path)}</span><strong>${p.c}</strong></li>`).join("")
      || "<li>Nog geen data.</li>";
  }

  // ── Requests ────────────────────────────────────────────────────────
  function requestCard(r) {
    return `
      <div class="request-card status-${statusSlug(r.status)}" data-id="${r.id}">
        <div class="request-head">
          <div class="request-who">
            <strong>${escapeHtml(r.naam)}</strong>
            <span class="request-date">${fmtDate(r.created_at)}</span>
          </div>
          <select class="request-status">
            ${STATUSES.map((s) => `<option${s === r.status ? " selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
        <p class="request-contact">
          <a href="mailto:${escapeHtml(r.email)}">${escapeHtml(r.email)}</a>
          ${r.telefoon ? ` &middot; <a href="tel:${escapeHtml(r.telefoon)}">${escapeHtml(r.telefoon)}</a>` : ""}
        </p>
        ${r.voertuig ? `<p class="request-line"><strong>Voertuig:</strong> ${escapeHtml(r.voertuig)}</p>` : ""}
        ${r.services ? `<p class="request-line"><strong>Service(s):</strong> ${escapeHtml(r.services)}</p>` : ""}
        <p class="request-msg">${escapeHtml(r.bericht)}</p>
        <div class="request-notes">
          <label>Notities (intern)</label>
          <textarea class="notes-input" rows="2" placeholder="Voeg een notitie toe…">${escapeHtml(r.notes || "")}</textarea>
          <div class="request-actions">
            <button class="btn btn-primary btn-sm notes-save" type="button">Notitie opslaan</button>
            <span class="save-msg" aria-live="polite"></span>
            <button class="request-delete" type="button">Verwijderen</button>
          </div>
        </div>
      </div>`;
  }

  async function loadRequests() {
    const list = await KMJ.get("/api/requests");
    const wrap = document.getElementById("requests-list");
    const empty = document.getElementById("requests-empty");
    wrap.innerHTML = list.map(requestCard).join("");
    empty.hidden = list.length > 0;
    bindRequestEvents();
  }

  function bindRequestEvents() {
    document.querySelectorAll(".request-card").forEach((card) => {
      const id = card.dataset.id;

      // Status change → save immediately
      card.querySelector(".request-status").addEventListener("change", async (e) => {
        const status = e.target.value;
        try {
          await KMJ.send("/api/requests/" + id, "PATCH", { status });
          card.className = "request-card status-" + statusSlug(status);
        } catch (err) {
          alert("Status opslaan mislukt: " + err.message);
        }
      });

      // Notes save
      card.querySelector(".notes-save").addEventListener("click", async () => {
        const notes = card.querySelector(".notes-input").value;
        const msg = card.querySelector(".save-msg");
        try {
          await KMJ.send("/api/requests/" + id, "PATCH", { notes });
          msg.textContent = "Opgeslagen ✓";
          setTimeout(() => (msg.textContent = ""), 2000);
        } catch (err) {
          msg.textContent = "Mislukt";
        }
      });

      // Delete
      card.querySelector(".request-delete").addEventListener("click", async () => {
        if (!confirm("Deze aanvraag verwijderen?")) return;
        try {
          await KMJ.send("/api/requests/" + id, "DELETE");
          loadRequests();
          loadStats();
        } catch (err) {
          alert("Verwijderen mislukt: " + err.message);
        }
      });
    });
  }

  async function loadAll() {
    try {
      await loadStats();
      await loadRequests();
    } catch (err) {
      dash.innerHTML = '<p class="empty-state">Kon dashboard niet laden.</p>';
    }
  }

  // Gate on admin state (from app.js).
  KMJ.onAdminChange((isAdmin) => {
    locked.hidden = isAdmin;
    dash.hidden = !isAdmin;
    if (isAdmin && !loaded) {
      loaded = true;
      loadAll();
    }
  });
})();
