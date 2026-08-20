import { getCollection, type CollectionEntry } from "astro:content";
import { SITE } from "./site";

export type Post = CollectionEntry<"blog">;

let cached: Post[] | null = null;
async function loadAll(): Promise<Post[]> {
  if (cached) return cached;
  const all = await getCollection("blog", ({ data }) => !data.draft);
  cached = all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  return cached;
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
