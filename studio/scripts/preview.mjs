// Development-only UI validation against a temporary copy and a local bare remote.
// This script never connects to the blog's GitHub remote.
import { createServer } from 'node:http';
import { mkdir, cp, writeFile, readFile, realpath, symlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { StudioStore, git } from '../src/store.mjs';
const root = path.resolve(import.meta.dirname, '..');
const blog = path.resolve(root, '..');
const data = path.join(root, '.test-data', randomUUID());
const repo = path.join(data, 'blog'), remote = path.join(data, 'remote.git');
await mkdir(repo, { recursive: true });
for (const name of ['src', 'public', 'astro.config.mjs', 'package.json', 'package-lock.json', '.gitignore']) await cp(path.join(blog, name), path.join(repo, name), { recursive: true });
await symlink(path.join(blog, 'node_modules'), path.join(repo, 'node_modules'), 'junction');
await git(repo, ['init', '-b', 'main']);
await git(repo, ['config', 'user.name', 'Studio Preview']);
await git(repo, ['config', 'user.email', 'preview@example.invalid']);
await git(repo, ['add', '.']); await git(repo, ['commit', '-m', 'isolated preview']);
await git(data, ['init', '--bare', remote]);
await git(repo, ['remote', 'add', 'origin', remote]); await git(repo, ['push', '-u', 'origin', 'main']);
const store = new StudioStore(repo, path.join(data, 'library'));
await store.initialize();
const token = randomUUID(), port = 4335, origin = `http://127.0.0.1:${port}`;
const allowed = ['info', 'drafts', 'posts', 'create', 'get', 'save', 'remove', 'publish', 'retryPush', 'importImage'];
const ui = await realpath(path.join(root, 'build', 'ui'));
const bridge = `window.studio={call:async(method,...args)=>{if(method==='importImage')args=[Array.from(args[0])];return(await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Preview':'${token}'},body:JSON.stringify({method,args})})).json()},onProgress:()=>{},onClose:()=>{}};`;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff' };
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, origin);
    if (request.method === 'POST' && url.pathname === '/api') {
      if (request.headers['x-studio-preview'] !== token || request.headers.origin !== origin) { response.writeHead(403).end(); return; }
      let body = '', length = 0;
      for await (const chunk of request) { length += chunk.length; if (length > 50 * 1024 * 1024) throw new Error('request too large'); body += chunk; }
      const { method, args } = JSON.parse(body);
      try {
        let value;
        if (method === 'startup' || method === 'choose-repo') value = await store.info();
        else if (method === 'export') value = false;
        else if (allowed.includes(method)) value = await store[method](...(method === 'importImage' ? [new Uint8Array(args[0])] : args));
        else throw new Error('unknown operation');
        response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, value }));
      } catch (error) { response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: error.message })); }
      return;
    }
    if (request.method !== 'GET') { response.writeHead(405).end(); return; }
    if (url.pathname === '/preview-bridge.js') { response.writeHead(200, { 'Content-Type': mime['.js'] }).end(bridge); return; }
    let file;
    if (url.pathname.startsWith('/images/')) file = await store.imagePath(url.href);
    else {
      file = await realpath(path.join(ui, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
      if (!file.startsWith(ui + path.sep)) { response.writeHead(403).end(); return; }
    }
    let content = await readFile(file);
    if (file.endsWith('index.html')) content = Buffer.from(content.toString().replace('<script defer src="renderer.js">', '<script src="preview-bridge.js"></script><script defer src="renderer.js">'));
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(content);
  } catch (error) { response.writeHead(404).end(error.message); }
}).listen(port, '127.0.0.1', () => console.log(`隔离验证预览：${origin}\n测试仓库：${repo}`));
