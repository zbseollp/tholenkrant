/**
 * Local / CI: pull blog markdown from Payload, then prepare:blog.
 * Requires .env.astropayload with PAYLOAD_URL, PAYLOAD_API_KEY, TENANT.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, "..");
const configPath = path.join(repoRoot, "astropayload.config.json");
const envPath = path.join(repoRoot, ".env.astropayload");

function loadEnv() {
  if (!existsSync(envPath)) {
    console.error("Create .env.astropayload with PAYLOAD_URL, PAYLOAD_API_KEY, TENANT");
    process.exit(1);
  }
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
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

loadEnv();

let tenant =
  process.env.TENANT ||
  process.env.PUBLIC_TENANT_SLUG ||
  "tholenkrant";
let blogPath = "src/content/blog";
if (existsSync(configPath)) {
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  if (cfg.tenantSlug) tenant = cfg.tenantSlug;
  if (cfg.blogContentPath) blogPath = cfg.blogContentPath;
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
  console.error(
    "Could not find astropayload platform (tenant-cli).\n" +
      "Set ASTROPAYLOAD_PLATFORM_ROOT, then: npm run sync:content",
  );
  process.exit(1);
}

console.log(`Syncing blog for tenant ${tenant} → ${blogPath}`);
const r = spawnSync(
  "pnpm",
  ["tenant-cli", "sync", "--slug", tenant, "--site", repoRoot, "--blog-path", blogPath],
  {
    cwd: platform,
    stdio: "inherit",
    env: { ...process.env, TENANT: tenant },
    shell: true,
  },
);
if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);

const prepare = spawnSync("npm", ["run", "prepare:blog"], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: true,
  env: process.env,
});
process.exit(prepare.status ?? 1);
