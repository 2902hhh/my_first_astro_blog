import { readFile, writeFile, rename, mkdir, readdir, unlink, access, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseDocument } from 'yaml';

const execute = promisify(execFile);
const hash = value => createHash('sha256').update(value).digest('hex');
const today = () => new Date().toLocaleDateString('en-CA');
const exists = file => access(file).then(() => true, () => false);
const editable = ['title', 'description', 'author', 'category', 'tags', 'pinned', 'pubDate', 'updatedDate'];
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/;

export async function atomicWrite(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, value, { flag: 'wx' });
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

export function splitPost(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('文章缺少 Markdown 元数据，无法安全编辑。');
  const document = parseDocument(match[1]);
  if (document.errors.length || !document.contents?.items) throw new Error('文章元数据格式有误。');
  const metadata = document.toJSON();
  return { header: match[0], document, metadata, markdown: source.slice(match[0].length) };
}

export function serializePost(draft) {
  const previous = draft.original ? splitPost(draft.original) : undefined;
  const document = previous?.document || parseDocument('layout: ../../layouts/MarkdownPostLayout.astro\n');
  let changed = !previous;
  for (const key of editable) {
    const value = draft.metadata[key];
    if (previous && JSON.stringify(value ?? null) === JSON.stringify((draft.initialMetadata || previous.metadata)[key] ?? null)) continue;
    if (value === undefined || (key === 'updatedDate' && !value)) document.delete(key);
    else document.set(key, value);
    changed = true;
  }
  // A metadata-only edit must not reserialize the author's Markdown body.
  const header = changed ? `---\n${document.toString()}---\n` : previous.header;
  return header + draft.markdown;
}

export function validateSlug(slug) {
  if (typeof slug !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,99}$/u.test(slug) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(slug)) {
    throw new Error('文章地址须以文字或数字开头，只能包含文字、数字、下划线和短横线，不能使用 Windows 保留名称。');
  }
  return slug;
}

function validateDraft(input) {
  validateSlug(input.slug);
  if (typeof input.markdown !== 'string' || Buffer.byteLength(input.markdown) > 10 * 1024 * 1024) throw new Error('文章内容无效或超过 10 MB。');
  const metadata = input.metadata;
  if (!metadata || !['tech', 'life'].includes(metadata.category)) throw new Error('请选择文章分类。');
  for (const key of ['title', 'description', 'author']) {
    if (typeof metadata[key] !== 'string' || metadata[key].length > (key === 'description' ? 4000 : 500)) throw new Error('文章信息过长或格式有误。');
  }
  if (!Array.isArray(metadata.tags) || metadata.tags.length > 50 || metadata.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 100)) throw new Error('标签格式有误。');
  if (typeof metadata.pinned !== 'boolean') throw new Error('置顶设置无效。');
  for (const key of ['pubDate', 'updatedDate']) {
    const value = metadata[key];
    if (key === 'updatedDate' && !value) continue;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('请填写有效日期。');
  }
}

function imageExtension(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString())) return 'gif';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'webp';
  throw new Error('支持 PNG、JPEG、WebP 和 GIF 图片。');
}

