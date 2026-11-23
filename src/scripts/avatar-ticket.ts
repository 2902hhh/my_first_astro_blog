import { reset, step, type Spring } from './spring';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*+=/<>';
const FLICKER_SECONDS = .055;

type Letter = { element: HTMLSpanElement; value: string; settleAt: number; flickerAt: number };

function scramble(quote: HTMLElement, text: string) {
  const content = document.createDocumentFragment();
  let index = 0;
  const startedAt = performance.now();
  let letters: Letter[] = [];
  for (const word of text.match(/\s+|\S+/g) ?? []) {
    if (/^\s/.test(word)) {
      content.append(word);
      index += word.length;
      continue;
    }
    const group = document.createElement('span');
    group.dataset.ticketWord = '';
    for (const value of word) {
      const element = document.createElement('span');
      element.dataset.pending = '';
      element.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      const settleAt = .18 + index++ * .035 + Math.random() * .28;
      letters.push({ element, value, settleAt, flickerAt: FLICKER_SECONDS });
      group.append(element);
    }
    content.append(group);
  }
  quote.replaceChildren(content);
  quote.dataset.decoding = '';

  return (now: number) => {
    const elapsed = (now - startedAt) / 1000;
    letters = letters.filter(letter => {
      if (elapsed >= letter.settleAt) {
        letter.element.textContent = letter.value;
        delete letter.element.dataset.pending;
        return false;
      }
      if (elapsed >= letter.flickerAt) {
        letter.element.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        letter.flickerAt = elapsed + FLICKER_SECONDS;
      }
      return true;
    });
    if (!letters.length) delete quote.dataset.decoding;
    return letters.length > 0;
  };
}

function settle(spring: Spring) {
  const resting = Math.abs(spring.target - spring.value) < .002 && Math.abs(spring.velocity) < .02;
  if (resting) reset(spring, spring.target);
  return resting;
}

export function mountAvatarTicket(ticket: HTMLButtonElement) {
  const rotor = ticket.querySelector<HTMLElement>('[data-ticket-rotor]')!;
  const portrait = ticket.querySelector<HTMLImageElement>('[data-ticket-portrait]')!;
  const name = ticket.querySelector<HTMLElement>('[data-ticket-name]')!;
  const quote = ticket.querySelector<HTMLElement>('[data-ticket-quote]')!;
  const status = ticket.parentElement!.querySelector<HTMLElement>('[data-ticket-status]')!;
  const text = quote.textContent!.trim();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const styles = getComputedStyle(ticket);
  const token = (name: string) => styles.getPropertyValue(`--ticket-${name}`).trim();
  const tilt = Number(token('tilt'));
  const depth = Number(token('depth'));
  const spring = (name: string, value = 0): Spring => {
    const [stiffness, damping] = token(name).split(/\s+/).map(Number);
    return { value, target: value, velocity: 0, stiffness, damping };
  };
  const x = spring('follow');
  const y = spring('follow');
  const flip = spring('flip');
  const shine = spring('glare');
  const lift = spring('lift', 1);
  const springs = [x, y, flip, shine, lift];

  let flipped = false;
  let revealQuote = false;
  let decode: ReturnType<typeof scramble> | undefined;
  let idleUntil = 3.6;
  let introTime = 0;
  let frame = 0;
  let previous = 0;

  function draw() {
    rotor.style.transform = `rotateX(${x.value}deg) rotateY(${y.value + flip.value}deg) scale(${lift.value})`;
    const px = y.value / tilt * depth;
    const py = -x.value / tilt * depth;
    portrait.style.transform = `translate(${px * .25}px, ${py * .25}px)`;
    name.style.transform = `translate(${px * .9}px, ${py * .9}px)`;
    rotor.style.setProperty('--ticket-shine', String(Math.min(1, Math.max(0, shine.value))));
  }

  function resetQuote() {
    decode = undefined;
    quote.textContent = text;
    delete quote.dataset.decoding;
  }

  function showQuote() {
    revealQuote = false;
    if (!reduced.matches) decode = scramble(quote, text);
    status.textContent = text;
  }

  function tick(now: number) {
    // Take four short physics steps to match the reference spring motion.
    const dt = Math.max(0, Math.min((now - previous) / 1000, 1 / 30));
    previous = now;
    if (introTime < idleUntil) {
      introTime += dt;
      const fade = Math.max(0, Math.min(1, (idleUntil - introTime) / .9));
      x.target = Math.sin(introTime * .9) * 4 * fade;
      y.target = Math.cos(introTime * .7) * 7 * fade;
      shine.target = .25 * fade;
    }
    for (let pass = 0; pass < 4; pass++) for (const state of springs) step(state, dt / 4);
    if (revealQuote && y.value + flip.value >= 90) showQuote();
    if (decode && !decode(now)) decode = undefined;
    const resting = springs.map(settle).every(Boolean);
    draw();
    frame = !resting || decode || introTime < idleUntil ? requestAnimationFrame(tick) : 0;
  }

  function animate() {
    if (frame || reduced.matches) return;
    previous = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function stopIntro() {
    if (introTime >= idleUntil) return;
    idleUntil = 0;
    x.target = y.target = shine.target = 0;
  }

  function snap() {
    cancelAnimationFrame(frame);
    frame = 0;
    idleUntil = 0;
    for (const state of [x, y, shine]) reset(state, 0);
    reset(flip, flipped ? 180 : 0);
    reset(lift, 1);
    resetQuote();
    if (flipped && revealQuote) showQuote();
    draw();
  }

  const normalized = (offset: number, size: number) => Math.max(-1, Math.min(1, offset / size * 2 - 1));
  ticket.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || reduced.matches) return;
    const bounds = ticket.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    stopIntro();
    const nx = normalized(event.clientX - bounds.left, bounds.width);
    const ny = normalized(event.clientY - bounds.top, bounds.height);
    x.target = -ny * tilt;
    y.target = nx * tilt;
    shine.target = 1;
    rotor.style.setProperty('--ticket-x', `${(nx + 1) * 50}%`);
    rotor.style.setProperty('--ticket-y', `${(ny + 1) * 50}%`);
    animate();
  });
  ticket.addEventListener('pointerleave', () => {
    stopIntro();
    x.target = y.target = shine.target = 0;
    animate();
  });
  ticket.addEventListener('pointerdown', event => {
    if (event.button !== 0 || reduced.matches) return;
    stopIntro();
    lift.target = .97;
    animate();
  });
  function release() {
    if (lift.target === 1) return;
    lift.target = 1;
    animate();
  }
  for (const event of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(event, release);

  ticket.addEventListener('click', () => {
    stopIntro();
    flipped = !flipped;
    ticket.setAttribute('aria-pressed', String(flipped));
    revealQuote = flipped;
    if (!flipped) {
      resetQuote();
      status.textContent = '';
    }
    if (reduced.matches) {
      snap();
      return;
    }
    flip.target = flipped ? 180 : 0;
    lift.velocity += 1.5;
    animate();
  });
  reduced.addEventListener('change', () => { if (reduced.matches) snap(); });

  ticket.disabled = false;
  if (!reduced.matches) animate();
}
