import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCategoryPaths, postsForTag, getRecentPosts, getAdjacentPosts, formatDate } from '../src/lib/posts.ts';
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

test('recent posts use the latest publication or explicit update, ignoring pinning', () => {
  const posts = [post('old', '2026-06-18', 'tech', true), post('new', '2026-08-04', 'tech'), post('life', '2026-07-25', 'life'), post('other', '2026-07-22', 'tech')];
  posts[0].frontmatter.updatedDate = '2026-08-05';
  assert.deepEqual(getRecentPosts(posts).map(p => p.frontmatter.title), ['old', 'new', 'life']);
  assert.equal(posts[0].frontmatter.title, 'old');
  assert.deepEqual(getRecentPosts([]), []);
});

test('adjacent posts stay in the same category, use publication order and preserve URLs', () => {
  const posts = [post('old', '2026-06-18', undefined, true), post('middle', '2026-07-22', 'tech'), post('new', '2026-08-04', 'tech'), post('life', '2026-07-25', 'life')];
  posts[0].frontmatter.updatedDate = '2026-09-01';
  const middle = getAdjacentPosts(posts, '/posts/middle/');
  assert.equal(middle.previous.url, '/posts/old');
  assert.equal(middle.next.url, '/posts/new');
  assert.equal(getAdjacentPosts(posts, '/posts/new').next, undefined);
  assert.equal(getAdjacentPosts(posts, '/posts/old').previous, undefined);
  assert.deepEqual(getAdjacentPosts(posts, '/posts/life'), { previous: undefined, next: undefined });
  assert.deepEqual(getAdjacentPosts(posts, '/posts/missing'), { previous: undefined, next: undefined });
  const chinese = post('亿万人', '2026-07-25', 'life');
  assert.equal(getAdjacentPosts([...posts, chinese], encodeURI(chinese.url)).next.url, '/posts/life');
});

test('dates render consistently for strings and Markdown Date values', () => {
  assert.equal(formatDate('2026-08-04'), '2026-08-04');
  assert.equal(formatDate(new Date('2026-08-04T00:00:00Z')), '2026-08-04');
});
