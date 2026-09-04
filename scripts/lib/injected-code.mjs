/**
 * Detection for code injected into post bodies by the old WordPress install.
 *
 * This is deliberately NOT a content classifier. Celebrity, casino/gambling and
 * social-media posts on these sites are real, intentional articles and are never
 * removed or filtered. The only thing flagged here is executable junk that the
 * WP export dragged along — ad loaders, document.write payloads, form spinners.
 */

export const INJECTED_CODE_RE =
  /document\.write\s*\(|wbcr_php_snippet|\[table id=|javascript:fotovenster|dartPosition\d|\/javascript:void|\(adsbygoogle|gformInitSpinner|GF_AJAX_POSTBACK/i;

export function hasInjectedCode(body = "") {
  return INJECTED_CODE_RE.test(String(body ?? ""));
}
