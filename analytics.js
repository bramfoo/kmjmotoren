(function () {
  'use strict';

  var GA_ID = 'G-BF3MN2541P';
  var CONSENT_KEY = 'kmj_cookie_consent'; // 'granted' | 'denied'

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  // ── GA loader ──────────────────────────────────────────────────────────────
  function loadGA() {
    if (document.querySelector('script[src*="googletagmanager.com"]')) return;
    gtag('js', new Date());
    gtag('config', GA_ID);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }

  // ── Consent helpers ────────────────────────────────────────────────────────
  function getConsent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (_) { return null; }
  }
  function setConsent(val) {
    try { localStorage.setItem(CONSENT_KEY, val); } catch (_) {}
  }

  function grantConsent() {
    setConsent('granted');
    loadGA();
    hideBanner();
  }
  function denyConsent() {
    setConsent('denied');
    hideBanner();
  }

  // ── Banner ─────────────────────────────────────────────────────────────────
  function showBanner() {
    var b = document.getElementById('cookie-banner');
    if (!b) b = injectBanner();
    b.removeAttribute('hidden');
  }
  function hideBanner() {
    var b = document.getElementById('cookie-banner');
    if (b) b.setAttribute('hidden', '');
  }

  function injectBanner() {
    var el = document.createElement('div');
    el.id = 'cookie-banner';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Cookiemelding');
    el.innerHTML =
      '<div class="cb-inner">' +
        '<p class="cb-text">Wij gebruiken <strong>Google Analytics</strong> om bij te houden hoe bezoekers onze site gebruiken.' +
        ' Hiervoor worden analytische cookies geplaatst. U kunt uw keuze altijd wijzigen via "Cookie instellingen" in de footer.</p>' +
        '<div class="cb-btns">' +
          '<button id="cb-deny" type="button" class="cb-btn-secondary">Alleen functioneel</button>' +
          '<button id="cb-accept" type="button" class="cb-btn-primary">Accepteren</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelector('#cb-accept').addEventListener('click', grantConsent);
    el.querySelector('#cb-deny').addEventListener('click', denyConsent);
    return el;
  }

  // ── Footer settings link ───────────────────────────────────────────────────
  function injectFooterLink() {
    var fi = document.querySelector('.footer-inner');
    if (!fi) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cookie-settings-btn';
    btn.textContent = 'Cookie instellingen';
    btn.addEventListener('click', function () {
      try { localStorage.removeItem(CONSENT_KEY); } catch (_) {}
      showBanner();
    });
    fi.appendChild(btn);
  }

  // ── Public API (extends window.KMJ set by app.js) ─────────────────────────
  window.KMJ = window.KMJ || {};
  KMJ.trackEvent = function (name, params) {
    if (getConsent() === 'granted') {
      gtag('event', name, params || {});
    }
  };

  // ── Init ───────────────────────────────────────────────────────────────────
  if (getConsent() === 'granted') loadGA();

  function onReady() {
    if (!getConsent()) showBanner();
    injectFooterLink();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
