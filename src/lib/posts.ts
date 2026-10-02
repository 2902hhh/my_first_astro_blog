export type Category = 'tech' | 'life';

export interface PostFrontmatter {
  title: string;
  pubDate: string | Date;
  updatedDate?: string | Date;
  author?: string;
  description?: string;
  category?: Category;
  pinned?: boolean;
  tags?: string[];
  image?: { url: string; alt: string };
}

export interface Post {
  url: string;
  frontmatter: PostFrontmatter;
  rawContent?: () => string;
}

const newestFirst = (a: Post, b: Post) =>
  new Date(b.frontmatter.pubDate).getTime() - new Date(a.frontmatter.pubDate).getTime();

export function formatDate(date: string | Date) {
  return date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
}

export function getPostDescription(post: Post, maxLength = 120) {
  if (post.frontmatter.description?.trim()) return post.frontmatter.description;

  // Extract the author's words for list previews without changing the Markdown file.
  const text = (post.rawContent?.() || '')
    .replace(/^[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]{0,3}\1[`~]*[ \t]*\r?$|$(?![\s\S]))/gm, ' ')
    .replace(/^(?: {4}|\t).*$/gm, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$(?!\s)([^$\n]*?[^\s$])\$/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|pre)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/!\[[^\]]*\](?:\([^\n]*?\)|\[[^\]]*\])/g, ' ')
    .replace(/^[ \t]{0,3}\[[^\]]+\]:.*$/gm, ' ')
    .replace(/\[([^\]]+)\](?:\([^\n]*?\)|\[[^\]]*\])/g, '$1')
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/^[ \t]{0,3}(?:#{1,6}\s+|>\s*|[-+*]\s+|\d+[.)]\s+)/gm, '')
    .replace(/^[ \t]*(?:[-*_][ \t]*){3,}\r?$/gm, ' ')
    .replace(/(`+)([\s\S]*?)\1/g, '$2')
    .replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(?<![\p{L}\p{N}])_([^_\n]+)_(?![\p{L}\p{N}])/gu, '$1')
    .replace(/\\([\\`*{}\[\]()#+.!_>~-])/g, '$1')
    .replace(/\s+/g, ' ').trim();
  const characters = Array.from(text);
  return characters.length > maxLength ? characters.slice(0, maxLength).join('') + '…' : text;
}

export function getRecentPosts(posts: Post[], limit = 3) {
  const activityDate = (post: Post) => new Date(post.frontmatter.updatedDate || post.frontmatter.pubDate).getTime();
  return [...posts].sort((a, b) => activityDate(b) - activityDate(a)).slice(0, limit);
}

export function getAdjacentPosts(posts: Post[], url: string) {
  // Markdown routes may be encoded or use the lowercased path emitted by Astro.
  const normalize = (path: string) => decodeURI(path).replace(/\/+$/, '').toLowerCase();
  const current = posts.find(post => normalize(post.url) === normalize(url));
  if (!current) return { previous: undefined, next: undefined };
  const category = current.frontmatter.category || 'tech';
  const siblings = posts.filter(post => (post.frontmatter.category || 'tech') === category).sort(newestFirst);
  const index = siblings.indexOf(current);
  return { previous: siblings[index + 1], next: siblings[index - 1] };
}

export function getCategoryPaths(allPosts: Post[], category: Category) {
  const posts = allPosts.filter(post => (post.frontmatter.category || 'tech') === category)
    .sort((a, b) => {
      if (a.frontmatter.pinned && !b.frontmatter.pinned) return -1;
      if (!a.frontmatter.pinned && b.frontmatter.pinned) return 1;
      return newestFirst(a, b);
    });
  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  return Array.from({ length: totalPages }, (_, i) => ({
    params: { page: i === 0 ? undefined : String(i + 1) },
    props: { posts: posts.slice(i * pageSize, (i + 1) * pageSize), currentPage: i + 1, totalPages },
  }));
}

export function postsForTag(posts: Post[], tag: string) {
  return posts.filter(post => post.frontmatter.tags?.includes(tag)).sort(newestFirst);
}

export function getTagPaths(posts: Post[]) {
  const tags = new Set(posts.flatMap(post => post.frontmatter.tags || []));
  return Array.from(tags, tag => ({ params: { tag }, props: { posts: postsForTag(posts, tag), tag } }));
}
