import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { StudioStore, git, serializePost, validateSlug, buildBlog } from '../src/store.mjs';
import { extractImages, replaceImage, imageMarkup, visualMarkdown, restoreVisualImages } from '../src/ui/images.js';

const source = '---\r\nlayout: ../../layouts/MarkdownPostLayout.astro\r\ntitle: "作者标题" # 保留注释\r\npubDate: 2026-07-22\r\ncategory: tech\r\ncustom: preserved\r\nimage:\r\n  url: /images/existing.png\r\n  alt: 作者图片说明\r\n---\r\n\r\n作者自己的正文。\r\n\r\n$$x_i \\in \\mathbb{R}^3$$\r\n\r\n```js\r\nconst value = 1;\r\n```\r\n';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY4kAAAAASUVORK5CYII=', 'base64');
async function fixture(build = async () => {}) {
  const base = await mkdtemp(path.join(os.tmpdir(), 'blog-studio-test-'));
  const repo = path.join(base, 'blog'), remote = path.join(base, 'remote.git'), data = path.join(base, 'data');
  await mkdir(path.join(repo, 'src/pages/posts'), { recursive: true });
  await mkdir(path.join(repo, 'public/images'), { recursive: true });
  await writeFile(path.join(repo, 'astro.config.mjs'), 'export default {};\n');
  await writeFile(path.join(repo, '.gitignore'), 'dist/\nnode_modules/\n');
  await writeFile(path.join(repo, 'src/pages/posts/old.md'), source);
  await git(repo, ['init', '-b', 'main']);
  await git(repo, ['config', 'user.name', 'Studio Test']);
  await git(repo, ['config', 'user.email', 'studio-test@example.invalid']);
  await git(repo, ['config', 'core.autocrlf', 'false']);
  await git(repo, ['add', '.']); await git(repo, ['commit', '-m', 'fixture']);
  await git(base, ['init', '--bare', remote]);
  await git(repo, ['remote', 'add', 'origin', remote]); await git(repo, ['push', '-u', 'origin', 'main']);
  const store = new StudioStore(repo, data, { build }); await store.initialize();
  return { repo, remote, data, store, base };
}
async function writeDraft(store, metadata = {}, markdown = '') {
  const draft = await store.create();
  return store.save({ ...draft, metadata: { ...draft.metadata, title: '作者提供的测试标题', ...metadata }, markdown });
}

