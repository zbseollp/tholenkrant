#!/usr/bin/env node
/**
 * Strip injected ad/malware code and shady affiliate links from blog + pages MD.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const INJECTED_RE = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /<style[^>]*>[\s\S]*?<\/style>/gi,
  /document\.write\s*\([^)]*\)/gi,
  /jQuery\(document\)[\s\S]*?(?=\n\n|\*\*|$)/gi,
  /\(adsbygoogle[\s\S]*?\)\.push\(\{[^}]*\}\);?/gi,
  /\(adsbygoogle=window\.adsbygoogle[\s\S]*?;/gi,
  /gformInitSpinner[\s\S]*?gform_post_render[\s\S]*?\);?\s*/gi,
  /wbcr_php_snippet[\s\S]*?(?=\n\n|$)/gi,
  /\[table id=[^\]]+\]/gi,
];

/**
 * WordPress/Elementor dumps raw stylesheet text into the exported body, e.g.
 *   /*! elementor - v3.20.0 - 13-03-2024 * /
 *   .elementor-widget-image{text-align:center}...
 * It renders as a wall of CSS in the article and in card excerpts.
 */
const ELEMENTOR_BANNER_RE = /\/\*![^*]*elementor[\s\S]*?\*\//gi;
// One or more consecutive `selector{declarations}` rules whose selector names elementor.
const ELEMENTOR_RULES_RE = /(?:[^{}\n]*elementor[^{}\n]*\{[^{}]*\}[ \t]*\n?)+/gi;

function stripElementorCss(text) {
  return text.replace(ELEMENTOR_BANNER_RE, "\n").replace(ELEMENTOR_RULES_RE, "\n\n");
}

/**
 * WordPress exports keep the theme's HTML indentation, so paragraphs arrive
 * prefixed with tabs. Markdown reads a tab (or 4 spaces) as an indented code
 * block and renders the article as dark <pre> slabs instead of prose.
 *
 * Strip that indentation, but never touch a real fenced code block, and leave
 * 1-3 space indents alone so nested lists keep working.
 */
const FENCE_RE = /^\s*(?:```|~~~)/;

const LIST_ITEM_RE = /^[-*+]\s+|^\d+[.)]\s+/;

function dedentProse(body) {
  // Split on either line ending and re-join with \n so a stray \r cannot hide
  // the indentation from the checks below.
  const lines = body.split(/\r?\n/);
  let inFence = false;
  let prevWasListItem = false;

  const out = lines.map((line) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;

    // Whitespace-only line: normalise to empty so paragraphs separate cleanly.
    if (!line.trim()) return "";

    const m = line.match(/^(?:\t+| {4,})[ \t]*/);
    if (!m) {
      prevWasListItem = LIST_ITEM_RE.test(line);
      return line;
    }

    const rest = line.slice(m[0].length);

    // Keep real nested list indentation — flattening it would merge sub-items
    // into their parent list.
    if (prevWasListItem && LIST_ITEM_RE.test(rest)) return line;

    prevWasListItem = LIST_ITEM_RE.test(rest);
    return rest;
  });

  return out.join("\n");
}

const INJECTED_FM_RE =
  /'\);\s*document\.write\([^)]*\)[\s\S]*?\/\/\s*-->\s*/g;
const DART_FM_RE = /document\.write\(dartPosition\d+\)/g;
const JS_LINK_RE = /\[([^\]]*)\]\(\/?javascript:[^)]*\)/gi;
const JS_BARE_RE = /\]\(\/?javascript:[^)]*\)/gi;
const JS_FM_VOID_RE = /\/javascript:void\\?\([^)]*\\?\)/gi;
const WBCR_RE = /wbcr_php_snippet|\[table id=/gi;

/**
 * Drop a frontmatter text field whose value is CSS rather than prose.
 * The value may be a double-quoted YAML scalar spanning several lines.
 * normalize-synced-blog.mjs regenerates the description from the clean body.
 */
const FM_TEXT_FIELD_RE = /^(?:metaDescription|description|excerpt):[ \t]*"(?:[^"\\]|\\.)*"[ \t]*\r?\n?/gm;

function stripJunkFrontmatterText(fm) {
  return fm.replace(FM_TEXT_FIELD_RE, (m) =>
    /elementor|<style|wp-block|document\.write/i.test(m) ? "" : m,
  );
}

function sanitizeCommon(text) {
  let out = text;
  for (const re of INJECTED_RE) out = out.replace(re, "");
  out = out.replace(INJECTED_FM_RE, "");
  out = out.replace(DART_FM_RE, "");
  out = out.replace(JS_LINK_RE, "$1");
  out = out.replace(JS_BARE_RE, "]");
  out = out.replace(JS_FM_VOID_RE, "");
  out = out.replace(WBCR_RE, "");
  out = out.replace(/#gform_fields_\d+/gi, "");
  return out;
}

function sanitizeContent(raw) {
  const m = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)([\s\S]*)$/);

  // No frontmatter: treat the whole file as body.
  if (!m) {
    return sanitizeCommon(stripElementorCss(raw)).replace(/\n{4,}/g, "\n\n\n");
  }

  const [, open, fm, close, body] = m;
  const cleanFm = stripJunkFrontmatterText(sanitizeCommon(fm)).replace(/\n{3,}/g, "\n").trim();
  const cleanBody = sanitizeCommon(dedentProse(stripElementorCss(body)))
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/^\s+/, "");
  return `${open}${cleanFm}${close}${cleanBody}`;
}

function processDir(relDir) {
  const dir = path.join(root, relDir);
  if (!fs.existsSync(dir)) return 0;
  let changed = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!/\.(md|mdx)$/i.test(name)) continue;
    const filePath = path.join(dir, name);
    const raw = fs.readFileSync(filePath, "utf8");
    const cleaned = sanitizeContent(raw);
    if (cleaned !== raw) {
      fs.writeFileSync(filePath, cleaned, "utf8");
      changed++;
      console.log("sanitized:", path.posix.join(relDir, name.replace(/\.(md|mdx)$/i, "")));
    }
  }
  return changed;
}

const changed =
  processDir("src/content/blog") + processDir("src/content/pages");
console.log(`sanitize-blog: cleaned ${changed} file(s)`);
