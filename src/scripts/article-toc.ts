const toc = document.querySelector<HTMLElement>('.article-toc');

if (toc) {
  const details = toc.querySelector('details')!;
  const wideScreen = window.matchMedia('(min-width: 1240px)');
  const setLayout = () => { details.open = wideScreen.matches; };
  setLayout();
  wideScreen.addEventListener('change', setLayout);

  const sections = [...toc.querySelectorAll<HTMLAnchorElement>('nav a')].map(link => ({
    link,
    heading: document.getElementById(decodeURIComponent(link.hash.slice(1))),
  })).filter(section => section.heading !== null);

  for (const section of sections) {
    section.heading!.tabIndex = -1;
    section.link.addEventListener('click', () => {
      if (!wideScreen.matches) details.open = false;
    });
  }

  const updateCurrentSection = () => {
    const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height || 76;
    let current = sections[0];
    for (const section of sections) {
      if (section.heading!.getBoundingClientRect().top <= headerHeight + 32) current = section;
    }
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) current = sections.at(-1);
    for (const section of sections) {
      if (section === current) section.link.setAttribute('aria-current', 'location');
      else section.link.removeAttribute('aria-current');
    }
  };

  let scheduled = false;
  const scheduleUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      updateCurrentSection();
    });
  };
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  updateCurrentSection();
}

export {};
