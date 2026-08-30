import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const index = readFileSync(resolve(root, "index.html"), "utf8");
let failed = 0;
const check = (ok, name) => {
  console.log((ok ? "PASS " : "FAIL ") + name);
  if (!ok) failed++;
};

check(!/<style[ >]/i.test(index), "No inline style block");
check(!/<script(?![^>]*src=)[^>]*>/i.test(index), "No inline script block");

const refs = [...index.matchAll(/(?:src|href)="(\.\/[^"#?]+)(?:\?[^"]*)?"/g)].map(m => m[1]);
for (const ref of refs) {
  check(existsSync(resolve(root, ref.slice(2))), "Asset " + ref);
}
const jsRefs = refs.filter(x => x.endsWith(".js"));
for (const ref of jsRefs) {
  const file = resolve(root, ref.slice(2));
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  check(r.status === 0, "Syntax " + ref);
}

const allJs = jsRefs.map(ref => readFileSync(resolve(root, ref.slice(2)), "utf8")).join("\n");
for (const forbidden of [/\beval\s*\(/, /\bnew\s+Function\s*\(/, /\bchild_process\b/]) {
  check(!forbidden.test(allJs), "Forbidden API absent " + forbidden);
}

if (failed) process.exit(1);
console.log("All smoke tests passed.");
