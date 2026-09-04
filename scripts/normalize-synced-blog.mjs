#!/usr/bin/env node
/**
 * After Payload sync: normalise frontmatter so the Astro collection can load it.
 *
 * Deliberately conservative — it only rewrites a file when something is actually
 * wrong. It does NOT stamp a placeholder cover onto posts that legitimately have
 * no image: a post without a picture renders a category bar, not a broken <img>.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  decodeHtmlEntities,
  getFrontmatterField,
  rebuildMarkdown,
  splitFrontmatter,
  upsertFrontmatterField,
} from "./lib/blog-frontmatter.mjs";
import {
  extractMediaPath,
  isLikelyImageUrl,
  resolveUsableMediaUrl,
} from "../src/lib/media-url.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BLOG_DIR = path.join(ROOT, "src/content/blog");

async function publicExists(src) {
  if (!src.startsWith("/")) return true;
  try {
    await fs.access(path.join(ROOT, "public", src.replace(/^\//, "")));
    return true;
  } catch {
    return false;
  }
}

function removeFrontmatterField(fm, key) {
  return String(fm ?? "")
    .split(/\r?\n/)
    .filter((line) => !new RegExp(`^${key}:\\s*`).test(line))
    .join("\n");
}

/** "- example.nl", "example.nl", "-" — a site suffix left behind, not a headline. */
function isJunkMetaTitle(value) {
  const v = String(value ?? "")
    .replace(/^\s*[-|–]\s*/, "")
    .trim();
  if (!v) return true;
  return /^[\w.-]+\.(?:nl|com|be|de|eu|org)$/i.test(v);
}

/** Turn "de-pepernotenfabriek-2013" into "De pepernotenfabriek 2013". */
function titleFromSlug(slug) {
  const words = slug.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!words) return "";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Best available title for a post whose frontmatter lost it.
 * Prefers a real heading or opening line over a de-slugified filename.
 */
