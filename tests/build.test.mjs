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

test('all category listings keep existing content and order', async () => {
  assert.deepEqual(cards(await page('tech')), ['/posts/test', '/posts/2026diansai', '/posts/3DV_L_1']);
  assert.deepEqual(cards(await page('life')), ['/posts/human_vs_dogs', '/posts/亿万人', '/posts/about_me']);
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
