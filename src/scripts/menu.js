// Mobile menu toggle with liquid glass support
// Toggles aria-expanded on the menu button and .is-expanded on the nav-links container

const menu = document.querySelector('.menu');
const navLinks = document.getElementById('main-menu');

menu?.addEventListener('click', () => {
  const isExpanded = menu.getAttribute('aria-expanded') === 'true';
  const nextState = !isExpanded;

  // Update button state
  menu.setAttribute('aria-expanded', String(nextState));

  // Toggle visibility class on the nav-links sibling
  if (navLinks) {
    navLinks.classList.toggle('is-expanded', nextState);
  }
});

// Close menu when clicking outside (better UX)
document.addEventListener('click', (event) => {
  if (!navLinks || navLinks.classList.contains('is-expanded') === false) return;

  const target = event.target;
  if (target instanceof Node && !menu?.contains(target) && !navLinks.contains(target)) {
    menu?.setAttribute('aria-expanded', 'false');
    navLinks.classList.remove('is-expanded');
  }
});

// Close menu on Escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navLinks?.classList.contains('is-expanded')) {
    menu?.setAttribute('aria-expanded', 'false');
    navLinks.classList.remove('is-expanded');
    menu?.focus();
  }
});
