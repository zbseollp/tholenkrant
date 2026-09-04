import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { isLikelyImageUrl, resolveUsableMediaUrl } from "./lib/media-url.mjs";

/** Payload media fields: plain path string or { url, filename, alt }. */
const imageField = z
  .union([
    z.string(),
    z
      .object({
        url: z.string().optional(),
        alt: z.string().optional(),
        filename: z.string().optional(),
      })
      .passthrough(),
  ])
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null) return undefined;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (!trimmed) return undefined;
      if (!isLikelyImageUrl(trimmed) && !trimmed.startsWith("/media/")) return undefined;
      return resolveUsableMediaUrl(trimmed) || undefined;
    }
    const url =
      (typeof v.url === "string" && v.url.trim()) ||
      (typeof v.filename === "string" && v.filename.trim()) ||
      "";
    if (!url) return undefined;
    if (!isLikelyImageUrl(url) && !url.startsWith("/media/")) return undefined;
    return resolveUsableMediaUrl(url) || undefined;
  });

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: z
    .object({
      title: z.string(),
      slug: z.string().optional(),
      date: z.coerce.date().optional(),
      pubDate: z.coerce.date().optional(),
      updatedDate: z.coerce.date().optional(),
      author: z.string().optional(),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      description: z.string().optional(),
      excerpt: z.string().optional(),
      categories: z.preprocess((value) => {
        if (value == null || value === "") return [];
        const items = Array.isArray(value) ? value : [value];
        return items.filter((item) => item != null && item !== "").map((item) => String(item));
      }, z.array(z.string()).default([])),
      tags: z.preprocess((value) => {
        if (value == null || value === "") return [];
        const items = Array.isArray(value) ? value : [value];
        return items.filter((item) => item != null && item !== "").map((item) => String(item));
      }, z.array(z.string()).default([])),
      featuredImage: imageField,
      featuredImageAlt: z.string().optional(),
      heroImage: imageField,
      image: imageField,
      extra: z
        .object({
          featuredImage: imageField,
          featuredImageAlt: z.string().optional(),
        })
        .passthrough()
        .optional(),
      homepageSafe: z.boolean().default(true),
      draft: z
        .union([z.boolean(), z.string()])
        .transform((v) => v === true || v === "true")
        .default(false),
      _status: z.string().optional(),
      publishStatus: z.string().optional(),
      breaking: z.boolean().optional(),
    })
    .transform((d) => {
      const featured =
        d.featuredImage ??
        d.extra?.featuredImage ??
        d.heroImage ??
        d.image ??
        undefined;
      const featuredAlt =
        d.featuredImageAlt ??
        d.extra?.featuredImageAlt ??
        (typeof d.heroImage === "object" && d.heroImage && "alt" in d.heroImage
          ? (d.heroImage as { alt?: string }).alt
          : undefined);

      const hero = d.heroImage ?? featured;

      return {
        ...d,
        date: d.date ?? d.pubDate ?? new Date(),
        pubDate: d.pubDate ?? d.date ?? new Date(),
        description: d.description ?? d.metaDescription ?? d.excerpt ?? "",
        featuredImage: featured,
        featuredImageAlt: featuredAlt,
        heroImage: hero,
      };
    }),
});

const pages = defineCollection({
  loader: glob({ base: "./src/content/pages", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    sourceUrl: z.string().optional(),
  }),
});

export const collections = { blog, pages };
