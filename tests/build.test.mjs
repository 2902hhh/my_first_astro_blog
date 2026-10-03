import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import config from '../astro.config.mjs';

const page = path => readFile(new URL(`../dist/${path}/index.html`, import.meta.url), 'utf8');
const cards = html => [...html.matchAll(/href="([^"]+)" class="post-card-link"/g)].map(match => decodeURI(match[1]));

test('home retains both categories and contact links with the requested labels removed', async () => {
  const html = await page('.');
  for (const href of ['/tech', '/life', 'https://github.com/2902hhh', 'mailto:2902351648@qq.com']) assert.ok(html.includes(`href="${href}"`), href);
  assert.ok(html.includes('/images/head.jpg'));
  assert.ok(html.includes('class="site-brand" href="/">丁焕</a>'));
  assert.ok(!html.includes('学习与生活的记录'));
});

test('home exposes the three latest posts with excerpts taken from their bodies', async () => {
  const html = await page('.');
  assert.deepEqual(cards(html), ['/posts/2026diansai', '/posts/human_vs_dogs', '/posts/亿万人']);
  assert.equal([...html.matchAll(/<h3 class="post-card-title"/g)].length, 3);
  assert.equal([...html.matchAll(/class="post-card-desc"/g)].length, 3);
  assert.ok(html.includes('这次需要用摄像头识别一颗小钢球'));
  assert.ok(html.includes('前段时间在网上看到这样一个问题'));
  assert.ok(html.includes('亿万人必须爱彼此...... 亿万人不必再受苦...... 亿万人...幸福...'));
  assert.ok(!html.includes('class="glass-pill pinned"'));
});

test('all category listings keep existing content and order', async () => {
  assert.deepEqual(cards(await page('tech')), ['/posts/test', '/posts/2026diansai']);
  assert.deepEqual(cards(await page('life')), ['/posts/human_vs_dogs', '/posts/亿万人', '/posts/about_me']);
});

test('listings preserve written summaries and fill missing ones with author wording', async () => {
  const html = await page('tech');
  assert.ok(html.includes('2026电赛H题视觉记录'));
  assert.ok(html.includes('这次需要用摄像头识别一颗小钢球'));
  assert.ok(html.includes('This is the first post of my new Astro blog.'));
  assert.ok(html.includes('href="/posts/2026diansai"'));
  assert.equal([...html.matchAll(/class="post-card-desc"/g)].length, 2);
  assert.ok(!html.includes('class="post-card-author"'));
  const life = await page('life');
  assert.equal([...life.matchAll(/class="post-card-desc"/g)].length, 3);
  assert.ok(life.includes('首页的这张图片'));
  assert.ok(!life.includes('几句话，一张图。'));
});

test('long articles have working section targets, short articles omit the table of contents', async () => {
  for (const path of ['posts/2026diansai', 'posts/test']) {
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
  assert.deepEqual(links(await page('posts/test')), ['/posts/2026diansai']);
  assert.deepEqual(links(await page('posts/2026diansai')), ['/posts/test']);
  const life = links(await page('posts/about_me'));
  assert.equal(life.length, 1);
  assert.ok(life.every(url => !url.includes('2026diansai') && !url.includes('3DV_L_1')));
});

test('tag pages and article metadata, covers, images and math still render', async () => {
  for (const tag of ['astro', 'blogging', 'learning in public', '电赛']) {
    const html = await page(`tags/${tag}`);
    assert.equal(cards(html).length, 1, tag);
    assert.ok(html.includes('共 1 篇文章'));
  }
  // Verify configured math rendering independently of which articles are public.
  const renderer = await config.markdown.processor.createRenderer({});
  const math = await renderer.render('$$x_i \\in \\mathbb{R}^3$$');
  assert.ok(math.code.includes('class="katex'));
  const first = await page('posts/test');
  assert.ok(first.includes('2026-06-18'));
  assert.ok(first.includes('https://docs.astro.build/assets/rose.webp'));
  assert.ok(first.includes('/tags/astro'));
  assert.ok(first.includes('我做博客出于两个目的'));
  assert.ok((await page('posts/2026diansai')).includes('yolo26_dataset_check.jpg'));
});