function recoverTitle(fm, body, file) {
  // WordPress leaves the bare site suffix behind when the title is empty,
  // e.g. metaTitle: "- nijmegenleeft.nl". Strip the suffix first, then the
  // orphaned separator, and reject whatever is left if it is just a domain.
  const metaTitle = decodeHtmlEntities(getFrontmatterField(fm, "metaTitle") ?? "")
    .replace(/\s*[-|–]\s*[\w.-]+\.(?:nl|com|be|de|eu|org)\s*$/i, "")
    .replace(/^\s*[-|–]\s*/, "")
    .trim();
  const isBareDomain = /^[\w.-]+\.(?:nl|com|be|de|eu|org)$/i.test(metaTitle);
  if (metaTitle.length >= 5 && !isBareDomain) return metaTitle;

  const heading = body.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim();
  if (heading && heading.length >= 5) return decodeHtmlEntities(heading);

  const firstLine = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !/^[!<[|]/.test(l));
  if (firstLine) {
    const clean = decodeHtmlEntities(firstLine.replace(/[*_`#]/g, "").trim());
    if (clean.length >= 5) return clean.length <= 110 ? clean : clean.slice(0, 107).trimEnd() + "…";
  }

  return titleFromSlug(file.replace(/\.(md|mdx)$/i, ""));
}

/** First real sentence(s) of the body, for use as a card excerpt / meta description. */
function firstProse(body, max = 155) {
  const text = String(body ?? "")
    .replace(/^#{1,6}\s+.*$/gm, "")           // headings
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")      // images
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")   // links -> label
    .replace(/<[^>]+>/g, " ")                 // stray html
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trim();
}

/** Resolved, browser-usable URL for a raw frontmatter image value, or "". */
async function usableCover(raw) {
  const value = extractMediaPath(raw);
  if (!value) return "";
  if (!isLikelyImageUrl(value) && !value.startsWith("/media/")) return "";
  const resolved = resolveUsableMediaUrl(value);
  if (!resolved) return "";
  // A site-relative path is only usable if the file is really in public/.
  if (resolved.startsWith("/") && !(await publicExists(resolved))) return "";
  return resolved;
}

let updated = 0;
let entries;
try {
  entries = await fs.readdir(BLOG_DIR);
} catch {
  console.log("normalize-synced-blog: no blog directory");
  process.exit(0);
}

for (const file of entries.filter((f) => /\.(md|mdx)$/i.test(f))) {
  const filePath = path.join(BLOG_DIR, file);
  const raw = await fs.readFile(filePath, "utf8");
  const { frontmatter, body, hasFrontmatter } = splitFrontmatter(raw);
  if (!hasFrontmatter) continue;

  let fm = frontmatter;
  let changed = false;

  // 1. Payload/WP sometimes double-encodes the title.
  const title = getFrontmatterField(fm, "title");
  let normalizedTitle = decodeHtmlEntities(title).trim();
  if (normalizedTitle && normalizedTitle !== title) {
    fm = upsertFrontmatterField(fm, "title", normalizedTitle);
    changed = true;
  }

  // 1b. Some WordPress exports lost the title entirely (attachment pages, and
  //     posts whose <h1> lived in the template). The article is real content, so
  //     recover a title instead of dropping the post at validate time.
  if (!normalizedTitle) {
    const recovered = recoverTitle(fm, body, file);
    if (recovered) {
      normalizedTitle = recovered;
      fm = upsertFrontmatterField(fm, "title", recovered);
      changed = true;
    }
  }

  // 1c. The same exports leave metaTitle as a bare site suffix ("- example.nl").
  //     SEO uses metaTitle || title, so a junk one becomes the <title> tag.
  const rawMetaTitle = getFrontmatterField(fm, "metaTitle");
  if (rawMetaTitle && isJunkMetaTitle(rawMetaTitle)) {
    fm = removeFrontmatterField(fm, "metaTitle");
    changed = true;
  }

  // 2. date / pubDate must both exist so sorting and filters agree.
  const date = getFrontmatterField(fm, "date");
  const pubDate = getFrontmatterField(fm, "pubDate");
  if (pubDate && !date) {
    fm = upsertFrontmatterField(fm, "date", pubDate);
    changed = true;
  } else if (date && !pubDate) {
    fm = upsertFrontmatterField(fm, "pubDate", date);
    changed = true;
  }

  // 3. A missing slug breaks getStaticPaths for posts synced without one.
  if (!getFrontmatterField(fm, "slug")) {
    fm = upsertFrontmatterField(fm, "slug", file.replace(/\.(md|mdx)$/i, ""));
    changed = true;
  }

  // 4. Repair image fields in place: /media/... -> R2, drop unusable values.
  //    An unusable cover is removed rather than replaced, so the card falls
  //    back to its category bar instead of a broken image icon.
  for (const key of ["featuredImage", "heroImage", "image"]) {
    const current = getFrontmatterField(fm, key);
    if (!current) continue;
    const resolved = await usableCover(current);
    if (resolved === current) continue;
    if (resolved) {
      fm = upsertFrontmatterField(fm, key, resolved);
    } else {
      fm = fm
        .split(/\r?\n/)
        .filter((line) => !new RegExp(`^${key}:\\s*`).test(line))
        .join("\n");
    }
    changed = true;
  }

  // 5. Rebuild a description when sanitize removed a junk one (Elementor CSS
  //    used to leak into metaDescription and render as the card excerpt).
  if (!getFrontmatterField(fm, "metaDescription") && !getFrontmatterField(fm, "description")) {
    const summary = firstProse(body);
    if (summary) {
      fm = upsertFrontmatterField(fm, "metaDescription", summary);
      changed = true;
    }
  }

  // 6. Give a real cover a sensible alt so cards/heroes are accessible.
  const cover = getFrontmatterField(fm, "featuredImage");
  if (cover && !getFrontmatterField(fm, "featuredImageAlt") && normalizedTitle) {
    fm = upsertFrontmatterField(fm, "featuredImageAlt", normalizedTitle);
    changed = true;
  }

  if (changed) {
    await fs.writeFile(filePath, rebuildMarkdown(fm, body), "utf8");
    updated++;
  }
}

console.log(`normalize-synced-blog: updated ${updated} file(s)`);
