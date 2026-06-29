// Mobile menu toggle with liquid glass support
// Toggles aria-expanded on the menu button and .is-expanded on the nav-links container

const menu = document.querySelector('.menu');
const navLinks = document.getElementById('main-menu');

function closeMenu() {
  menu?.setAttribute('aria-expanded', 'false');
  navLinks?.classList.remove('is-expanded');
  document.body.style.overflow = '';
}

function openMenu() {
  menu?.setAttribute('aria-expanded', 'true');
  navLinks?.classList.add('is-expanded');
  document.body.style.overflow = 'hidden';
}

menu?.addEventListener('click', () => {
  const isExpanded = menu.getAttribute('aria-expanded') === 'true';
  if (isExpanded) {
    closeMenu();
  } else {
    openMenu();
  }
});

// Close menu when clicking outside
document.addEventListener('click', (event) => {
  if (!navLinks || !navLinks.classList.contains('is-expanded')) return;

  const target = event.target;
  if (target instanceof Node && !menu?.contains(target) && !navLinks.contains(target)) {
    closeMenu();
  }
});

// Close menu on Escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navLinks?.classList.contains('is-expanded')) {
    closeMenu();
    menu?.focus();
  }
});
