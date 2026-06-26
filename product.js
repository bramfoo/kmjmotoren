// ── KMJ Motoren – single product detail page ────────────────────────
(function () {
  const wrap = document.getElementById("product-detail");
  const msg = document.getElementById("product-detail-msg");
  const id = new URLSearchParams(location.search).get("id");

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function showError(text) {
    wrap.innerHTML = "";
    msg.textContent = text;
    msg.hidden = false;
  }

  function render(p) {
    document.title = p.name + " – KMJ Motoren";
    const imgs = (p.images && p.images.length) ? p.images : [];
    const main = imgs[0];

    const mainHtml = main
      ? `<img id="detail-main-img" src="${escapeHtml(main)}" alt="${escapeHtml(p.name)}" />`
      : `<div class="product-noimg">&#128247;</div>`;

    const thumbs = imgs.length > 1
      ? `<div class="detail-thumbs">${imgs.map((u, i) =>
          `<button class="detail-thumb${i === 0 ? " active" : ""}" type="button" data-src="${escapeHtml(u)}">
             <img src="${escapeHtml(u)}" alt="" loading="lazy" />
           </button>`).join("")}</div>`
      : "";

    wrap.innerHTML = `
      <div class="detail-gallery">
        <div class="detail-main">${mainHtml}</div>
        ${thumbs}
      </div>
      <div class="detail-info">
        <h1>${escapeHtml(p.name)}</h1>
        ${p.price ? `<p class="detail-price">${escapeHtml(KMJ.euro(p.price))}</p>` : ""}
        ${p.description
          ? `<div class="detail-desc">${escapeHtml(p.description)}</div>`
          : `<p class="detail-desc detail-desc-empty">Geen beschrijving beschikbaar.</p>`}
        <div class="detail-buy" id="detail-buy">${buyControl(p)}</div>
      </div>`;

    // Thumbnail → main image switching
    const mainImg = document.getElementById("detail-main-img");
    wrap.querySelectorAll(".detail-thumb").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (mainImg) mainImg.src = btn.dataset.src;
        wrap.querySelectorAll(".detail-thumb").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    const openBtn = document.getElementById("buy-open");
    if (openBtn) openBtn.addEventListener("click", openBuyModal);
  }

  function buyControl(p) {
    if (p.sold) return `<span class="reserved-badge sold-badge">&#10003; Verkocht</span>`;
    if (p.reserved) return `<span class="reserved-badge">&#9679; Gereserveerd</span>`;
    return `<button class="btn btn-primary btn-buy" id="buy-open" type="button">Kopen</button>`;
  }

  async function load() {
    if (!id) { showError("Geen product opgegeven."); return; }
    try {
      const p = await KMJ.get("/api/products/" + encodeURIComponent(id));
      render(p);
    } catch (err) {
      showError("Dit product kon niet worden gevonden.");
    }
  }

  // ── Buy modal ───────────────────────────────────────────────────────
  function val(elId) { return document.getElementById(elId).value.trim(); }

  function openBuyModal() {
    document.getElementById("buy-form-wrap").hidden = false;
    document.getElementById("buy-success").hidden = true;
    document.getElementById("buy-msg").textContent = "";
    document.getElementById("buy-modal").classList.add("open");
  }
  function closeBuyModal() {
    document.getElementById("buy-modal").classList.remove("open");
  }

  function setupBuy() {
    const modal = document.getElementById("buy-modal");
    if (!modal) return;
    document.getElementById("buy-close").addEventListener("click", closeBuyModal);
    document.getElementById("buy-success-close").addEventListener("click", closeBuyModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeBuyModal(); });

    document.getElementById("buy-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("buy-msg");
      const payload = {
        product_id: id,
        voornaam: val("buy-voornaam"),
        achternaam: val("buy-achternaam"),
        adres: val("buy-adres"),
        email: val("buy-email"),
        telefoon: val("buy-telefoon"),
      };
      if (!payload.voornaam || !payload.achternaam || !payload.adres || !payload.email || !payload.telefoon) {
        msg.textContent = "Vul alle velden in.";
        msg.className = "form-notice error";
        return;
      }
      msg.textContent = "Bezig met verzenden…";
      msg.className = "form-notice";
      try {
        await KMJ.send("/api/orders", "POST", payload);
        document.getElementById("buy-form-wrap").hidden = true;
        document.getElementById("buy-success").hidden = false;
        const buyArea = document.getElementById("detail-buy");
        if (buyArea) buyArea.innerHTML = '<span class="reserved-badge">&#9679; Gereserveerd</span>';
      } catch (err) {
        msg.textContent = "Verzenden mislukt: " + err.message;
        msg.className = "form-notice error";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupBuy();
    load();
  });
})();
