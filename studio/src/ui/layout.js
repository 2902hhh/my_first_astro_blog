const DEFAULTS = { left: 240, right: 280, previewRatio: .5 };
const GUTTER = 8;
const WORKSPACE_MIN = 420;
const SIDES = { left: { min: 180, max: 420 }, right: { min: 220, max: 480 } };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

export function fitSidebars(width, preferences = DEFAULTS) {
  let left = clamp(finite(preferences.left, DEFAULTS.left), SIDES.left.min, SIDES.left.max);
  let right = clamp(finite(preferences.right, DEFAULTS.right), SIDES.right.min, SIDES.right.max);
  const budget = Math.max(SIDES.left.min + SIDES.right.min, width - GUTTER * 2 - WORKSPACE_MIN);
  const excess = left + right - budget;
  if (excess > 0) {
    const available = left - SIDES.left.min + right - SIDES.right.min;
    left = Math.round(left - excess * (left - SIDES.left.min) / available);
    right = budget - left;
  }
  return { left, right, budget };
}

export function previewBounds(width) {
  const usable = Math.max(1, width - GUTTER);
  const min = Math.min(180, usable * .45);
  return { usable, min: Math.max(min, usable * .15), max: Math.min(usable - min, usable * .85) };
}

function bindSeparator(element, { read, limits, write, save, reset, direction = 1 }) {
  let drag;
  const finish = () => {
    if (!drag) return;
    drag = null;
    document.body.classList.remove('resizing-panels');
    save();
  };
  element.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, value: read() };
    element.setPointerCapture(event.pointerId);
    element.focus({ preventScroll: true });
    document.body.classList.add('resizing-panels');
    event.preventDefault();
  });
  element.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    write(drag.value + (event.clientX - drag.x) * direction);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(name, finish);
  window.addEventListener('blur', finish);
  element.addEventListener('dblclick', () => { reset(); save(); });
  element.addEventListener('keydown', event => {
    const { min, max } = limits();
    let value;
    if (event.key === 'Home') value = min;
    else if (event.key === 'End') value = max;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') value = read() + (event.key === 'ArrowRight' ? 1 : -1) * direction * (event.shiftKey ? 40 : 10);
    else return;
    event.preventDefault(); write(value); save();
  });
  return () => { finish(); window.removeEventListener('blur', finish); };
}

