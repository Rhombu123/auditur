import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const websiteRoot = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(websiteRoot, "out");
const publicDir = join(websiteRoot, "..", "public");

if (!existsSync(outDir)) {
  console.error("Next.js out/ folder not found — build may have failed.");
  process.exit(1);
}

// Replace previous static export so stale chunks cannot keep serving placeholders.
mkdirSync(publicDir, { recursive: true });
for (const name of ["_next", "login", "signup", "dashboard", "404"]) {
  rmSync(join(publicDir, name), { recursive: true, force: true });
}
for (const name of ["index.html", "index.txt", "404.html", "login.html", "signup.html", "dashboard.html"]) {
  rmSync(join(publicDir, name), { force: true });
}

cpSync(outDir, publicDir, { recursive: true });
console.log("Copied website/out → public/ (replaced prior marketing export)");
