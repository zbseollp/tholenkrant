/**
 * Payload / R2 media URL helpers for tholenkrant.nl
 * R2 path: tenants/tholenkrant/<filename>
 */

export const DEFAULT_TENANT_SLUG = "tholenkrant";

export const DEFAULT_R2_PUBLIC_BASE =
  "https://pub-d4024ad3e57841448e0ee58a19abe46b.r2.dev";

/** Always-available local cover for /blog/ cards and article heroes. */
export const DEFAULT_BLOG_COVER = "/images/blog/default-cover.svg";
export const FALLBACK_BLOG_COVER = "/images/blog/default-cover.svg";

const IMAGE_EXT_RE = /\.(?:jpe?g|png|gif|webp|avif|svg|bmp|ico)(?:$|[?#])/i;
const R2_HOST_RE = /pub-[a-z0-9]+\.r2\.dev/i;

/**
 * @param {Record<string, string | undefined> | undefined} env
 */
export function getPayloadPublicBase(
  env = typeof process !== "undefined" ? process.env : undefined,
) {
  // Media-specific vars only, most specific first.
  //
  // PAYLOAD_URL is deliberately NOT in this chain: it points at the Payload API
  // host, which does not serve /tenants/<slug>/<file>. CI sets it for the content
  // sync, so including it here silently rewrote every image to the wrong origin
  // whenever R2_PUBLIC_URL was missing.
  const raw =
    env?.R2_PUBLIC_URL ||
    env?.PUBLIC_R2_URL ||
    env?.PUBLIC_PAYLOAD_MEDIA_URL ||
    env?.PUBLIC_MEDIA_URL ||
    env?.MEDIA_BASE_URL ||
    DEFAULT_R2_PUBLIC_BASE;
  return String(raw).replace(/\/+$/, "");
}

/**
 * @param {Record<string, string | undefined> | undefined} env
 */
export function getTenantSlug(
  env = typeof process !== "undefined" ? process.env : undefined,
) {
  const raw =
    env?.PUBLIC_TENANT_SLUG ||
    env?.TENANT_SLUG ||
    env?.PAYLOAD_TENANT_SLUG ||
    env?.TENANT ||
    DEFAULT_TENANT_SLUG;
  return String(raw || DEFAULT_TENANT_SLUG)
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

/**
 * Reject HTML/affiliate pages stored as "featuredImage".
 * @param {unknown} pathOrUrl
 */
export function isLikelyImageUrl(pathOrUrl) {
  const raw = String(pathOrUrl ?? "").trim();
  if (!raw || raw === "/" || raw === "#") return false;

  if (
    raw.startsWith("/assets/") ||
    raw.startsWith("/images/") ||
    raw.startsWith("/uploads/") ||
    raw.startsWith("/wp-content/") ||
    raw.startsWith("/media/") ||
    raw.startsWith("/og-")
  ) {
    return true;
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      if (IMAGE_EXT_RE.test(u.pathname)) return true;
      if (R2_HOST_RE.test(u.hostname) && u.pathname.includes("/tenants/")) return true;
      return false;
    } catch {
      return false;
    }
  }

  if (!raw.includes("://") && !raw.startsWith("/") && IMAGE_EXT_RE.test(raw)) return true;
  if (raw.startsWith("/")) return IMAGE_EXT_RE.test(raw);
  return false;
}

/**
 * @param {string} url
 * @param {{ env?: Record<string, string | undefined> }} [options]
 */
export function repairTenantR2Url(url, options = {}) {
  if (!url || typeof url !== "string") return url;
  if (!/^https?:\/\//i.test(url)) return url;

  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const isR2 =
      host.includes("r2.dev") ||
      host.includes("r2.cloudflarestorage.com") ||
      host.endsWith(".cloudflarestorage.com");
    if (!isR2) return url;

    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return url;
    if (segments[0] === "tenants" && segments.length >= 3) return url;

    if (segments.length === 1 && /\.[a-z0-9]{2,8}$/i.test(segments[0])) {
      const slug = getTenantSlug(options.env);
      u.pathname = `/tenants/${slug}/${segments[0]}`;
      return u.toString();
    }

    return url;
  } catch {
    return url;
  }
}

/**
 * @param {unknown} input
 * @returns {string}
 */
export function extractMediaPath(input) {
  if (input == null) return "";
  if (typeof input === "string") return input.trim();
  if (typeof input !== "object") return "";

  const obj = /** @type {Record<string, unknown>} */ (input);
  if (typeof obj.url === "string" && obj.url.trim()) return obj.url.trim();
  if (typeof obj.filename === "string" && obj.filename.trim()) return obj.filename.trim();
  if (typeof obj.src === "string" && obj.src.trim()) return obj.src.trim();
  return "";
}

/**
 * @param {unknown} input
 * @param {{ env?: Record<string, string | undefined>; fallback?: string | null }} [options]
 */
export function resolveMediaUrl(input, options = {}) {
  const { env, fallback = null } = options;
  const raw = extractMediaPath(input);
  if (!raw) return fallback ?? "";

  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) {
    return /^https?:\/\//i.test(raw) ? repairTenantR2Url(raw, { env }) : raw;
  }

  const path = raw.startsWith("/") ? raw : `/${raw}`;
  if (
    path.startsWith("/images/") ||
    path.startsWith("/wp-content/") ||
    path.startsWith("/assets/") ||
    path.startsWith("/_astro/") ||
    path.startsWith("/og-")
  ) {
    return path;
  }

  const payloadBase = getPayloadPublicBase(env);
  if (payloadBase && (path.startsWith("/media/") || path.startsWith("/api/media/"))) {
    const filename = path.split("/").filter(Boolean).pop();
    if (filename && /\.[a-z0-9]{2,8}$/i.test(filename)) {
      const tenantUrl = `${payloadBase}/tenants/${getTenantSlug(env)}/${filename}`;
      return repairTenantR2Url(tenantUrl, { env });
    }
    return repairTenantR2Url(`${payloadBase}${path}`, { env });
  }

  if (payloadBase && !path.startsWith("/wp-content/") && !raw.startsWith("/")) {
    return repairTenantR2Url(
      `${payloadBase}/tenants/${getTenantSlug(env)}/${raw.replace(/^\/+/, "")}`,
      { env },
    );
  }

  if (payloadBase && !path.startsWith("/wp-content/")) {
    return repairTenantR2Url(`${payloadBase}${path}`, { env });
  }

  return path;
}

/**
 * Resolve a featured/hero image to a browser-usable URL, or "".
 * Never returns non-image http(s) pages.
 * @param {unknown} pathOrUrl
 * @param {{ env?: Record<string, string | undefined>; fallback?: string | null }} [options]
 */
export function resolveUsableMediaUrl(pathOrUrl, options = {}) {
  const extracted = extractMediaPath(pathOrUrl);
  if (!extracted) return options.fallback ?? "";
  if (!isLikelyImageUrl(extracted) && !extracted.startsWith("/media/")) {
    return options.fallback ?? "";
  }
  const resolved = resolveMediaUrl(extracted, options);
  if (!resolved) return options.fallback ?? "";
  if (/^https?:\/\//i.test(resolved) && !isLikelyImageUrl(resolved)) {
    return options.fallback ?? "";
  }
  return resolved;
}

/**
 * @param {string} html
 * @param {{ env?: Record<string, string | undefined> }} [options]
 */
export function repairMediaUrlsInHtml(html, options = {}) {
  if (!html || typeof html !== "string") return html;
  return html.replace(/\b(src|srcset)=(["'])([^"']+)\2/gi, (full, attr, quote, url) => {
    if (attr.toLowerCase() === "srcset") {
      const repaired = url
        .split(",")
        .map((part) => {
          const trimmed = part.trim();
          const space = trimmed.indexOf(" ");
          const raw = space === -1 ? trimmed : trimmed.slice(0, space);
          const resolved = resolveUsableMediaUrl(raw, options) || repairTenantR2Url(raw, options);
          return space === -1 ? resolved : `${resolved}${trimmed.slice(space)}`;
        })
        .join(", ");
      return `${attr}=${quote}${repaired}${quote}`;
    }
    const resolved = resolveUsableMediaUrl(url, options) || repairTenantR2Url(url, options);
    return `${attr}=${quote}${resolved}${quote}`;
  });
}