test('drafts survive reopening and never enter the blog or Git', async () => {
  const { store, repo, data } = await fixture();
  const draft = await writeDraft(store, {}, '作者的草稿内容。');
  const reopened = new StudioStore(repo, data); await reopened.initialize();
  assert.equal((await reopened.get(draft.id)).markdown, '作者的草稿内容。');
  assert.deepEqual(await readdir(path.join(repo, 'src/pages/posts')), ['old.md']);
  assert.equal(await git(repo, ['status', '--porcelain']), '');
  await assert.rejects(store.save({ ...draft, revision: 0 }), /版本/);
});
test('opening and saving an existing article preserves every original byte', async () => {
  const { store } = await fixture();
  const draft = await store.create('old.md');
  assert.equal(serializePost(draft), source);
  const saved = await store.save(draft);
  assert.equal(serializePost(saved), source);
  await assert.rejects(store.save({ ...saved, slug: 'renamed' }), /地址不能更改/);
  const changed = await store.save({ ...saved, metadata: { ...saved.metadata, description: '作者填写的摘要' } });
  const result = serializePost(changed);
  assert.ok(result.includes('custom: preserved')); assert.ok(result.includes('# 保留注释'));
  assert.equal(result.slice(result.indexOf('---\n', 4) + 4), draft.markdown);
});
test('images are content addressed and remain private until used in a publication', async () => {
  const { store, repo } = await fixture();
  const url = await store.importImage(new Uint8Array(png));
  assert.equal(await store.importImage(new Uint8Array(png)), url);
  assert.deepEqual(await readFile(await store.imagePath(url)), png);
  assert.equal(await git(repo, ['status', '--porcelain']), '');
  await assert.rejects(store.importImage(new Uint8Array(Buffer.from('<svg>invalid</svg>'))), /支持/);
  await assert.rejects(store.imagePath('/images/%2e%2e/%2e%2e/.git/config'));
});
test('publish builds first, commits only the article and referenced images, then pushes', async () => {
  let built = false;
  const { store, repo, remote } = await fixture(async root => {
    const article = (await readdir(path.join(root, 'src/pages/posts'))).find(file => file !== 'old.md');
    assert.ok((await readFile(path.join(root, 'src/pages/posts', article), 'utf8')).includes('作者的原文'));
    built = true;
  });
  const used = await store.importImage(new Uint8Array(png));
  const unused = await store.importImage(new Uint8Array(Buffer.concat([png, Buffer.from('unused')])));
  const draft = await writeDraft(store, {}, `作者的原文。\n\n![](${used})\n`);
  const result = await store.publish(draft.id, draft.revision);
  assert.ok(built); assert.ok(result.pushed);
  assert.equal(await git(remote, ['rev-parse', 'main']), result.commit);
  const files = await git(repo, ['show', '--format=', '--name-only', 'HEAD']);
  assert.ok(files.includes(`src/pages/posts/${draft.slug}.md`)); assert.ok(files.includes(used.replace('/images/', 'public/images/')));
  assert.ok(!files.includes(unused)); assert.ok(!files.includes('drafts'));
  assert.equal(await git(repo, ['status', '--porcelain']), '');
});
test('failed build restores original bytes and leaves draft and Git intact', async () => {
  const { store, repo } = await fixture(async () => { throw new Error('build failed'); });
  const head = await git(repo, ['rev-parse', 'HEAD']);
  const draft = await store.create('old.md');
  const changed = await store.save({ ...draft, markdown: draft.markdown + '\n作者添加的内容。' });
  await assert.rejects(store.publish(changed.id, changed.revision), /build failed/);
  assert.equal(await readFile(path.join(repo, 'src/pages/posts/old.md'), 'utf8'), source);
  assert.equal(await git(repo, ['rev-parse', 'HEAD']), head);
  assert.equal(await git(repo, ['status', '--porcelain']), '');
  assert.ok((await store.get(changed.id)).markdown.includes('作者添加'));
  assert.equal(await store.journal(), null);
});
test('a failed push can be retried after restarting without duplicate commits', async () => {
  const { store, repo, remote, data } = await fixture();
  const hook = path.join(remote, 'hooks/pre-receive');
  await writeFile(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const draft = await writeDraft(store, {}, '作者内容');
  const result = await store.publish(draft.id, draft.revision);
  assert.equal(result.pushed, false); assert.ok((await store.info()).pending);
  await writeFile(hook, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const restarted = new StudioStore(repo, data); await restarted.initialize();
  const retried = await restarted.retryPush(); assert.ok(retried.pushed); assert.equal(retried.commit, result.commit);
  assert.equal(await git(remote, ['rev-parse', 'main']), result.commit);
  assert.equal((await restarted.info()).pending, null);
});
test('withdraw removes the public article and retains its local draft and address', async () => {
  const { store, repo, remote } = await fixture();
  const draft = await store.create('old.md');
  const result = await store.publish(draft.id, draft.revision, 'withdraw');
  assert.ok(result.pushed); assert.equal(result.draft.sourceName, undefined); assert.equal(result.draft.slug, 'old');
  assert.equal(result.draft.markdown, draft.markdown);
  assert.equal(await git(remote, ['rev-parse', 'main']), result.commit);
  assert.deepEqual(await readdir(path.join(repo, 'src/pages/posts')), []);
});
test('publication rejects external changes, colliding slugs and unrelated Git changes', async () => {
  const { store, repo } = await fixture();
  const draft = await store.create('old.md');
  await writeFile(path.join(repo, 'unrelated.txt'), 'untouched');
  await assert.rejects(store.publish(draft.id, draft.revision), /未提交/);
  const collision = await writeDraft(store); collision.slug = 'OLD';
  const saved = await store.save(collision);
  assert.equal(await readFile(path.join(repo, 'unrelated.txt'), 'utf8'), 'untouched');
  await unlink(path.join(repo, 'unrelated.txt'));
  await assert.rejects(store.publish(saved.id, saved.revision), /地址已存在/);
  await writeFile(path.join(repo, 'src/pages/posts/old.md'), source + '\n作者在外部修订。');
  await git(repo, ['add', '.']); await git(repo, ['commit', '-m', 'external revision']); await git(repo, ['push', 'origin', 'main']);
  await assert.rejects(store.publish(draft.id, draft.revision), /应用之外修改/);
  for (const bad of ['../old', 'CON', 'a.md', '--flag', 'x/y']) assert.throws(() => validateSlug(bad));
});
test('changes staged by another process during a build remain uncommitted and intact', async () => {
  const { store, repo } = await fixture(async root => {
    await writeFile(path.join(root, 'unrelated.txt'), 'other process');
    await git(root, ['add', '--', 'unrelated.txt']);
  });
  const head = await git(repo, ['rev-parse', 'HEAD']);
  const draft = await writeDraft(store);
  await assert.rejects(store.publish(draft.id, draft.revision), /其他修改/);
  assert.equal(await git(repo, ['rev-parse', 'HEAD']), head);
  assert.equal(await readFile(path.join(repo, 'unrelated.txt'), 'utf8'), 'other process');
  assert.equal(await git(repo, ['diff', '--cached', '--name-only']), 'unrelated.txt');
});
test('interrupted file writing is rolled back on restart', async () => {
  const { store, repo, data } = await fixture();
  const draft = await store.create('old.md');
  const bytes = Buffer.from('interrupted');
  await store.writeJournal({ draftId: draft.id, baseHead: await git(repo, ['rev-parse', 'HEAD']), changes: [{ path: 'src/pages/posts/old.md', before: Buffer.from(source).toString('base64'), after: bytes.toString('base64'), afterHash: createHash('sha256').update(bytes).digest('hex') }] });
  await writeFile(path.join(repo, 'src/pages/posts/old.md'), bytes);
  const restarted = new StudioStore(repo, data); await restarted.initialize();
  assert.equal(await readFile(path.join(repo, 'src/pages/posts/old.md'), 'utf8'), source);
  assert.equal(await git(repo, ['status', '--porcelain']), '');
});
test('image changes affect only the selected occurrence and skip code samples', () => {
  const markdown = '作者原文。\n```md\n![](../images/a.png)\n```\n\n![说明](../images/a.png)\n\n![另一个说明](../images/a.png)\n';
  const images = extractImages(markdown); assert.equal(images.length, 2);
  const result = replaceImage(markdown, images[1], imageMarkup(images[1], { width: 63 }));
  assert.ok(result.startsWith(markdown.slice(0, images[1].start))); assert.ok(result.includes('width: 63%')); assert.ok(result.includes('alt="另一个说明"'));
  const styled = extractImages('<img src="/images/a.png" alt="作者说明" title="原有标题" style="display: block; width: 80%;">')[0];
  const resized = imageMarkup(styled, { width: 40 });
  assert.ok(resized.includes('title="原有标题"')); assert.ok(resized.includes('display: block')); assert.ok(resized.includes('width: 40%'));
});
test('visual editing restores original image HTML, widths, titles and repeated-image order', () => {
  const original = '作者原文。\n\n<img src="../../images/a.png" alt="作者说明" title="保留标题" style="display: block; width: 63%;">\n\n<img src="/images/a.png" alt="另一个说明" style="width: 40%;">\n';
  const visual = visualMarkdown(original);
  assert.ok(!visual.includes('<img'));
  assert.equal(restoreVisualImages(visual, original), original);
  const edited = visual.replace('作者原文。', '作者修改的原文。');
  assert.equal(restoreVisualImages(edited, original), original.replace('作者原文。', '作者修改的原文。'));
});
test('build checks use the Astro CLI declared in its package, including Astro 6 paths', async () => {
  const { repo } = await fixture();
  const directory = path.join(repo, 'node_modules/astro/bin');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, '../package.json'), JSON.stringify({ bin: { astro: './bin/astro.mjs' }, type: 'module' }));
  await writeFile(path.join(directory, 'astro.mjs'), 'import { mkdirSync, writeFileSync } from "node:fs"; mkdirSync("dist", { recursive: true }); writeFileSync("dist/check.txt", process.argv[2]);');
  await buildBlog(repo);
  assert.equal(await readFile(path.join(repo, 'dist/check.txt'), 'utf8'), 'build');
  assert.equal(await git(repo, ['status', '--porcelain']), '');
});
