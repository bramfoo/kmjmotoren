// ── KMJ Motoren – "Uitgelicht" carousel (products + socials) ────────
(function () {
  const track = document.getElementById("carousel-track");
  const empty = document.getElementById("carousel-empty");
  if (!track) return;

  function esc(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // Build an embed for a known platform link (same logic as the socials page).
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
    return `<a class="ci-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Bekijk &#8599;</a>`;
  }

  function productItem(p) {
    const thumb = (p.images && p.images[0]) || p.image_url;
    const media = thumb
      ? `<img src="${esc(thumb)}" alt="${esc(p.name)}" loading="lazy" />`
      : `<div class="ci-noimg">&#128247;</div>`;
    const badge = p.sold
      ? `<span class="ci-badge sold">Verkocht</span>`
      : p.reserved ? `<span class="ci-badge">Gereserveerd</span>` : "";
    return `<a class="carousel-item ci-product" href="product.html?id=${p.id}">
      ${media}${badge}
      <div class="ci-caption">
        <span class="ci-name">${esc(p.name)}</span>
        ${p.price ? `<span class="ci-price">${esc(KMJ.euro(p.price))}</span>` : ""}
      </div>
    </a>`;
  }

  function galleryItem(item) {
    let media;
    if (item.kind === "image") media = `<img src="${esc(item.url)}" alt="${esc(item.caption || "")}" loading="lazy" />`;
    else if (item.kind === "video") media = `<video src="${esc(item.url)}" controls preload="metadata"></video>`;
    else media = embedHtml(item.url, item.platform);
    return `<div class="carousel-item ci-gallery">
      ${media}
      ${item.caption ? `<div class="ci-caption"><span class="ci-name">${esc(item.caption)}</span></div>` : ""}
    </div>`;
  }

  async function load() {
    let products = [];
    let gallery = [];
    try { products = await KMJ.get("/api/products"); } catch (_) {}
    try { gallery = await KMJ.get("/api/gallery"); } catch (_) {}

    const items = [...products.map(productItem), ...gallery.map(galleryItem)];
    if (!items.length) {
      empty.hidden = false;
      track.closest(".carousel").style.display = "none";
      return;
    }
    track.innerHTML = items.join("");
    setupControls();
  }

  function setupControls() {
    const prev = document.querySelector(".carousel-btn.prev");
    const next = document.querySelector(".carousel-btn.next");

    function step() {
      const item = track.querySelector(".carousel-item");
      if (!item) return 250;
      const gap = parseInt(getComputedStyle(track).columnGap || getComputedStyle(track).gap || "16", 10) || 16;
      return item.offsetWidth + gap;
    }

    prev.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
    next.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));

    // Auto-advance, looping back to the start at the end. Pause on hover.
    let timer = setInterval(advance, 4500);
    function advance() {
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 5) {
        track.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        track.scrollBy({ left: step(), behavior: "smooth" });
      }
    }
    const carousel = track.closest(".carousel");
    carousel.addEventListener("mouseenter", () => clearInterval(timer));
    carousel.addEventListener("mouseleave", () => { timer = setInterval(advance, 4500); });
  }

  document.addEventListener("DOMContentLoaded", load);
})();
