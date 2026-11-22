import { applyTheme, currentTheme, saveTheme, themeStorageKey } from './theme';

type Spring = { value: number; velocity: number; target: number; stiffness: number; damping: number };
type Point = { x: number; y: number };
type RopePoint = Point & { vx: number; vy: number };
type Drag = { id: number; from: Point; bead: Point; scale: number; moved: boolean };

const WIRE = 122;
const LINKS = 12;
const LINK_LENGTH = 9;
const ROPE_LENGTH = LINKS * LINK_LENGTH;
const MAX_STRETCH = 54;
const TOGGLE_STRETCH = 22;
const clamp = (n: number, low: number, high: number) => Math.min(Math.max(n, low), high);

function step(spring: Spring, dt: number) {
  const force = spring.stiffness * (spring.target - spring.value) - spring.damping * spring.velocity;
  spring.velocity += force * dt;
  spring.value += spring.velocity * dt;
}

function reset(spring: Spring, value: number) {
  spring.value = spring.target = value;
  spring.velocity = 0;
}

export function mountPullCord(button: HTMLButtonElement) {
  const svg = button.querySelector('svg')!;
  const wire = svg.querySelector('[data-wire]')!;
  const lamp = svg.querySelector('[data-lamp]')!;
  const bulb = svg.querySelector<SVGCircleElement>('[data-bulb]')!;
  const rope = svg.querySelector('[data-rope]')!;
  const bead = svg.querySelector('[data-bead]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const styles = getComputedStyle(button);
  const spring = (name: string, value = 0): Spring => {
    const [stiffness, damping] = styles.getPropertyValue(`--cord-${name}`).trim().split(/\s+/).map(Number);
    return { value, velocity: 0, target: value, stiffness, damping };
  };
  const angle = spring('swing');
  const drop = spring('tug');
  const stretch = spring('stretch', 1);
  const pop = spring('bulb', 1);
  const tapX = spring('tap');
  const tapY = spring('tap');
  const points: RopePoint[] = Array.from({ length: LINKS + 1 }, (_, i) => ({
    x: 184, y: 185 + i * LINK_LENGTH, vx: 0, vy: 0,
  }));
  const end = points[LINKS];
  let drag: Drag | undefined;
  let target: Point | undefined;
  let armed = true;
  let suppressClick = false;
  let tapTime = 0;
  let tapSide = 1;
  let frame = 0;
  let lastTime = 0;
  let settleBy = 0;
  let theme = currentTheme();

  function selectTheme() {
    button.setAttribute('aria-checked', String(theme === 'dark'));
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    selectTheme();
    saveTheme(theme);
    if (reduced.matches) {
      applyTheme(theme);
      return;
    }

    const rect = bulb.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 24;
    const light = theme === 'light';
    const reveal = spring(light ? 'light-on' : 'light-off', light ? 0 : 1);
    reveal.target = light ? 1 : 0;
    const radii = Array.from({ length: 55 }, (_, i) => {
      const radius = i === 54 ? reveal.target : reveal.value;
      for (let substep = 0; substep < 4; substep++) step(reveal, 1 / 240);
      return Math.max(0, radius) * far;
    });
    applyTheme(theme, { x, y, radii, duration: 900 });
    pop.value = light ? 1.35 : .8;
    drop.velocity += 150;
  }

  function anchor(): Point {
    const y = WIRE + drop.value + 63;
    const cos = Math.cos(angle.value);
    const sin = Math.sin(angle.value);
    return { x: 150 + 34 * cos - y * sin, y: 34 * sin + y * cos };
  }

  function constrainPull(origin: Point, pointer: Point) {
    const dx = pointer.x - origin.x;
    const dy = pointer.y - origin.y;
    const distance = Math.hypot(dx, dy) || 1;
    const over = Math.max(0, distance - ROPE_LENGTH);
    const give = MAX_STRETCH * (1 - Math.exp(-over / 70));
    const length = Math.min(distance, ROPE_LENGTH) + give;
    return { x: origin.x + dx * length / distance, y: origin.y + dy * length / distance,
      give, length, lean: dx / distance };
  }

  function advance(dt: number) {
    for (const state of [angle, drop, stretch, pop, tapX, tapY]) step(state, dt);
    const origin = anchor();
    const pointer = target ?? (tapTime > 0 ? { x: tapX.value, y: tapY.value } : undefined);
    const pin = pointer && constrainPull(origin, pointer);
    if (pin?.give) reset(stretch, pin.length / ROPE_LENGTH);
    else stretch.target = 1;
    drop.target = (pin?.give ?? 0) * .22;
    angle.target = pin ? clamp(-pin.lean * pin.give / MAX_STRETCH * .5, -.3, .3) : 0;
    if (armed && pin && pin.give > TOGGLE_STRETCH) {
      armed = false;
      toggleTheme();
      if (tapTime > 0) tapTime = .12;
    }
    if (tapTime > 0) tapTime = Math.max(0, tapTime - dt);

    const previous = points.map(({ x, y }) => ({ x, y }));
    for (let i = 1; i <= LINKS; i++) {
      const point = points[i];
      const friction = Math.exp(-(i === LINKS ? 1.1 : 2.4) * dt);
      point.vx *= friction;
      point.vy = (point.vy + 2600 * dt) * friction;
      const speedLimit = Math.min(1, 2600 / (Math.hypot(point.vx, point.vy) || 1));
      point.x += point.vx * speedLimit * dt;
      point.y += point.vy * speedLimit * dt;
    }

    const length = LINK_LENGTH * Math.max(1, stretch.value);
    const pinEnds = () => {
      Object.assign(points[0], origin);
      if (pin) { end.x = pin.x; end.y = pin.y; }
    };
    for (let pass = 0; pass < 8; pass++) {
      pinEnds();
      for (let i = 0; i < LINKS; i++) {
        const a = points[i];
        const b = points[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 1e-6;
        const aWeight = i === 0 ? 0 : 1;
        const bWeight = i + 1 === LINKS ? (pin ? 0 : .3) : 1;
        const correction = (distance - length) / (distance * (aWeight + bWeight));
        a.x += dx * correction * aWeight;
        a.y += dy * correction * aWeight;
        b.x -= dx * correction * bWeight;
        b.y -= dy * correction * bWeight;
      }
    }
    pinEnds();
    for (let i = 1; i <= LINKS; i++) {
      points[i].vx = (points[i].x - previous[i].x) / dt;
      points[i].vy = (points[i].y - previous[i].y) / dt;
    }
  }

  function draw() {
    const degrees = angle.value * 180 / Math.PI;
    const depth = WIRE + drop.value;
    lamp.setAttribute('transform', `translate(150) rotate(${degrees}) translate(0 ${depth})`);
    wire.setAttribute('d', `M150 0L${150 - Math.sin(angle.value) * depth} ${Math.cos(angle.value) * depth}`);
    bulb.setAttribute('transform', `translate(0 63) scale(${pop.value}) translate(0 -63)`);
    let path = `M${points[0].x} ${points[0].y}`;
    for (let i = 1; i < LINKS; i++) {
      const a = points[i];
      const b = points[i + 1];
      path += `Q${a.x} ${a.y} ${(a.x + b.x) / 2} ${(a.y + b.y) / 2}`;
    }
    rope.setAttribute('d', `${path}L${end.x} ${end.y}`);
    const beforeEnd = points[LINKS - 1];
    const tilt = Math.atan2(beforeEnd.x - end.x, end.y - beforeEnd.y) * 180 / Math.PI;
    bead.setAttribute('transform', `translate(${end.x} ${end.y}) rotate(${tilt})`);
  }

  function rest() {
    cancelAnimationFrame(frame);
    frame = 0;
    tapTime = 0;
    reset(angle, 0);
    reset(drop, 0);
    reset(stretch, 1);
    reset(pop, 1);
    points.forEach((point, i) => Object.assign(point, { x: 184, y: 185 + i * LINK_LENGTH, vx: 0, vy: 0 }));
    draw();
  }

  function tick(time: number) {
    const dt = Math.min((time - lastTime) / 1000, 1 / 30) / 4;
    lastTime = time;
    if (dt > 0) for (let i = 0; i < 4; i++) advance(dt);
    draw();
    if (drag || tapTime || time < settleBy) frame = requestAnimationFrame(tick);
    else rest();
  }

  function animate() {
    const now = performance.now();
    settleBy = now + 2800;
    if (frame || reduced.matches) return;
    lastTime = now;
    frame = requestAnimationFrame(tick);
  }

  button.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const scale = svg.getScreenCTM()?.a;
    if (!scale) return;
    drag = { id: event.pointerId, from: { x: event.clientX, y: event.clientY },
      bead: { x: end.x, y: end.y }, scale, moved: false };
    suppressClick = false;
    tapTime = 0;
    armed = true;
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const dx = event.clientX - drag.from.x;
    const dy = event.clientY - drag.from.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    suppressClick = true;
    target = { x: drag.bead.x + dx / drag.scale, y: drag.bead.y + dy / drag.scale };
    if (reduced.matches && armed && constrainPull(anchor(), target).give > TOGGLE_STRETCH) {
      armed = false;
      toggleTheme();
    }
    animate();
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    button.addEventListener(eventName, event => {
      if (drag?.id !== event.pointerId) return;
      // A quick flick may release before another animation frame.
      if (eventName === 'pointerup' && armed && target && constrainPull(anchor(), target).give > TOGGLE_STRETCH) {
        toggleTheme();
      }
      drag = undefined;
      target = undefined;
      if (suppressClick) animate();
    });
  }
  button.addEventListener('click', event => {
    if (event.detail && suppressClick) return;
    if (reduced.matches) { toggleTheme(); return; }
    if (tapTime > 0) return;
    const origin = anchor();
    reset(tapX, end.x);
    reset(tapY, end.y);
    tapX.target = origin.x + (tapSide *= -1) * 26;
    tapY.target = origin.y + ROPE_LENGTH + 64;
    armed = true;
    tapTime = 1.1;
    animate();
  });
  reduced.addEventListener('change', rest);
  const syncTheme = () => { theme = currentTheme(); selectTheme(); };
  window.addEventListener('storage', event => {
    if (event.key !== themeStorageKey && event.key !== null) return;
    applyTheme(event.newValue === 'dark' ? 'dark' : 'light');
    syncTheme();
  });
  window.addEventListener('pageshow', () => {
    try {
      applyTheme(localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light');
      syncTheme();
    } catch { /* Preserve the theme if storage becomes unavailable. */ }
  });
  selectTheme();
  button.hidden = false;
}
