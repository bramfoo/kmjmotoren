// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const navLinks = document.getElementById('nav-links');

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

// Contact form – client-side feedback (no backend)
document.getElementById('contact-form').addEventListener('submit', function (e) {
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
  notice.textContent = 'Bedankt! Uw bericht is verzonden. We nemen zo snel mogelijk contact op.';
  notice.className = 'form-notice success';
  this.reset();
});
