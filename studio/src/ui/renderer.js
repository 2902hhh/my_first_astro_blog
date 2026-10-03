import Vditor from 'vditor';
import Cropper from 'cropperjs';
import 'vditor/dist/js/icons/ant.js';
import { extractImages, replaceImage, imageMarkup, visualMarkdown, restoreVisualImages } from './images.js';

const $ = id => document.getElementById(id);
const api = async (method, ...args) => {
  const response = await window.studio.call(method, ...args);
  if (!response.ok) throw new Error(response.error);
  return response.value;
};
const metadataFields = ['title', 'description', 'author', 'category', 'tags', 'pinned', 'pubDate', 'updatedDate'];
const cdn = new URL('/vendor/vditor', location.href).href.replace(/\/$/, '');
let info, draft, editor, loading = false, busy = false, tab = 'drafts', drafts = [], posts = [];
let version = 0, savedVersion = 0, timer, savePromise, selected, cropper, confirmCallback;
let mode = 'wysiwyg';
let lastEditorValue = '';
const markdownOptions = { sanitize: true, autoSpace: false, fixTermTypo: false, paragraphBeginningSpace: false };

function message(text, error = false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
  $('message').hidden = !text;
}
const run = callback => async (...args) => {
  try { await callback(...args); } catch (error) { message(error.message, true); }
};
function state() {
  $('writing').hidden = !draft;
  $('welcome').hidden = !!draft;
  $('document-state').textContent = draft?.sourceName ? '已公开 · 本机编辑' : '草稿';
  $('withdraw').hidden = !draft?.sourceName;
  $('pending').hidden = !info?.pending;
  for (const id of ['new', 'welcome-new']) $(id).disabled = busy || !info;
  for (const id of ['save', 'preview', 'publish', 'insert-image', 'export', 'delete-draft', 'withdraw']) $(id).disabled = busy || !draft;
  $('publish').disabled ||= !!info?.pending;
  $('retry').disabled = busy;
  $('choose-repo').disabled = busy;
  $('mode').disabled = busy || !draft;
  for (const id of ['image-width', 'image-width-number', 'image-alt', 'apply-width', 'apply-alt', 'clear-image']) $(id).disabled = busy;
  if (busy) $('crop').disabled = true;
  for (const id of [...metadataFields, 'slug']) $(id).disabled = busy || !draft || (id === 'slug' && !!draft.sourceName);
  document.querySelectorAll('.list-item').forEach(button => { button.disabled = busy; });
  if (editor) { if (busy) editor.disabled(); else editor.enable(); }
}
async function refresh() {
  if (!info) return;
  [info, drafts, posts] = await Promise.all([api('info'), api('drafts'), api('posts')]);
  $('repo-name').textContent = info.repo;
  $('repo-name').title = `草稿目录：${info.draftsPath}`;
  $('draft-count').textContent = drafts.length;
  $('post-count').textContent = posts.length;
  renderList(); state();
}
function renderList() {
  $('items').replaceChildren();
  const query = $('search').value.trim().toLocaleLowerCase();
  const entries = tab === 'drafts' ? drafts : [...posts].sort((a, b) => String(b.metadata.pubDate).localeCompare(String(a.metadata.pubDate)));
  for (const item of entries.filter(item => (item.metadata.title || '').toLocaleLowerCase().includes(query))) {
    const button = document.createElement('button');
    button.className = 'list-item';
    if (tab === 'drafts' ? draft?.id === item.id : draft?.sourceName === item.filename) button.setAttribute('aria-current', 'true');
    const title = document.createElement('span'); title.className = 'list-title'; title.textContent = item.metadata.title || '未命名草稿';
    const meta = document.createElement('span'); meta.className = 'list-meta';
    meta.textContent = tab === 'drafts' ? `${item.sourceName ? '已公开的编辑草稿' : '未公开'} · ${new Date(item.savedAt).toLocaleDateString()}` : `${item.metadata.category === 'life' ? '代码之外' : '技术相关'} · ${String(item.metadata.pubDate).slice(0, 10)}`;
    button.append(title, meta);
    button.addEventListener('click', run(() => open(item.id, item.filename)));
    $('items').append(button);
  }
  if (!$('items').children.length) {
    const empty = document.createElement('p'); empty.className = 'empty-list'; empty.textContent = query ? '没有找到对应文章。' : tab === 'drafts' ? '草稿箱还是空的。点击“新建文章”开始写作。' : '暂无公开文章。'; $('items').append(empty);
  }
}
function setFields() {
  for (const key of metadataFields) {
    const field = $(key);
    if (key === 'pinned') field.checked = draft.metadata[key];
    else field.value = key === 'tags' ? draft.metadata.tags.join(', ') : draft.metadata[key] || '';
  }
  $('slug').value = draft.slug;
  $('slug-hint').textContent = draft.sourceName ? '已公开文章的地址保持不变。' : '发布后固定，避免原链接失效。';
}
async function open(id, filename) {
  if (busy) return;
  await flush();
  busy = true; state();
  try {
    const next = filename ? await api('create', filename) : id ? await api('get', id) : await api('create');
    draft = next; version = savedVersion = 0; selected = null;
    setFields(); $('save-state').textContent = '已保存到本机';
    $('welcome').hidden = true; $('writing').hidden = false;
    await mountEditor();
    loading = false; renderImages(); $('word-count').textContent = `${Array.from(draft.markdown).length} 字符`;
    await refresh(); message('');
  } finally { busy = false; loading = false; state(); }
}
function viewValue() { return mode === 'wysiwyg' ? visualMarkdown(draft.markdown) : draft.markdown; }
async function mountEditor() {
  loading = true; editor?.destroy();
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('编辑器加载超时，请重新打开文章。')), 20000);
    editor = new Vditor('editor', {
      cdn, icon: '', lang: 'zh_CN', mode, value: viewValue(), height: '100%', minHeight: 200,
      cache: { enable: false }, placeholder: '开始写作，或把图片拖到这里…',
      toolbar: ['headings', 'bold', 'italic', 'strike', '|', 'list', 'ordered-list', 'check', '|', 'quote', 'line', 'code', 'inline-code', 'link', 'table', '|', 'undo', 'redo'],
      toolbarConfig: { pin: false }, image: { isPreview: false }, link: { isOpen: false },
      customWysiwygToolbar: (_type, popover) => {
        popover.querySelectorAll('button[data-type="up"], button[data-type="down"], button[data-type="remove"]').forEach(button => button.remove());
      },
      preview: { markdown: markdownOptions, math: { engine: 'KaTeX' }, hljs: { enable: true }, actions: [], render: { media: { enable: false } } },
      upload: { accept: 'image/png,image/jpeg,image/webp,image/gif', max: 35 * 1024 * 1024, handler: async files => { try { await insertImages(files); return null; } catch (error) { message(error.message, true); return error.message; } } },
      after: () => { clearTimeout(timeout); resolve(); },
      input: value => { if (loading || busy || !draft || value === lastEditorValue) return; draft.markdown = mode === 'wysiwyg' ? restoreVisualImages(value, draft.markdown) : value; styleImages(); lastEditorValue = editor.getValue(); changed(); },
    });
  });
  loading = false; styleImages(); lastEditorValue = editor.getValue();
}
function styleImages() {
  if (!draft || mode !== 'wysiwyg') return;
  const images = extractImages(draft.markdown), counts = new Map();
  document.querySelectorAll('#editor .vditor-wysiwyg img').forEach(element => {
    const key = normalized(element.getAttribute('src'));
    const index = counts.get(key) || 0; counts.set(key, index + 1);
    const image = images.filter(image => normalized(image.url) === key)[index];
    if (image?.raw.startsWith('<')) {
      element.style.width = image.raw.match(/(?:^|;)\s*width\s*:\s*([\d.]+(?:%|px)|auto)/i)?.[1] || `${image.width}%`;
      element.style.height = 'auto';
    }
  });
}
function changed() {
  version += 1;
  $('save-state').textContent = '正在等待保存…';
  clearTimeout(timer); timer = setTimeout(run(flush), 650);
  $('word-count').textContent = `${Array.from(draft.markdown).length} 字符`;
  renderImages();
}
function readFields() {
  if (!draft || loading) return;
  for (const key of metadataFields) {
    draft.metadata[key] = key === 'pinned' ? $(key).checked : key === 'tags' ? [...new Set($(key).value.split(/[,，]/).map(tag => tag.trim()).filter(Boolean))] : $(key).value;
  }
  if (!draft.sourceName) draft.slug = $('slug').value;
  changed();
}
async function flush() {
  // Capture the editor before its delayed input callback (especially Ctrl+S/close).
  if (editor && draft && !loading && !busy) {
    const current = editor.getValue();
    if (current !== lastEditorValue) {
      draft.markdown = mode === 'wysiwyg' ? restoreVisualImages(current, draft.markdown) : current;
      styleImages(); lastEditorValue = editor.getValue(); changed();
    }
  }
  clearTimeout(timer);
  if (savePromise) await savePromise;
  if (!draft || version === savedVersion) return;
  savePromise = (async () => {
    while (draft && version !== savedVersion) {
      const savingVersion = version;
      const snapshot = structuredClone(draft);
      $('save-state').textContent = '正在保存…';
      const saved = await api('save', snapshot);
      draft.revision = saved.revision;
      draft.savedAt = saved.savedAt;
      savedVersion = savingVersion;
      $('save-state').textContent = '已保存到本机';
      drafts = await api('drafts'); renderList();
    }
  })();
  try { await savePromise; }
  catch (error) { $('save-state').textContent = '保存失败，请重试'; throw error; }
  finally { savePromise = null; }
}
async function insertImages(files) {
  if (!draft || busy) throw new Error('请先打开文章。');
  const id = draft.id;
  // Collect before insertion: a failed image must not leave a half-written text token.
  const urls = [];
  for (const file of files) urls.push(await api('importImage', new Uint8Array(await file.arrayBuffer())));
  if (draft.id !== id || busy) throw new Error('文章已切换，图片没有插入。请重新选择图片。');
  editor.insertValue(urls.map(url => `\n\n![](${url})\n\n`).join(''));
  draft.markdown = mode === 'wysiwyg' ? restoreVisualImages(editor.getValue(), draft.markdown) : editor.getValue(); styleImages(); lastEditorValue = editor.getValue(); changed();
  message(`已插入 ${urls.length} 张图片。选中图片可调整大小或裁剪。`);
}
function normalized(url) { return new URL(url, location.href).pathname; }
function renderImages() {
  const images = extractImages(draft?.markdown || '');
  $('image-count').textContent = images.length;
  $('image-empty').hidden = !!images.length;
  $('image-list').replaceChildren();
  images.forEach((image, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', `选择第 ${index + 1} 张图片${image.alt ? `：${image.alt}` : ''}`);
    const img = document.createElement('img'); img.src = image.url; img.alt = ''; img.loading = 'lazy'; button.append(img);
    if (selected?.start === image.start) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => selectImage(image)); $('image-list').append(button);
  });
  if (selected) {
    const current = images.find(image => image.start === selected.start && image.url === selected.url);
    selected = current || null;
  }
  $('image-tools').hidden = !selected;
  if (selected) {
    $('selected-image').src = selected.url;
    $('image-width').value = $('image-width-number').value = selected.width;
    $('width-output').textContent = `${selected.width}%`;
    $('image-alt').value = selected.alt;
    $('crop').disabled = !normalized(selected.url).startsWith('/images/') || /^https?:/.test(selected.url) || /\.gif(?:\?|$)/i.test(selected.url);
    $('crop').title = $('crop').disabled ? '裁剪支持已导入的本机静态图片；GIF 保留原有动画。' : '';
  }
}
function selectImage(image) { selected = image; renderImages(); $('image-tools').scrollIntoView({ block: 'nearest' }); }
function updateImage(options) {
  if (!selected || busy) return;
  const updated = replaceImage(draft.markdown, selected, imageMarkup(selected, options));
  draft.markdown = updated;
  loading = true; editor.setValue(viewValue()); loading = false; styleImages(); lastEditorValue = editor.getValue();
  selected = extractImages(updated).find(image => image.start === selected.start);
  changed();
}
function confirm(title, text, details, note, label, callback) {
  $('confirm-title').textContent = title; $('confirm-message').textContent = text; $('confirm-note').textContent = note;
  $('confirm-details').replaceChildren();
  for (const [key, value] of Object.entries(details)) {
    const dt = document.createElement('dt'); dt.textContent = key;
    const dd = document.createElement('dd'); dd.textContent = value; $('confirm-details').append(dt, dd);
  }
  $('confirm-action').textContent = label; confirmCallback = callback; $('confirm-dialog').showModal();
}
async function publish(action) {
  await flush();
  if (!draft.metadata.title.trim()) { $('title').focus(); throw new Error('请填写文章标题。'); }
  const withdraw = action === 'withdraw';
  confirm(withdraw ? '撤回公开' : '公开发布', withdraw ? `将「${draft.metadata.title}」从公开博客撤回，并保留在本机草稿箱。` : `将「${draft.metadata.title}」发布到现有博客。`, { 地址: `/posts/${draft.slug}`, 分类: draft.metadata.category === 'tech' ? '技术相关' : '代码之外', 仓库: info.remote, 分支: info.branch }, withdraw ? '撤回后网站不再展示这篇文章；GitHub 仓库的提交历史仍会保留。' : '检查通过后，应用会提交并推送 GitHub。站点的部署由现有托管平台完成。', withdraw ? '确认撤回' : '确认发布', async () => {
    await flush(); busy = true; state();
    try {
      const result = await api('publish', draft.id, draft.revision, action);
      draft = result.draft; setFields();
      message(result.unchanged ? '文章没有新的修改。' : result.pushed ? `${withdraw ? '已撤回' : '已推送 GitHub'}。${result.commit ? `提交：${result.commit.slice(0, 7)}` : ''} 网站将在现有部署流程完成后更新。` : result.message, !result.pushed);
      await refresh();
    } finally { busy = false; state(); }
  });
}
async function preview() {
  await flush(); $('preview-title').textContent = draft.metadata.title;
  $('preview-dialog').showModal();
  await Vditor.preview($('preview-body'), draft.markdown, { cdn, lang: 'zh_CN', markdown: markdownOptions, math: { engine: 'KaTeX' }, hljs: { enable: true }, theme: { current: 'light', path: `${cdn}/dist/css/content-theme` }, render: { media: { enable: false } } });
}
async function openCrop() {
  if (!selected || busy || $('crop').disabled) return;
  $('crop-dialog').showModal(); $('crop-container').replaceChildren();
  $('crop-ratio').value = 'free';
  const image = new Image(); image.src = selected.url; image.alt = selected.alt;
  await image.decode();
  cropper = new Cropper(image, { container: $('crop-container') });
  const selection = cropper.getCropperSelection();
  selection.keyboard = true; selection.initialCoverage = .85;
  selection.addEventListener('change', event => {
    for (const [field, property] of [['x', 'x'], ['y', 'y'], ['w', 'width'], ['h', 'height']]) $(`crop-${field}`).value = Math.round(event.detail[property]);
  });
}

