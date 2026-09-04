import { getCollection, type CollectionEntry } from "astro:content";
import { SITE } from "./site";
import { resolveFeaturedImage, resolveFeaturedImageAlt } from "./blogImages";

export type Post = CollectionEntry<"blog">;

/**
 * Dev-only cap. A few tenants carry thousands of posts, which makes `astro dev`
 * time out on Windows ("transport invoke timed out"). Production builds always
 * load the full collection.
 */
const DEV_POST_LIMIT = Number(import.meta.env.BLOG_DEV_LIMIT ?? 400);
const isDev = import.meta.env.DEV;

/** Live pages only. Payload may send draft as boolean/string, plus _status / publishStatus. */
export function isLivePost(post: {
  data: { draft?: unknown; _status?: unknown; publishStatus?: unknown };
}): boolean {
  const { draft, _status, publishStatus } = post.data;
  if (draft === true || draft === "true") return false;
  const status = String(publishStatus ?? _status ?? "").toLowerCase();
  if (!status) return true;
  if (status === "draft" || status === "unpublished" || status === "scheduled") return false;
  // Payload / WP may send publish | published
  return true;
}

function postSortTime(post: Post): number {
  const times = [post.data.pubDate, post.data.date, post.data.updatedDate]
    .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.valueOf()))
    .map((d) => d.valueOf());
  return times.length ? Math.max(...times) : 0;
}

function isFuturePost(post: Post, asOf = new Date()): boolean {
  const d = post.data.pubDate ?? post.data.date;
  if (!(d instanceof Date) || Number.isNaN(d.valueOf())) return false;
  return d.getTime() > asOf.getTime() + 60_000;
}

let cached: Post[] | null = null;
async function loadAll(): Promise<Post[]> {
  if (cached) return cached;
  // No content filtering beyond publish state: the celebrity / casino /
  // social-media posts on these sites are deliberate content, not spam.
  const all = await getCollection("blog", ({ data }) => isLivePost({ data }));
  const live = all
    .filter((p) => !isFuturePost(p))
    .sort((a, b) => postSortTime(b) - postSortTime(a));
  cached = isDev && live.length > DEV_POST_LIMIT ? live.slice(0, DEV_POST_LIMIT) : live;
  return cached;
}

/**
 * Public URL for a card / hero / OG image, or "" when the post has no picture.
 * Callers render a category bar instead of a broken <img> when this is empty.
 */
export function postImage(post: Post): string {
  return resolveFeaturedImage(post.data, post.body, { fallback: false });
}

export function postImageAlt(post: Post): string {
  return resolveFeaturedImageAlt(post.data, post.data.title);
}

export async function getAllPosts(): Promise<Post[]> {
  return loadAll();
}

export async function getRecentPosts(n = 6): Promise<Post[]> {
  const all = await loadAll();
  return all.slice(0, n);
}

export async function getPostsByCategory(categoryName: string): Promise<Post[]> {
  const all = await loadAll();
  return all.filter((p) => p.data.categories.includes(categoryName));
}

export async function getRelatedPosts(current: Post, n = 6): Promise<Post[]> {
  const all = await loadAll();
  const sameCategory = all.filter(
    (p) =>
      p.id !== current.id &&
      p.data.categories.some((c) => current.data.categories.includes(c)),
  );
  const filler = all.filter(
    (p) => p.id !== current.id && !sameCategory.includes(p),
  );
  return [...sameCategory, ...filler].slice(0, n);
}

export function readingMinutes(text: string): number {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function categoryFromSlug(slug: string): string | null {
  return SITE.categories.find((c) => c.slug === slug)?.name ?? null;
}

export function postUrl(post: Post): string {
  return `/${post.id}/`;
}

export function formatDateNL(date: Date): string {
  return date.toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** All published posts are suitable for the homepage on a news site. */
export async function getHomepageSafePosts(): Promise<Post[]> {
  return loadAll();
}
