# Wonenhuis.nl

The Wonenhuis.nl website — Dutch home & living blog. Migrated from
WordPress to Astro + Tailwind in 2026.

## Stack

- **Framework**: Astro 5 (static SSG), TypeScript strict
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/vite`)
- **Fonts**: Inter Variable + Playfair Display Variable, self-hosted via Fontsource
- **Content**: Astro content collection at `src/content/blog/` (109 posts as markdown)
- **Hosting**: Cloudflare Pages (deploys on push to `main`)
- **Analytics**: Google Analytics 4 (`G-HK1LKSFR33`), consent-gated
- **Contact form**: web3forms.com + hCaptcha (lazy-loaded)

## Develop

```sh
npm install      # install dependencies
npm run dev      # dev server at http://localhost:4321/
npm run build    # static build into ./dist/
npm run preview  # preview the built site
npm run check    # type-check
```

## Environment variables

Copy `.env.example` to `.env`, then fill in:

| Key | Purpose |
|-----|---------|
| `PUBLIC_GA_MEASUREMENT_ID` | GA4 property (already set: `G-HK1LKSFR33`) |
| `WEB3FORMS_ACCESS_KEY` | web3forms.com form key for the contact form |
| `PUBLIC_SITE_URL` | Production site URL (default `https://wonenhuis.nl`) |

The same vars must be set in Cloudflare Pages (Production + Preview).

## Project structure

```text
public/                 # static files served at root (favicon, robots, _redirects, _headers)
src/
  assets/               # processed by astro:assets (currently unused — see /public/assets/images)
  components/           # Header, Footer, Hero, Button, Card, BlogPostCard, SEO, CurrentYear, Analytics, CookieConsent, ContactForm
  content/
    blog/               # 109 blog post .md files (the content collection)
    config.ts           # content schema (zod)
  layouts/              # BaseLayout, BlogLayout
  lib/                  # site config + post helpers
  pages/                # routes — see Routing below
  styles/               # global.css (Tailwind + brand tokens)
migration/              # WP -> Astro migration scratch (source/ + output/ gitignored)
```

## Routing

| Route | Source | Notes |
|---|---|---|
| `/` | `src/pages/index.astro` | Homepage with latest 6 posts |
| `/blog/` | `src/pages/blog/index.astro` | Blog index |
| `/blog/<slug>/` | `src/pages/blog/[slug].astro` | Single blog post (109 generated) |
| `/blog/category/<slug>/` | `src/pages/blog/category/[category]/[...page].astro` | Paginated category (20/page) |
| `/over-ons/` | `src/pages/over-ons.astro` | About |
| `/contact/` | `src/pages/contact.astro` | Contact form |
| `/contact/thanks/` | `src/pages/contact/thanks.astro` | Submission confirmation (noindex) |
| `/sitemap/` | `src/pages/sitemap.astro` | HTML sitemap |
| `/sitemap-index.xml` | auto via `@astrojs/sitemap` | XML sitemap for search engines |
| `/404` | `src/pages/404.astro` | Branded 404 |

## Deployment

- **main branch** → production (auto-deploys to https://wonenhuis.nl)
- **preview branch** → staging (Cloudflare Pages preview URL)
- **feature branches** → preview deploy per PR

`public/_redirects` carries the legacy WP URL map (categories, dated archives,
old `_wp_old_slug` renames). `public/_headers` carries the security headers.

## Migration notes

The `migration/` folder holds the source materials and intermediate artifacts
(see `migration/README.md`). Raw WP exports and generated markdown are
gitignored — only the planning docs (`brand.md`, `analytics.md`, `lighthouse.md`,
`redirect_map.txt`, `source-urls.txt`) live in the repo for posterity.
