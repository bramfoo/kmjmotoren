// ── KMJ Motoren – socials gallery ───────────────────────────────────
(function () {
  const grid = document.getElementById("gallery-grid");
  const empty = document.getElementById("gallery-empty");
  const form = document.getElementById("gallery-form");
  const msg = document.getElementById("gallery-form-msg");
  const typeSel = document.getElementById("gallery-type");
  const fileRow = document.getElementById("gallery-file-row");
  const linkRow = document.getElementById("gallery-link-row");
  const fileInput = document.getElementById("gallery-file");

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // Build an embed for a known platform link.
  function embedHtml(url, platform) {
    try {
      if (platform === "youtube") {
        let id = "";
        const u = new URL(url);
        if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
        else if (u.pathname.includes("/shorts/")) id = u.pathname.split("/shorts/")[1].split("/")[0];
        else id = u.searchParams.get("v") || "";
        if (id) return `<iframe src="https://www.youtube.com/embed/${id}" allowfullscreen loading="lazy" title="YouTube"></iframe>`;
      }
      if (platform === "tiktok") {
        const m = url.match(/video\/(\d+)/);
        if (m) return `<iframe src="https://www.tiktok.com/embed/v2/${m[1]}" allowfullscreen loading="lazy" title="TikTok"></iframe>`;
      }
      if (platform === "instagram") {
        const m = url.match(/\/(reel|reels|p|tv)\/([^/?]+)/);
        if (m) return `<iframe src="https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}/embed" allowfullscreen loading="lazy" title="Instagram"></iframe>`;
      }
    } catch (_) { /* fall through */ }
    return `<a class="gallery-link-fallback" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Bekijk &#8599;</a>`;
  }

  function media(item) {
    if (item.kind === "image") return `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.caption || "Foto")}" loading="lazy" />`;
    if (item.kind === "video") return `<video src="${escapeHtml(item.url)}" controls preload="metadata"></video>`;
    return embedHtml(item.url, item.platform);
  }

  function tile(item) {
    return `
      <figure class="gallery-item gallery-${item.kind} platform-${item.platform || "none"}" data-id="${item.id}">
        <div class="gallery-media">${media(item)}</div>
        ${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ""}
        <button class="item-delete admin-only" type="button" title="Verwijderen" data-id="${item.id}">&times;</button>
      </figure>`;
  }

  async function load() {
    try {
      const data = await KMJ.get("/api/gallery");
      grid.innerHTML = data.map(tile).join("");
      empty.hidden = data.length > 0;
      if (!data.length) empty.textContent = "Nog geen media toegevoegd.";
      bindDeletes();
    } catch (err) {
      empty.textContent = "Kon galerij niet laden. Draait de server?";
      empty.hidden = false;
    }
  }

  function bindDeletes() {
    grid.querySelectorAll(".item-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Dit item verwijderen?")) return;
        try {
          await KMJ.send("/api/gallery/" + btn.dataset.id, "DELETE");
          load();
        } catch (err) {
          alert("Verwijderen mislukt: " + err.message);
        }
      });
    });
  }

  // Toggle file vs. link inputs based on chosen type.
  function syncFormMode() {
    const isLink = typeSel.value === "embed";
    fileRow.hidden = isLink;
    linkRow.hidden = !isLink;
    fileInput.accept = typeSel.value === "video" ? "video/*" : "image/*,.heic,.heif";
  }

  if (typeSel) typeSel.addEventListener("change", syncFormMode);

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.textContent = "Bezig met opslaan…";
      msg.className = "form-notice";
      try {
        const kind = typeSel.value; // image | video | embed
        const caption = form.querySelector("#gallery-caption").value.trim();
        if (kind === "embed") {
          const url = form.querySelector("#gallery-url").value.trim();
          if (!url) throw new Error("Geef een link op.");
          await KMJ.send("/api/gallery", "POST", { kind, url, caption });
        } else {
          if (!fileInput.files[0]) throw new Error("Kies een bestand.");
          const fd = new FormData();
          fd.append("kind", kind);
          fd.append("caption", caption);
          fd.append("file", fileInput.files[0]);
          await KMJ.send("/api/gallery", "POST", fd);
        }
        msg.textContent = "Toegevoegd aan de galerij!";
        msg.className = "form-notice success";
        form.reset();
        syncFormMode();
        load();
      } catch (err) {
        msg.textContent = "Opslaan mislukt: " + err.message;
        msg.className = "form-notice error";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    syncFormMode();
    load();
  });
})();
