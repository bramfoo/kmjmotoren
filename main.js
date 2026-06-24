// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const navLinks = document.getElementById('nav-links');

if (toggle && navLinks) {
  toggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });

  // Close nav on link click (mobile)
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      toggle.setAttribute('aria-expanded', false);
    });
  });
}

// Service multi-select dropdown (optional)
const serviceSelect = document.getElementById('service-select');
if (serviceSelect) {
  const serviceToggle = document.getElementById('service-toggle');
  const serviceLabel = document.getElementById('service-toggle-label');
  const serviceMenu = document.getElementById('service-menu');
  const serviceBoxes = serviceMenu.querySelectorAll('input[type="checkbox"]');

  serviceToggle.addEventListener('click', () => {
    const open = serviceSelect.classList.toggle('open');
    serviceToggle.setAttribute('aria-expanded', open);
  });

  // Update the button label with how many are selected
  serviceMenu.addEventListener('change', () => {
    const count = [...serviceBoxes].filter(b => b.checked).length;
    serviceLabel.textContent = count ? count + ' geselecteerd' : 'Kies service(s)';
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!serviceSelect.contains(e.target)) serviceSelect.classList.remove('open');
  });
}

// Contact form – client-side feedback (no backend)
const contactForm = document.getElementById('contact-form');
if (contactForm) contactForm.addEventListener('submit', function (e) {
  e.preventDefault();
  const notice = document.getElementById('form-notice');
  const naam = this.naam.value.trim();
  const email = this.email.value.trim();
  const bericht = this.bericht.value.trim();

  if (!naam || !email || !bericht) {
    notice.textContent = 'Vul alle verplichte velden in.';
    notice.className = 'form-notice error';
    return;
  }

  const services = [...this.querySelectorAll('input[name="service"]:checked')].map(b => b.value);
  const payload = {
    naam,
    email,
    telefoon: this.telefoon.value.trim(),
    voertuig: this.voertuig.value.trim(),
    bericht,
    services,
  };

  notice.textContent = 'Bezig met verzenden…';
  notice.className = 'form-notice';
  const form = this;
  fetch('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(() => {
      notice.textContent = 'Bedankt! Uw aanvraag is verzonden. We nemen zo snel mogelijk contact op.';
      notice.className = 'form-notice success';
      form.reset();
      const svcLabel = document.getElementById('service-toggle-label');
      if (svcLabel) svcLabel.textContent = 'Kies service(s)';
    })
    .catch(() => {
      notice.textContent = 'Verzenden mislukt. Probeer het later opnieuw of bel ons.';
      notice.className = 'form-notice error';
    });
});
