/**
 * Rehype plugin: fix Payload / R2 image URLs in rendered MDX body.
 */
import { visit } from "unist-util-visit";
import { resolveMediaUrl } from "./media-url.mjs";

export function rehypeRepairMediaUrls() {
  const env = typeof process !== "undefined" ? process.env : undefined;

  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "img") return;
      const props = node.properties;
      if (!props) return;

      if (typeof props.src === "string") {
        props.src = resolveMediaUrl(props.src, { env }) || props.src;
      }
      if (typeof props.srcSet === "string") {
        props.srcSet = props.srcSet
          .split(",")
          .map((part) => {
            const trimmed = part.trim();
            const space = trimmed.indexOf(" ");
            if (space === -1) {
              return resolveMediaUrl(trimmed, { env }) || trimmed;
            }
            const url =
              resolveMediaUrl(trimmed.slice(0, space), { env }) || trimmed.slice(0, space);
            return `${url}${trimmed.slice(space)}`;
          })
          .join(", ");
      }
    });
  };
}
