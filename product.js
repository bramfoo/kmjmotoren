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

  document.addEventListener("DOMContentLoaded", load);
})();
