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

  // Placeholder – replace with real form submission (e.g. Formspree, EmailJS)
  const services = [...this.querySelectorAll('input[name="service"]:checked')].map(b => b.value);
  const extra = services.length ? ' Gekozen service(s): ' + services.join(', ') + '.' : '';
  notice.textContent = 'Bedankt! Uw bericht is verzonden.' + extra + ' We nemen zo snel mogelijk contact op.';
  notice.className = 'form-notice success';
  this.reset();
  const svcLabel = document.getElementById('service-toggle-label');
  if (svcLabel) svcLabel.textContent = 'Kies service(s)';
});
