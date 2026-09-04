#!/usr/bin/env node
/**
 * Guard tenant identity before a build ships.
 *
 * The R2 media path is tenants/<tenantSlug>/<file>, so a wrong slug silently
 * points every image at another tenant's folder. Catch that here, not in prod.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const blogDir = join(root, "src/content/blog");
const canaryPath = join(root, "scripts/blog-canaries.txt");
const configPath = join(root, "astropayload.config.json");

const EXPECTED_TENANT = "tholenkrant";

if (!existsSync(configPath)) {
  console.error("[assert-blog-files] missing astropayload.config.json");
  process.exit(1);
}

let cfg;
try {
  // Some configs were written with a UTF-8 BOM, which JSON.parse rejects.
  cfg = JSON.parse(readFileSync(configPath, "utf8").replace(/^﻿/, ""));
} catch (err) {
  console.error(`[assert-blog-files] astropayload.config.json is not valid JSON: ${err.message}`);
  process.exit(1);
}

if (cfg.tenantSlug !== EXPECTED_TENANT) {
  console.error(
    `[assert-blog-files] tenantSlug must be ${EXPECTED_TENANT} ` +
      `(got ${cfg.tenantSlug || "(empty)"}). Media resolves to tenants/<slug>/, ` +
      "so a wrong slug breaks every Payload image.",
  );
  process.exit(1);
}

const errors = [];
const files = existsSync(blogDir)
  ? readdirSync(blogDir).filter((f) => /\.(md|mdx)$/i.test(f))
  : [];
const present = new Set(files.map((f) => f.replace(/\.(md|mdx)$/i, "")));

// Canaries are posts that must survive Payload sync + prepare:blog. An empty
// canary list is normal for a tenant that has not published anything yet.
if (existsSync(canaryPath)) {
  const canaries = readFileSync(canaryPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  for (const slug of canaries) {
    if (!present.has(slug)) {
      errors.push(
        `missing canary src/content/blog/${slug}.md — publish it in Payload, ` +
          "or drop it from scripts/blog-canaries.txt",
      );
    }
  }
}

if (errors.length) {
  console.error(
    "[assert-blog-files] Build blocked:\n" + errors.map((e) => `  - ${e}`).join("\n"),
  );
  process.exit(1);
}

if (files.length === 0) {
  console.warn(
    `[assert-blog-files] warning: no blog files yet for ${EXPECTED_TENANT} — ` +
      "publish posts in Payload, then redeploy",
  );
}

console.log(`[assert-blog-files] ok: ${files.length} blog file(s), tenant ${EXPECTED_TENANT}`);
