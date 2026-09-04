/** Minimal frontmatter helpers for Tholen blog normalize scripts. */

export function splitFrontmatter(raw) {
  const m = String(raw ?? "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { frontmatter: "", body: String(raw ?? ""), hasFrontmatter: false };
  return { frontmatter: m[1], body: m[2], hasFrontmatter: true };
}

export function getFrontmatterField(fm, key) {
  const re = new RegExp(`^${key}:\\s*(.*)$`, "m");
  const m = String(fm ?? "").match(re);
  if (!m) return "";
  return m[1].trim().replace(/^["']|["']$/g, "").trim();
}

export function upsertFrontmatterField(fm, key, value) {
  const lines = String(fm ?? "").split(/\r?\n/);
  const re = new RegExp(`^${key}:\\s*`);
  const quoted =
    typeof value === "boolean" || value === "true" || value === "false"
      ? String(value)
      : `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  let found = false;
  const next = lines.map((line) => {
    if (re.test(line)) {
      found = true;
      return `${key}: ${quoted}`;
    }
    return line;
  });
  if (!found) next.push(`${key}: ${quoted}`);
  return next.join("\n");
}

export function rebuildMarkdown(fm, body) {
  return `---\n${String(fm).trim()}\n---\n\n${String(body ?? "").replace(/^\n+/, "")}`;
}

export function decodeHtmlEntities(s) {
  return String(s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