export function initLayout() {
  const $ = id => document.getElementById(id);
  const shell = document.querySelector('.app-shell');
  const storageKey = 'local-writing.layout.v1';
  let preferences = { ...DEFAULTS };
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (stored) for (const key of Object.keys(DEFAULTS)) preferences[key] = finite(stored[key], DEFAULTS[key]);
  } catch { /* Layout remains usable if local storage is unavailable. */ }
  preferences.previewRatio = clamp(preferences.previewRatio, .15, .85);
  let previewVisible = true, editor, mode, content, previewHandle, observer, cleanupPreview;
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { /* Nonessential preference. */ } };
  const sizes = () => fitSidebars(shell.clientWidth, preferences);
  const sideLimits = side => ({ min: SIDES[side].min, max: Math.min(SIDES[side].max, sizes().budget - sizes()[side === 'left' ? 'right' : 'left']) });
  const previewPixels = () => {
    const bounds = previewBounds(content?.clientWidth || 0);
    return { ...bounds, value: clamp(preferences.previewRatio * bounds.usable, bounds.min, bounds.max) };
  };
  const aria = (element, value, min, max, text = `${Math.round(value)} 像素`) => {
    element.setAttribute('aria-valuenow', Math.round(value));
    element.setAttribute('aria-valuemin', Math.ceil(min));
    element.setAttribute('aria-valuemax', Math.floor(max));
    element.setAttribute('aria-valuetext', text);
  };
  function renderPreview() {
    $('live-preview-toggle').hidden = mode !== 'sv' || !editor;
    $('live-preview-toggle').setAttribute('aria-pressed', String(previewVisible));
    $('live-preview-toggle').title = previewVisible ? '关闭实时预览' : '开启实时预览';
    if (!content) return;
    content.dataset.writingMode = mode;
    const visible = mode === 'sv' && previewVisible;
    content.dataset.livePreview = String(visible);
    previewHandle.hidden = !visible;
    if (!visible) { content.style.gridTemplateColumns = ''; return; }
    const { value, usable, min, max } = previewPixels();
    const ratio = value / usable;
    content.style.gridTemplateColumns = `minmax(0, ${1 - ratio}fr) ${GUTTER}px minmax(0, ${ratio}fr)`;
    aria(previewHandle, value, min, max, `${Math.round(ratio * 100)}%，${Math.round(value)} 像素`);
  }
  function render() {
    const current = sizes();
    shell.style.setProperty('--library-width', `${current.left}px`);
    shell.style.setProperty('--inspector-width', `${current.right}px`);
    for (const side of ['left', 'right']) {
      const { min, max } = sideLimits(side);
      aria($(`${side}-resizer`), current[side], min, max);
    }
    renderPreview();
  }
  function resizeSide(side, width) {
    const current = sizes(), { min, max } = sideLimits(side);
    preferences.left = current.left; preferences.right = current.right;
    preferences[side] = clamp(width, min, max);
    render();
  }
  for (const side of ['left', 'right']) bindSeparator($(`${side}-resizer`), {
    read: () => sizes()[side], limits: () => sideLimits(side), write: width => resizeSide(side, width), save,
    reset: () => resizeSide(side, DEFAULTS[side]), direction: side === 'left' ? 1 : -1,
  });
  const shellObserver = new ResizeObserver(render); shellObserver.observe(shell);
  $('live-preview-toggle').addEventListener('click', () => {
    if (!editor || mode !== 'sv') return;
    previewVisible = !previewVisible;
    editor.setPreviewMode(previewVisible ? 'both' : 'editor');
    renderPreview();
  });
  const fields = () => {
    const current = sizes();
    $('layout-left').value = Math.round(current.left);
    $('layout-right').value = Math.round(current.right);
    $('layout-preview').value = Math.round(preferences.previewRatio * 100);
  };
  $('layout-settings').addEventListener('click', () => { fields(); $('layout-dialog').showModal(); });
  $('layout-reset').addEventListener('click', () => { preferences = { ...DEFAULTS }; render(); fields(); save(); });
  $('layout-form').addEventListener('submit', event => {
    event.preventDefault();
    preferences = { left: +$('layout-left').value, right: +$('layout-right').value, previewRatio: +$('layout-preview').value / 100 };
    render(); save(); $('layout-dialog').close();
  });
  render();
  return {
    get previewVisible() { return previewVisible; },
    detachEditor() { cleanupPreview?.(); cleanupPreview = null; observer?.disconnect(); observer = null; editor = null; content = null; previewHandle = null; renderPreview(); },
    attachEditor(nextEditor, nextMode) {
      editor = nextEditor; mode = nextMode;
      content = document.querySelector('#editor .vditor-content');
      const source = content.querySelector('.vditor-sv'), preview = content.querySelector('.vditor-preview');
      source.id = 'markdown-source'; source.setAttribute('aria-label', 'Markdown 正文');
      preview.id = 'markdown-preview'; preview.setAttribute('role', 'region'); preview.setAttribute('aria-label', '实时预览');
      previewHandle = document.createElement('div');
      previewHandle.id = 'preview-resizer'; previewHandle.className = 'panel-resizer'; previewHandle.tabIndex = 0;
      previewHandle.setAttribute('role', 'separator'); previewHandle.setAttribute('aria-orientation', 'vertical');
      previewHandle.setAttribute('aria-label', '调整实时预览宽度'); previewHandle.setAttribute('aria-controls', 'markdown-preview');
      previewHandle.title = '拖动调整预览宽度；方向键微调，双击恢复均分';
      preview.before(previewHandle);
      cleanupPreview = bindSeparator(previewHandle, {
        read: () => previewPixels().value, limits: previewPixels,
        write: width => { const { min, max, usable } = previewPixels(); preferences.previewRatio = clamp(width, min, max) / usable; renderPreview(); },
        save, reset: () => { preferences.previewRatio = DEFAULTS.previewRatio; renderPreview(); }, direction: -1,
      });
      observer = new ResizeObserver(renderPreview); observer.observe(content);
      renderPreview();
    },
  };
}
