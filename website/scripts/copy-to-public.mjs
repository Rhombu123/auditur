import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const websiteRoot = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(websiteRoot, "out");
const publicDir = join(websiteRoot, "..", "public");

if (!existsSync(outDir)) {
  console.error("Next.js out/ folder not found — build may have failed.");
  process.exit(1);
}

mkdirSync(publicDir, { recursive: true });
cpSync(outDir, publicDir, { recursive: true });
console.log("Copied website/out → public/");
