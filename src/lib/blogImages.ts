/**
 * Featured / hero image resolution for blog cards and article heroes.
 * Always returns a renderable cover — never empty, never affiliate HTML pages.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_BLOG_COVER,
  FALLBACK_BLOG_COVER,
  extractMediaPath,
  isLikelyImageUrl,
  resolveUsableMediaUrl,
  repairMediaUrlsInHtml as repairMediaUrlsInHtmlBase,
  getPayloadPublicBase,
} from "./media-url.mjs";

export {
  DEFAULT_R2_PUBLIC_BASE,
  DEFAULT_TENANT_SLUG,
  DEFAULT_BLOG_COVER,
  FALLBACK_BLOG_COVER,
  getPayloadPublicBase,
  getTenantSlug,
  repairTenantR2Url,
  repairMediaUrlsInHtml,
  resolveMediaUrl,
  isLikelyImageUrl,
  resolveUsableMediaUrl,
} from "./media-url.mjs";

export const DEFAULT_OG_IMAGE = "/og-default.svg";

type EnvMap = Record<string, string | undefined>;

function readEnv(): EnvMap {
  const viteEnv =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta as ImportMeta & { env?: EnvMap }).env
      : undefined;
  const nodeEnv = typeof process !== "undefined" ? (process.env as EnvMap) : undefined;
  return { ...nodeEnv, ...viteEnv };
}

export interface PostImageFields {
  heroImage?: unknown;
  featuredImage?: unknown;
  image?: unknown;
  featuredImageAlt?: string;
  heroImageAlt?: string;
  extra?: {
    featuredImage?: unknown;
    featuredImageAlt?: string;
    heroImage?: unknown;
    image?: unknown;
  };
}

function localPublicExists(src: string): boolean {
  if (!src.startsWith("/")) return true;
  return existsSync(join(process.cwd(), "public", src.replace(/^\//, "")));
}

function pickCover(raw: string | undefined | null): string {
  const resolved = resolveUsableMediaUrl(raw, { env: readEnv() });
  if (!resolved) return "";
  if (resolved.startsWith("/") && !localPublicExists(resolved)) return "";
  return resolved;
}

function firstBodyImage(body?: string): string {
  if (!body) return "";
  const md = body.match(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
  if (md?.[1]) return md[1].trim();
  const html = body.match(/<img[^>]+src=["']([^"']+)["']/i);
  return html?.[1]?.trim() ?? "";
}

/**
 * Always returns a renderable cover URL for /blog/ cards and article heroes.
 */
export function resolveFeaturedImage(
  data: PostImageFields,
  body?: string,
  options?: { fallback?: string | false },
): string {
  const fallback =
    options?.fallback === false
      ? ""
      : (options?.fallback ?? DEFAULT_BLOG_COVER);

  const candidates = [
    extractMediaPath(data.featuredImage),
    extractMediaPath(data.heroImage),
    extractMediaPath(data.image),
    extractMediaPath(data.extra?.featuredImage),
    extractMediaPath(data.extra?.heroImage),
    extractMediaPath(data.extra?.image),
    firstBodyImage(body),
  ];

  for (const c of candidates) {
    if (!c) continue;
    if (!isLikelyImageUrl(c) && !c.startsWith("/media/")) continue;
    const picked = pickCover(c);
    if (picked) return picked;
  }

  // `fallback: false` means "render no <img> at all" — never substitute a cover.
  if (options?.fallback === false) return "";
  if (fallback && localPublicExists(fallback)) return fallback;
  return FALLBACK_BLOG_COVER;
}

export function resolveFeaturedImageAlt(data: PostImageFields, fallback = ""): string {
  return (
    data.featuredImageAlt?.trim() ||
    data.extra?.featuredImageAlt?.trim() ||
    data.heroImageAlt?.trim() ||
    (typeof data.heroImage === "object" &&
    data.heroImage &&
    "alt" in data.heroImage &&
    typeof (data.heroImage as { alt?: unknown }).alt === "string"
      ? (data.heroImage as { alt: string }).alt.trim()
      : "") ||
    fallback ||
    "Artikelafbeelding"
  );
}

export function repairHtmlMediaUrls(html: string): string {
  return repairMediaUrlsInHtmlBase(html, { env: readEnv() });
}

export function getR2PublicBase(): string {
  return getPayloadPublicBase(readEnv());
}
