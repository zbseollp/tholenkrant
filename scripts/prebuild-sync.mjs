/**
 * Optional Payload sync before `astro build`.
 * After sync: normalize covers immediately so featured/hero never ship empty.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, "..");
const configPath = path.join(repoRoot, "astropayload.config.json");
const envPath = path.join(repoRoot, ".env.astropayload");

function loadEnvFile() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function isPlatformDir(dir) {
  if (!dir || !existsSync(path.join(dir, "package.json"))) return false;
  return (
    existsSync(path.join(dir, "packages/tenant-cli/package.json")) ||
    existsSync(path.join(dir, "pnpm-workspace.yaml")) ||
    existsSync(path.join(dir, "packages/payload-sdk/package.json"))
  );
}

loadEnvFile();

const payloadUrl = process.env.PAYLOAD_URL;
const hasAuth = Boolean(process.env.PAYLOAD_API_KEY || process.env.DEPLOY_REPORT_TOKEN);

let tenant =
  process.env.PUBLIC_TENANT_SLUG ||
  process.env.TENANT ||
  "tholenkrant";
let blogPath = "src/content/blog";

if (existsSync(configPath)) {
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  if (cfg.tenantSlug) tenant = cfg.tenantSlug;
  if (cfg.blogContentPath) blogPath = cfg.blogContentPath;
}

if (!payloadUrl || !hasAuth) {
  console.log("[prebuild-sync] Skipping Payload sync (no PAYLOAD_URL / API key).");
  process.exit(0);
}

const platform = [
  process.env.ASTROPAYLOAD_PLATFORM_ROOT,
  path.join(repoRoot, "platform"),
  path.join(repoRoot, "..", "platform"),
  path.join(repoRoot, ".."),
]
  .filter(Boolean)
  .find(isPlatformDir);

if (!platform) {
  console.log(
    "[prebuild-sync] Skipping Payload sync (astropayload platform not found).",
  );
  process.exit(0);
}

console.log(`[prebuild-sync] Syncing blog for ${tenant} from Payload…`);
const r = spawnSync(
  "pnpm",
  [
    "tenant-cli",
    "sync",
    "--slug",
    tenant,
    "--site",
    repoRoot,
    "--blog-path",
    blogPath,
    "--url",
    payloadUrl,
  ],
  {
    cwd: platform,
    stdio: "inherit",
    env: { ...process.env, TENANT: tenant, PAYLOAD_URL: payloadUrl },
    shell: true,
  },
);

if ((r.status ?? 1) !== 0) {
  console.error("[prebuild-sync] Sync failed — aborting build.");
  process.exit(r.status ?? 1);
}

// Full prepare right after Payload wipe/rewrite (covers + spam + verify).
const prepare = spawnSync("npm", ["run", "prepare:blog"], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: true,
  env: process.env,
});
if ((prepare.status ?? 1) !== 0) {
  console.error("[prebuild-sync] prepare:blog failed after sync.");
  process.exit(prepare.status ?? 1);
}

console.log("[prebuild-sync] Done.");