export async function git(repo, args) {
  try {
    const result = await execute('git', args, { cwd: repo, windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    return args.includes('-z') ? result.stdout : result.stdout.trim();
  } catch (error) {
    throw new Error((error.stderr || error.message).trim());
  }
}

export async function buildBlog(repo) {
  const astroRoot = path.join(repo, 'node_modules', 'astro');
  const manifest = await readFile(path.join(astroRoot, 'package.json'), 'utf8').then(JSON.parse, () => null);
  const bin = typeof manifest?.bin === 'string' ? manifest.bin : manifest?.bin?.astro;
  if (!bin) throw new Error('博客缺少 Astro 依赖。请先在博客项目中运行 npm ci。');
  const cli = path.resolve(astroRoot, bin);
  if (!cli.startsWith(astroRoot + path.sep)) throw new Error('Astro 命令路径无效。');
  if (!await exists(cli)) throw new Error('博客缺少依赖。请先在博客项目中运行 npm ci。');
  try {
    await execute(process.execPath, [cli, 'build'], { cwd: repo, windowsHide: true, timeout: 180000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
  } catch (error) {
    throw new Error(`博客构建未通过，文章没有发布。\n${(error.stderr || error.stdout || error.message).slice(-5000)}`);
  }
}

export class StudioStore {
  constructor(repo, data, { build = buildBlog, progress = () => {} } = {}) {
    this.repo = path.resolve(repo);
    this.data = path.join(data, hash(this.repo.toLowerCase()).slice(0, 20));
    this.build = build;
    this.progress = progress;
    this.queue = Promise.resolve();
  }
  serial(operation) {
    const next = this.queue.then(operation);
    this.queue = next.catch(() => {});
    return next;
  }
  async initialize() {
    await access(path.join(this.repo, 'src', 'pages', 'posts'));
    await access(path.join(this.repo, 'astro.config.mjs'));
    if ((await git(this.repo, ['rev-parse', '--show-toplevel'])).toLowerCase().replaceAll('\\', '/') !== this.repo.toLowerCase().replaceAll('\\', '/')) throw new Error('请选择博客 Git 项目的根目录。');
    this.repo = await realpath(this.repo);
    await mkdir(path.join(this.data, 'drafts'), { recursive: true });
    await mkdir(path.join(this.data, 'images'), { recursive: true });
    await this.recover();
    return this.info();
  }
  async info() {
    const pending = await this.journal();
    return { repo: this.repo, draftsPath: path.join(this.data, 'drafts'), remote: await git(this.repo, ['remote', 'get-url', 'origin']), branch: 'main', pending: pending ? { commit: pending.commit, action: pending.action, draftId: pending.draftId } : null };
  }
  draftPath(id) {
    if (!uuid.test(id)) throw new Error('无效的草稿编号。');
    return path.join(this.data, 'drafts', `${id}.json`);
  }
  async get(id) { return JSON.parse(await readFile(this.draftPath(id), 'utf8')); }
  async drafts() {
    const files = (await readdir(path.join(this.data, 'drafts'))).filter(file => file.endsWith('.json'));
    const drafts = await Promise.all(files.map(file => this.get(file.slice(0, -5))));
    return drafts.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }
  async posts() {
    const directory = path.join(this.repo, 'src', 'pages', 'posts');
    const files = (await readdir(directory)).filter(file => file.endsWith('.md'));
    return Promise.all(files.map(async file => {
      const { metadata } = splitPost(await readFile(path.join(directory, file), 'utf8'));
      return { filename: file, metadata };
    }));
  }
  async create(filename) {
    return this.serial(async () => {
      let original, sourceName;
      if (filename) {
        if (!(await this.posts()).some(post => post.filename === filename)) throw new Error('文章不存在。');
        const existing = (await this.drafts()).find(draft => draft.sourceName === filename);
        if (existing) return existing;
        original = await readFile(path.join(this.repo, 'src', 'pages', 'posts', filename), 'utf8');
        sourceName = filename;
      }
      const parsed = original ? splitPost(original) : undefined;
      const id = randomUUID();
      const metadata = { title: '', description: '', author: '丁焕', category: 'tech', tags: [], pinned: false, pubDate: today(), updatedDate: '', ...Object.fromEntries(editable.filter(key => parsed?.metadata[key] !== undefined).map(key => [key, parsed.metadata[key]])) };
      const draft = { id, revision: 0, slug: filename ? filename.slice(0, -3) : `${today()}-${id.slice(0, 8)}`, metadata, initialMetadata: structuredClone(metadata), markdown: parsed?.markdown || '', sourceName, sourceHash: original ? hash(original) : undefined, original, savedAt: new Date().toISOString() };
      await atomicWrite(this.draftPath(id), JSON.stringify(draft, null, 2));
      return draft;
    });
  }
  async save(input) {
    return this.serial(async () => {
      const existing = await this.get(input.id);
      if (input.revision !== existing.revision) throw new Error('草稿版本已变化，请重新打开后继续编辑。');
      validateDraft(input);
      if (existing.sourceName && input.slug !== existing.slug) throw new Error('已有文章的地址不能更改。');
      const draft = { ...existing, slug: input.slug, metadata: Object.fromEntries(editable.map(key => [key, input.metadata[key]])), markdown: input.markdown, revision: existing.revision + 1, savedAt: new Date().toISOString() };
      await atomicWrite(this.draftPath(input.id), JSON.stringify(draft, null, 2));
      return draft;
    });
  }
  async remove(id) {
    return this.serial(async () => {
      if ((await this.journal())?.draftId === id) throw new Error('这篇文章有待推送的发布，请先完成推送。');
      await unlink(this.draftPath(id));
    });
  }
  async importImage(bytes) {
    if (!ArrayBuffer.isView(bytes) && !(bytes instanceof ArrayBuffer)) throw new Error('图片数据无效。');
    const buffer = Buffer.from(bytes instanceof ArrayBuffer ? bytes : bytes.buffer, bytes.byteOffset || 0, bytes.byteLength);
    if (buffer.length < 12 || buffer.length > 35 * 1024 * 1024) throw new Error('单张图片需小于 35 MB。');
    const filename = `${hash(buffer).slice(0, 32)}.${imageExtension(buffer)}`;
    await atomicWrite(path.join(this.data, 'images', filename), buffer);
    return `/images/studio/${filename}`;
  }
  async imagePath(url) {
    const pathname = new URL(url, 'studio://app/').pathname;
    const decoded = decodeURIComponent(pathname);
    if (!decoded.startsWith('/images/') || decoded.includes('\\') || decoded.split('/').includes('..')) throw new Error('图片地址无效。');
    const filename = decoded.slice('/images/studio/'.length);
    if (decoded.startsWith('/images/studio/') && /^[a-f\d]{32}\.(png|jpg|gif|webp)$/.test(filename)) {
      const cached = path.join(this.data, 'images', filename);
      if (await exists(cached)) return cached;
    }
    const root = await realpath(path.join(this.repo, 'public', 'images'));
    const candidate = await realpath(path.join(root, decoded.slice('/images/'.length)));
    if (!candidate.startsWith(root + path.sep)) throw new Error('图片地址超出博客图片目录。');
    return candidate;
  }
  async journal() {
    return readFile(path.join(this.data, 'publication.json'), 'utf8').then(JSON.parse, error => { if (error.code === 'ENOENT') return null; throw error; });
  }
  async writeJournal(value) { await atomicWrite(path.join(this.data, 'publication.json'), JSON.stringify(value, null, 2)); }
  async recover() {
    const job = await this.journal();
    if (!job) return;
    if (job.commit) {
      const draft = await this.get(job.draftId);
      const postChange = job.changes[0];
      if (job.action === 'withdraw' ? !!draft.sourceName : draft.sourceHash !== postChange.afterHash) await this.finishCommit(job);
      return;
    }
    const head = await git(this.repo, ['rev-parse', 'HEAD']);
    if (head !== job.baseHead) {
      const message = await git(this.repo, ['log', '-1', '--format=%B']);
      const parent = await git(this.repo, ['rev-parse', 'HEAD^']);
      if (parent === job.baseHead && message.includes(`[studio:${job.id}]`)) {
        job.commit = head;
        await this.finishCommit(job);
        await this.writeJournal(job);
        return;
      }
      throw new Error('上次发布中断后仓库已变化。发布记录已保留，请先检查仓库。');
    }
    await this.rollback(job);
  }
  async rollback(job) {
    for (const change of job.changes) {
      const file = path.join(this.repo, change.path);
      const current = await readFile(file).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      const currentHash = current ? hash(current) : null;
      const previousHash = change.before === null ? null : hash(Buffer.from(change.before, 'base64'));
      if (currentHash !== change.afterHash && currentHash !== previousHash) throw new Error('发布中断后文件被修改，已保留草稿与恢复记录，请检查仓库。');
      const staged = await git(this.repo, ['diff', '--cached', '--name-only', '--', change.path]);
      if (staged) {
        if (change.after !== null) {
          const stagedHash = await git(this.repo, ['rev-parse', `:${change.path}`]);
          if (currentHash !== change.afterHash) throw new Error('发布暂存区被修改，已保留恢复记录。');
          const expectedHash = await git(this.repo, ['hash-object', `--path=${change.path}`, file]);
          if (stagedHash !== expectedHash) throw new Error('发布暂存区被修改，已保留恢复记录。');
        }
        await git(this.repo, ['restore', '--staged', '--', change.path]);
      }
      if (change.before === null) await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
      else await atomicWrite(file, Buffer.from(change.before, 'base64'));
    }
    await unlink(path.join(this.data, 'publication.json'));
  }
  async finishCommit(job) {
    const draft = await this.get(job.draftId);
    if (job.action === 'withdraw') {
      delete draft.sourceName; delete draft.sourceHash; delete draft.original;
    } else {
      draft.sourceName = `${job.slug}.md`;
      draft.original = await readFile(path.join(this.repo, 'src', 'pages', 'posts', draft.sourceName), 'utf8');
      draft.sourceHash = hash(draft.original);
      draft.initialMetadata = structuredClone(job.metadata);
    }
    draft.revision += 1;
    draft.savedAt = new Date().toISOString();
    await atomicWrite(this.draftPath(draft.id), JSON.stringify(draft, null, 2));
  }
  async retryPush() { return this.serial(() => this.pushPending()); }
  async pushPending() {
    const job = await this.journal();
    if (!job?.commit) throw new Error('没有待推送的发布。');
    if (await git(this.repo, ['rev-parse', 'HEAD']) !== job.commit) throw new Error('仓库提交已变化，不能自动重试。请检查仓库。');
    this.progress('正在推送 GitHub…');
    try {
      await git(this.repo, ['push', 'origin', 'HEAD:refs/heads/main']);
    } catch (error) {
      return { pushed: false, commit: job.commit, message: `已提交，尚未推送。草稿和发布记录已保留，可重试。\n${error.message}`, draft: await this.get(job.draftId) };
    }
    await unlink(path.join(this.data, 'publication.json'));
    return { pushed: true, commit: job.commit, action: job.action, draft: await this.get(job.draftId) };
  }
  async publish(id, revision, action = 'publish') {
    return this.serial(async () => {
      if (!['publish', 'withdraw'].includes(action)) throw new Error('无效的发布操作。');
      if (await this.journal()) throw new Error('请先完成上一次待推送的发布。');
      const draft = await this.get(id);
      if (draft.revision !== revision) throw new Error('草稿版本已变化，请重新打开。');
      validateDraft(draft);
      if (!draft.metadata.title.trim()) throw new Error('请先填写文章标题。');
      if (action === 'withdraw' && !draft.sourceName) throw new Error('这篇草稿尚未公开发布。');
      if (await git(this.repo, ['status', '--porcelain'])) throw new Error('博客项目还有未提交的更改。请先处理这些更改，再发布文章。');
      this.progress('正在检查 GitHub 上的版本…');
      await git(this.repo, ['fetch', 'origin', 'main']);
      const baseHead = await git(this.repo, ['rev-parse', 'HEAD']);
      if (baseHead !== await git(this.repo, ['rev-parse', 'FETCH_HEAD'])) throw new Error('本地博客与 GitHub main 不一致，请先同步仓库再发布。');
      const postPath = `src/pages/posts/${draft.slug}.md`;
      const postFile = path.join(this.repo, postPath);
      const original = await readFile(postFile).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (draft.sourceName) {
        if (!original || hash(original) !== draft.sourceHash) throw new Error('文章已在应用之外修改，请重新导入文章，避免覆盖。');
      } else {
        const collision = (await this.posts()).some(post => post.filename.toLowerCase() === `${draft.slug}.md`.toLowerCase());
        if (collision) throw new Error('文章地址已存在，请为新文章换一个地址。');
      }
      const content = action === 'withdraw' ? null : Buffer.from(serializePost(draft));
      const changes = [{ path: postPath, before: original?.toString('base64') ?? null, after: content?.toString('base64') ?? null, afterHash: content ? hash(content) : null }];
      if (content) {
        const names = new Set([...draft.markdown.matchAll(/\/images\/studio\/([a-f\d]{32}\.(?:png|jpg|gif|webp))/g)].map(match => match[1]));
        for (const name of names) {
          const target = `public/images/studio/${name}`;
          if (await exists(path.join(this.repo, target))) continue;
          const bytes = await readFile(path.join(this.data, 'images', name));
          changes.push({ path: target, before: null, after: bytes.toString('base64'), afterHash: hash(bytes) });
        }
      }
      const job = { id: randomUUID(), draftId: id, slug: draft.slug, metadata: structuredClone(draft.metadata), action, baseHead, changes };
      await this.writeJournal(job);
      try {
        for (const change of changes) {
          if (change.after === null) await unlink(path.join(this.repo, change.path));
          else await atomicWrite(path.join(this.repo, change.path), Buffer.from(change.after, 'base64'));
        }
        this.progress('正在构建博客，检查文章和图片…');
        await this.build(this.repo);
        const otherChanges = (await git(this.repo, ['status', '--porcelain', '-z', '--untracked-files=all'])).split('\0').filter(Boolean).map(line => line.slice(3));
        if (otherChanges.some(file => !changes.some(change => change.path === file))) throw new Error('发布检查期间项目出现其他修改，已停止发布。');
        await git(this.repo, ['add', '--', ...changes.map(change => change.path)]);
        if (!await git(this.repo, ['diff', '--cached', '--name-only'])) {
          await unlink(path.join(this.data, 'publication.json'));
          return { pushed: true, unchanged: true, draft };
        }
        this.progress('正在提交文章…');
        await git(this.repo, ['commit', '--only', '-m', `${action === 'withdraw' ? 'withdraw' : 'publish'}: ${draft.metadata.title} [studio:${job.id}]`, '--', ...changes.map(change => change.path)]);
        job.commit = await git(this.repo, ['rev-parse', 'HEAD']);
        await this.writeJournal(job);
        await this.finishCommit(job);
      } catch (error) {
        if (!job.commit) await this.recover();
        throw error;
      }
      return this.pushPending();
    });
  }
}
