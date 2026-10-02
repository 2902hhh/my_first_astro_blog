export type Category = 'tech' | 'life';

export interface PostFrontmatter {
  title: string;
  pubDate: string | Date;
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
}

const newestFirst = (a: Post, b: Post) =>
  new Date(b.frontmatter.pubDate).getTime() - new Date(a.frontmatter.pubDate).getTime();

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
