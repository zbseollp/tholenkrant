import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

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
      categories: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
      featuredImage: z.string().optional(),
      featuredImageAlt: z.string().optional(),
      heroImage: z.union([z.string(), z.object({ url: z.string().optional(), alt: z.string().optional() }).passthrough()]).optional(),
      extra: z.object({ featuredImage: z.string().optional(), featuredImageAlt: z.string().optional() }).passthrough().optional(),
      homepageSafe: z.boolean().default(true),
      draft: z.union([z.boolean(), z.string()]).transform((v) => v === true || v === "true").default(false),
    })
    .transform((d) => ({
      ...d,
      date: d.date ?? d.pubDate ?? new Date(),
      pubDate: d.pubDate ?? d.date ?? new Date(),
      description: d.description ?? d.metaDescription ?? d.excerpt ?? "",
      featuredImage:
        d.featuredImage ??
        d.extra?.featuredImage ??
        (typeof d.heroImage === "string" ? d.heroImage : d.heroImage?.url) ??
        undefined,
      featuredImageAlt: d.featuredImageAlt ?? d.extra?.featuredImageAlt,
    })),
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

