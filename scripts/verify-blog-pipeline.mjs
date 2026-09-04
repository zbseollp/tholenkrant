#!/usr/bin/env node
/**
 * Fail the build if injected code survived, or a cover would render as broken.
 *
 * This checks markup, never subject matter — no post is ever rejected for what
 * it is about.
 *
 * A post with no cover at all is fine (the card shows its category bar).
 * A post whose cover cannot be resolved to something a browser can fetch is not.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasInjectedCode } from "./lib/injected-code.mjs";
import { getFrontmatterField, splitFrontmatter } from "./lib/blog-frontmatter.mjs";
import {
  extractMediaPath,
  isLikelyImageUrl,
  resolveUsableMediaUrl,
} from "../src/lib/media-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const blogDir = path.join(root, "src/content/blog");

function publicExists(src) {
  if (!src.startsWith("/")) return true;
  return fs.existsSync(path.join(root, "public", src.replace(/^\//, "")));
}

if (!fs.existsSync(blogDir)) {
  console.log("verify-blog-pipeline: no src/content/blog yet — nothing to verify");
  process.exit(0);
}

const files = fs.readdirSync(blogDir).filter((f) => /\.(md|mdx)$/i.test(f));
let errors = 0;
let publishable = 0;
let withCover = 0;

for (const file of files) {
  const slug = file.replace(/\.(md|mdx)$/i, "");
  const raw = fs.readFileSync(path.join(blogDir, file), "utf8");
  const { frontmatter, body, hasFrontmatter } = splitFrontmatter(raw);

  if (!hasFrontmatter) {
    console.error(`verify-blog-pipeline: missing frontmatter: ${slug}`);
    errors++;
    continue;
  }

  if (hasInjectedCode(body)) {
    console.error(`verify-blog-pipeline: injected code still in body: ${slug}`);
    errors++;
    continue;
  }

  const draft = getFrontmatterField(frontmatter, "draft");
  const status = getFrontmatterField(frontmatter, "_status");
  if (draft === "true") continue;
  if (status && !/^(published|publish)$/i.test(status)) continue;
  publishable++;

  const cover =
    extractMediaPath(getFrontmatterField(frontmatter, "featuredImage")) ||
    extractMediaPath(getFrontmatterField(frontmatter, "heroImage"));

  // No cover is a valid state — the card renders its category bar instead.
  if (!cover) continue;
  withCover++;

  if (!isLikelyImageUrl(cover) && !cover.startsWith("/media/")) {
    console.error(`verify-blog-pipeline: cover is not an image URL: ${slug} -> ${cover}`);
    errors++;
    continue;
  }
  const resolved = resolveUsableMediaUrl(cover);
  if (!resolved) {
    console.error(`verify-blog-pipeline: cover unusable: ${slug} -> ${cover}`);
    errors++;
    continue;
  }
  if (resolved.startsWith("/") && !publicExists(resolved)) {
    console.error(
      `verify-blog-pipeline: cover missing in public/: ${slug} -> ${resolved}`,
    );
    errors++;
  }
}

// Distinguish "no content synced yet" (fine) from "everything got hidden" (not).
if (files.length > 0 && publishable === 0) {
  console.error(
    "verify-blog-pipeline: files on disk but ZERO publishable posts — " +
      "a draft/_status flag hid everything",
  );
  errors++;
} else if (files.length === 0) {
  console.warn(
    "verify-blog-pipeline: src/content/blog is empty — publish posts in Payload for this tenant",
  );
}

console.log(
  `verify-blog-pipeline: ${files.length} file(s), ${publishable} publishable, ` +
    `${withCover} with cover, ${errors} error(s)`,
);

if (errors > 0) process.exit(1);
