import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = path => readFile(new URL(`../dist/${path}/index.html`, import.meta.url), 'utf8');
const cards = html => [...html.matchAll(/href="([^"]+)" class="post-card-link"/g)].map(match => decodeURI(match[1]));

test('home retains both categories and contact links', async () => {
  const html = await page('.');
  for (const href of ['/tech', '/life', 'https://github.com/2902hhh', 'mailto:2902351648@qq.com']) assert.ok(html.includes(`href="${href}"`), href);
  assert.ok(html.includes('/images/head.jpg'));
});

test('home exposes the three latest posts with descriptions and correct heading levels', async () => {
  const html = await page('.');
  assert.deepEqual(cards(html), ['/posts/2026diansai', '/posts/human_vs_dogs', '/posts/亿万人']);
  assert.equal([...html.matchAll(/<h3 class="post-card-title"/g)].length, 3);
  assert.equal([...html.matchAll(/class="post-card-desc"/g)].length, 3);
  assert.ok(!html.includes('class="glass-pill pinned"'));
});

test('all category listings keep existing content and order', async () => {
  assert.deepEqual(cards(await page('tech')), ['/posts/test', '/posts/2026diansai', '/posts/3DV_L_1']);
  assert.deepEqual(cards(await page('life')), ['/posts/human_vs_dogs', '/posts/亿万人', '/posts/about_me']);
});

test('listing metadata includes summaries and a readable title while preserving the course URL', async () => {
  const html = await page('tech');
  assert.ok(html.includes('三维视觉课程笔记：PCA 与 Kernel PCA'));
  assert.ok(html.includes('href="/posts/3DV_L_1"'));
  assert.equal([...html.matchAll(/class="post-card-desc"/g)].length, 3);
  assert.ok(!html.includes('class="post-card-author"'));
  assert.equal([...((await page('life')).matchAll(/class="post-card-desc"/g))].length, 3);
});

test('long articles have working section targets, short articles omit the table of contents', async () => {
  for (const path of ['posts/2026diansai', 'posts/3dv_l_1']) {
    const html = await page(path);
    const toc = html.match(/<aside class="article-toc"[\s\S]*?<\/aside>/)?.[0];
    assert.ok(toc, path);
    const links = [...toc.matchAll(/href="#([^"]+)"/g)];
    assert.ok(links.length >= 3, path);
    for (const [, slug] of links) assert.ok(html.includes(`id="${slug}"`), slug);
  }
  assert.ok(!(await page('posts/human_vs_dogs')).includes('<aside class="article-toc"'));
});

test('article navigation links to chronological siblings within its category', async () => {
  const links = html => [...(html.match(/<nav class="post-navigation"[\s\S]*?<\/nav>/)?.[0] || '').matchAll(/href="([^"]+)"/g)].map(match => decodeURI(match[1]));
  assert.deepEqual(links(await page('posts/3dv_l_1')), ['/posts/test', '/posts/2026diansai']);
  assert.deepEqual(links(await page('posts/2026diansai')), ['/posts/3DV_L_1']);
  const life = links(await page('posts/about_me'));
  assert.equal(life.length, 1);
  assert.ok(life.every(url => !url.includes('2026diansai') && !url.includes('3DV_L_1')));
});

test('tag pages and article metadata, covers, images and math still render', async () => {
  for (const tag of ['astro', 'blogging', 'learning in public', 'PCA', 'kernel PCA', '电赛']) {
    const html = await page(`tags/${tag}`);
    assert.equal(cards(html).length, 1, tag);
    assert.ok(html.includes('共 1 篇文章'));
  }
  const math = await page('posts/3dv_l_1');
  assert.ok(math.includes('class="katex'));
  const first = await page('posts/test');
  assert.ok(first.includes('2026-06-18'));
  assert.ok(first.includes('https://docs.astro.build/assets/rose.webp'));
  assert.ok(first.includes('/tags/astro'));
  assert.ok(first.includes('我做博客出于两个目的'));
  assert.ok((await page('posts/2026diansai')).includes('yolo26_dataset_check.jpg'));
});
