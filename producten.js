// ── KMJ Motoren – producten page ────────────────────────────────────
(function () {
  const grid = document.getElementById("product-grid");
  const empty = document.getElementById("product-empty");
  const form = document.getElementById("product-form");
  const msg = document.getElementById("product-form-msg");

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function card(p) {
    const thumb = (p.images && p.images[0]) || p.image_url;
    const count = (p.images && p.images.length) || 0;
    const img = thumb
      ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(p.name)}" loading="lazy" />`
      : `<div class="product-noimg">&#128247;</div>`;
    return `
      <article class="product-card" data-id="${p.id}">
        <a class="product-link" href="product.html?id=${p.id}">
          <div class="product-media">
            ${img}
            ${p.sold ? `<span class="reserved-ribbon sold-ribbon">Verkocht</span>` : p.reserved ? `<span class="reserved-ribbon">Gereserveerd</span>` : ""}
            ${count > 1 ? `<span class="photo-count">&#128247; ${count}</span>` : ""}
          </div>
          <div class="product-body">
            <h3>${escapeHtml(p.name)}</h3>
            ${p.price ? `<p class="product-price">${escapeHtml(KMJ.euro(p.price))}</p>` : ""}
            ${p.description ? `<p class="product-desc">${escapeHtml(p.description)}</p>` : ""}
          </div>
        </a>
        <button class="item-delete admin-only" type="button" title="Verwijderen" data-id="${p.id}">&times;</button>
      </article>`;
  }

  async function load() {
    try {
      const data = await KMJ.get("/api/products");
      grid.innerHTML = data.map(card).join("");
      empty.hidden = data.length > 0;
      if (!data.length) empty.textContent = "Nog geen producten toegevoegd.";
      bindDeletes();
    } catch (err) {
      empty.textContent = "Kon producten niet laden. Draait de server?";
      empty.hidden = false;
    }
  }

  function bindDeletes() {
    grid.querySelectorAll(".item-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Dit product verwijderen?")) return;
        try {
          await KMJ.send("/api/products/" + btn.dataset.id, "DELETE");
          load();
        } catch (err) {
          alert("Verwijderen mislukt: " + err.message);
        }
      });
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.textContent = "Bezig met opslaan…";
      msg.className = "form-notice";
      try {
        const fd = new FormData();
        fd.append("name", form.querySelector("#product-name").value.trim());
        fd.append("price", form.querySelector("#product-price").value.trim());
        fd.append("description", form.querySelector("#product-desc").value.trim());
        const files = form.querySelector("#product-image").files;
        for (const f of files) fd.append("images", f);
        await KMJ.send("/api/products", "POST", fd);
        msg.textContent = "Product toegevoegd!";
        msg.className = "form-notice success";
        form.reset();
        load();
      } catch (err) {
        msg.textContent = "Opslaan mislukt: " + err.message;
        msg.className = "form-notice error";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", load);
})();
