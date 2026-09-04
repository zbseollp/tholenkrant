#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const blogDir = path.join(root, "src/content/blog");

if (!fs.existsSync(blogDir)) {
  console.log("validate-blog: no blog directory");
  process.exit(0);
}

const files = fs.readdirSync(blogDir).filter((name) => /\.(md|mdx)$/i.test(name));
let invalid = 0;

for (const name of files) {
  const raw = fs.readFileSync(path.join(blogDir, name), "utf8");
  const title = raw.match(/^title:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
  const pubDate = raw.match(/^pubDate:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
  const date = raw.match(/^date:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
  const draft = raw.match(/^draft:\s*(true|"true")/m);

  if (draft) continue;

  if (!title) {
    console.warn(`validate-blog: missing title → ${name}`);
    invalid++;
    continue;
  }
  if (/^System\.Xml/i.test(title)) {
    console.warn(`validate-blog: junk title → ${name}`);
    invalid++;
    continue;
  }
  if (!pubDate && !date) {
    console.warn(`validate-blog: missing pubDate/date → ${name}`);
    invalid++;
  }
}

console.log(
  `validate-blog: ${files.length} blog file(s), ${invalid} invalid` +
    (files.length
      ? ` → ${files.map((f) => f.replace(/\.(md|mdx)$/i, "")).join(", ")}`
      : ""),
);
if (invalid > 0) {
  console.error("validate-blog: fix frontmatter before build");
  process.exit(1);
}
