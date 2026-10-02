import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCategoryPaths, postsForTag } from '../src/lib/posts.ts';
const categoryPaths = (category, posts) => getCategoryPaths(posts, category);

const post = (title, date, category, pinned = false) => ({ url: `/posts/${title}`, frontmatter: { title, pubDate: date, category, pinned } });

test('category order keeps pinned posts ahead of newer posts and defaults missing category to tech', async () => {
  const posts = [post('new', '2026-08-04', 'tech'), post('pinned', '2026-06-18', 'tech', true), post('default', '2026-07-22'), post('life', '2026-07-25', 'life')];
  assert.deepEqual((await categoryPaths('tech', posts))[0].props.posts.map(p => p.frontmatter.title), ['pinned', 'new', 'default']);
  assert.deepEqual((await categoryPaths('life', posts))[0].props.posts.map(p => p.frontmatter.title), ['life']);
});

test('pagination preserves four posts per page, first-page URL and final partial page', async () => {
  const posts = Array.from({ length: 9 }, (_, i) => post(String(i), `2026-07-${String(i + 1).padStart(2, '0')}`, 'tech'));
  const pages = await categoryPaths('tech', posts);
  assert.deepEqual(pages.map(p => p.params.page), [undefined, '2', '3']);
  assert.deepEqual(pages.map(p => p.props.posts.length), [4, 4, 1]);
  assert.deepEqual(pages.map(p => p.props.currentPage), [1, 2, 3]);
  assert.ok(pages.every(p => p.props.totalPages === 3));
});

test('empty categories still generate a first page', async () => {
  const pages = await categoryPaths('life', []);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].params.page, undefined);
  assert.equal(pages[0].props.posts.length, 0);
});

test('tags use date order without pinned priority and do not mutate source posts', () => {
  const posts = [post('old', '2026-06-18', 'tech', true), post('new', '2026-08-04', 'tech')];
  for (const item of posts) item.frontmatter.tags = ['shared'];
  assert.deepEqual(postsForTag(posts, 'shared').map(p => p.frontmatter.title), ['new', 'old']);
  assert.equal(posts[0].frontmatter.title, 'old');
  assert.deepEqual(postsForTag(posts, 'missing'), []);
});