for (const key of [...metadataFields, 'slug']) $(key).addEventListener(key === 'pinned' || key === 'category' ? 'change' : 'input', readFields);
$('mode').addEventListener('change', run(async () => { await flush(); busy = true; state(); try { mode = $('mode').value; await mountEditor(); } finally { busy = false; state(); } }));
$('search').addEventListener('input', renderList);
for (const name of ['drafts', 'posts']) $(`${name}-tab`).addEventListener('click', () => { tab = name; $('drafts-tab').removeAttribute('aria-current'); $('posts-tab').removeAttribute('aria-current'); $(`${name}-tab`).setAttribute('aria-current', 'page'); renderList(); });
for (const id of ['new', 'welcome-new']) $(id).addEventListener('click', run(() => open()));
$('save').addEventListener('click', run(async () => { await flush(); message('草稿已保存到本机。'); }));
$('preview').addEventListener('click', run(preview));
$('publish').addEventListener('click', run(() => publish('publish')));
$('withdraw').addEventListener('click', run(() => publish('withdraw')));
$('confirm-action').addEventListener('click', run(async () => { $('confirm-dialog').close(); const callback = confirmCallback; confirmCallback = null; await callback?.(); }));
$('choose-repo').addEventListener('click', run(async () => { await flush(); const next = await api('choose-repo'); if (!next) return; editor?.destroy(); editor = null; draft = null; info = next; await refresh(); message('已连接博客项目。'); }));
$('retry').addEventListener('click', run(async () => {
  await flush(); busy = true; state();
  try { const result = await api('retryPush'); if (draft?.id === result.draft.id) { draft = result.draft; setFields(); } message(result.pushed ? '已推送 GitHub，等待站点部署更新。' : result.message, !result.pushed); await refresh(); }
  finally { busy = false; state(); }
}));
$('export').addEventListener('click', run(async () => { await flush(); if (await api('export', draft.id)) message('已导出 Markdown。图片仍使用博客中的路径。'); }));
$('delete-draft').addEventListener('click', run(async () => {
  await flush(); confirm('删除本机草稿', `删除「${draft.metadata.title || '未命名草稿'}」的本机编辑副本？`, { 内容: '只删除草稿文件' }, '已公开文章保留在博客中。', '删除草稿', async () => { await api('remove', draft.id); draft = null; editor?.destroy(); editor = null; selected = null; renderImages(); await refresh(); message('已删除本机草稿。'); });
}));
$('insert-image').addEventListener('click', () => $('image-file').click());
$('image-file').addEventListener('change', run(async () => { await insertImages([...$('image-file').files]); $('image-file').value = ''; }));
$('editor').addEventListener('click', event => {
  if (!(event.target instanceof HTMLImageElement) || !draft) return;
  const images = extractImages(draft.markdown);
  const key = normalized(event.target.getAttribute('src'));
  const visibleImages = [...document.querySelectorAll('#editor img')].filter(image => image.getClientRects().length && normalized(image.getAttribute('src')) === key);
  const image = images.filter(image => normalized(image.url) === key)[visibleImages.indexOf(event.target)];
  if (image) selectImage(image);
});
$('clear-image').addEventListener('click', () => { selected = null; renderImages(); });
$('image-width').addEventListener('input', () => { $('image-width-number').value = $('image-width').value; $('width-output').textContent = `${$('image-width').value}%`; });
$('image-width').addEventListener('change', run(() => updateImage({ width: +$('image-width').value })));
$('apply-width').addEventListener('click', run(() => updateImage({ width: +$('image-width-number').value })));
$('apply-alt').addEventListener('click', run(() => updateImage({ alt: $('image-alt').value })));
$('crop').addEventListener('click', run(openCrop));
$('crop-reset').addEventListener('click', () => cropper?.getCropperSelection().$reset());
$('crop-ratio').addEventListener('change', () => { const selection = cropper.getCropperSelection(); selection.aspectRatio = $('crop-ratio').value === 'free' ? NaN : +$('crop-ratio').value; selection.$change(selection.x, selection.y, selection.width, selection.height, selection.aspectRatio); });
$('crop-coordinates-apply').addEventListener('click', () => cropper?.getCropperSelection().$change(+$('crop-x').value, +$('crop-y').value, +$('crop-w').value, +$('crop-h').value));
$('crop-save').addEventListener('click', run(async () => {
  const button = $('crop-save'); button.disabled = true;
  try {
    const selection = cropper.getCropperSelection();
    const matrix = cropper.getCropperImage().$getTransform();
    const scale = Math.hypot(matrix[0], matrix[1]);
    const width = Math.round(selection.width / scale), height = Math.round(selection.height / scale);
    if (!width || !height || width * height > 32_000_000) throw new Error('请选择有效的裁剪区域（不超过 3200 万像素）。');
    const canvas = await selection.$toCanvas({ width, height });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('裁剪图片无法保存，请重试。');
    const url = await api('importImage', new Uint8Array(await blob.arrayBuffer()));
    updateImage({ url }); $('crop-dialog').close(); await flush(); message('已保存裁剪副本，原图保留。');
  } finally { button.disabled = false; }
}));
$('crop-dialog').addEventListener('close', () => { cropper?.destroy(); cropper = null; });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
document.addEventListener('keydown', run(async event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); await flush(); } }));
window.studio.onProgress(message);
window.studio.onClose(run(async () => { if (busy) { message('操作正在进行，请完成后再关闭。'); return; } await flush(); await api('close-ready'); }));
state();
run(async () => {
  let testing = false;
  try {
    info = await api('startup'); testing = !!info?.smoke; await refresh(); state();
    if (testing) {
      // The avatar is bundled with the app, independently of repository image loading.
      await document.querySelector('.brand img').decode();
      await open(null, posts.find(post => post.filename === '2026diansai.md')?.filename || posts[0]?.filename);
      const images = [...document.querySelectorAll('#editor .vditor-wysiwyg img')];
      await Promise.all(images.map(image => image.decode()));
      const symbols = document.querySelectorAll('symbol').length;
      if (!symbols || !editor || !draft) throw new Error('Native editor resources failed to initialize.');
      await api('smoke-ready', { avatar: true, symbols, images: images.length, characters: draft.markdown.length });
    }
  } catch (error) {
    if (testing) await api('smoke-error', error.message);
    throw error;
  }
})();
