import { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, Menu } from 'electron';
import { readFile, realpath } from 'node:fs/promises';
import { existsSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { StudioStore, atomicWrite } from './store.mjs';

protocol.registerSchemesAsPrivileged([{ scheme: 'studio', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
app.setName('本地写作');
// Keep existing drafts and repository settings when upgrading from the original name.
const legacyUserData = path.join(app.getPath('appData'), '丁焕写作');
if (existsSync(legacyUserData)) app.setPath('userData', legacyUserData);
const smoke = app.commandLine.hasSwitch('smoke-test');
if (smoke) app.setPath('userData', mkdtempSync(path.join(app.getPath('temp'), 'LocalWriting-smoke-')));
let window, store, allowClose = false;
const ui = path.join(import.meta.dirname, 'ui');
let settingsFile;
const trusted = event => event.senderFrame?.url === 'studio://app/index.html';

async function connect(repo) {
  const next = new StudioStore(repo, path.join(app.getPath('userData'), 'library'), { progress: message => window?.webContents.send('progress', message) });
  const info = await next.initialize();
  store = next;
  await atomicWrite(settingsFile, JSON.stringify({ repo }));
  return info;
}

function handle(name, callback) {
  ipcMain.handle(name, async (event, ...args) => {
    if (!trusted(event)) throw new Error('请求来源无效。');
    try { return { ok: true, value: await callback(...args) }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
}

app.whenReady().then(async () => {
  settingsFile = path.join(app.getPath('userData'), 'settings.json');
  await protocol.handle('studio', async request => {
    try {
      const url = new URL(request.url);
      if (url.host !== 'app') return new Response('', { status: 403 });
      if (url.pathname.startsWith('/images/')) {
        if (!store) return new Response('', { status: 404 });
        return net.fetch(pathToFileURL(await store.imagePath(url.href)).href);
      }
      const root = await realpath(ui);
      const file = await realpath(path.join(root, decodeURIComponent(url.pathname)));
      if (!file.startsWith(root + path.sep)) return new Response('', { status: 403 });
      return net.fetch(pathToFileURL(file).href);
    } catch { return new Response('', { status: 404 }); }
  });
  handle('startup', async () => {
    if (smoke) return { ...await connect(app.commandLine.getSwitchValue('smoke-repo')), smoke: true };
    if (store) return store.info();
    const settings = await readFile(settingsFile, 'utf8').then(JSON.parse, () => null);
    if (settings?.repo) return connect(settings.repo);
    // The development app can attach to its parent blog; packaged apps use the picker.
    if (!app.isPackaged) return connect(path.resolve(app.getAppPath(), '..'));
    return null;
  });
  handle('choose-repo', async () => {
    const result = await dialog.showOpenDialog(window, { title: '选择你的博客项目根目录', properties: ['openDirectory'] });
    if (result.canceled) return null;
    return connect(result.filePaths[0]);
  });
  for (const method of ['info', 'drafts', 'posts', 'create', 'get', 'save', 'remove', 'publish', 'retryPush', 'importImage']) {
    handle(method, (...args) => {
      if (!store) throw new Error('请先选择博客项目。');
      return store[method](...args);
    });
  }
  handle('export', async id => {
    if (!store) throw new Error('请先选择博客项目。');
    const draft = await store.get(id);
    const { serializePost } = await import('./store.mjs');
    const result = await dialog.showSaveDialog(window, { title: '导出 Markdown', defaultPath: `${draft.slug}.md`, filters: [{ name: 'Markdown', extensions: ['md'] }] });
    if (result.canceled) return false;
    await atomicWrite(result.filePath, serializePost(draft));
    return true;
  });
  handle('close-ready', async () => { allowClose = true; window.close(); });
  if (smoke) {
    handle('smoke-ready', result => { console.log(JSON.stringify({ smoke: 'passed', ...result })); app.exit(0); });
    handle('smoke-error', error => { console.error(error); app.exit(1); });
    setTimeout(() => { console.error('Native application smoke test timed out.'); app.exit(1); }, 30000);
  }
  window = new BrowserWindow({ width: 1440, height: 940, minWidth: 960, minHeight: 660, title: '本地写作', backgroundColor: '#fafbff', show: false, webPreferences: { preload: path.join(import.meta.dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] }, { label: '视图', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] }]));
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== 'studio://app/index.html') event.preventDefault();
  });
  window.on('close', event => {
    if (allowClose) return;
    event.preventDefault();
    if (window.webContents.isCrashed()) {
      const quit = dialog.showMessageBoxSync(window, { type: 'warning', message: '编辑器已停止响应。之前自动保存的草稿仍在本机，关闭应用？', buttons: ['取消', '关闭'], defaultId: 0, cancelId: 0 });
      if (quit === 1) { allowClose = true; window.close(); }
    } else window.webContents.send('prepare-close');
  });
  if (!smoke) window.once('ready-to-show', () => window.show());
  await window.loadURL('studio://app/index.html');
});
app.on('window-all-closed', () => app.quit());
