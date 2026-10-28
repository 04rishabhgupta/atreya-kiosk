// Measures gzipped first-load JS for "/" by reading the prerendered HTML's <script> tags,
// and the size of the lazily loaded camera chunk. Run after `npm run build`.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = fileURLToPath(new URL("..", import.meta.url)); // URL.pathname gives "/C:/..." on Windows
const html = readFileSync(join(root, ".next/server/app/index.html"), "utf8");
const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

// noModule scripts (legacy polyfills) are never downloaded by module-capable browsers.
const tags = [...html.matchAll(/<script[^>]+src="\/_next\/([^"]+)"[^>]*>/g)];
const legacy = tags.filter((m) => /nomodule/i.test(m[0])).map((m) => m[1]);
const srcs = [...new Set(tags.filter((m) => !/nomodule/i.test(m[0])).map((m) => m[1]))];
let first = 0;
const rows = [];
for (const src of srcs) {
  const buf = readFileSync(join(root, ".next", src.split("?")[0]));
  const size = gz(buf);
  first += size;
  rows.push([src.replace(/^static\/chunks\//, ""), size]);
}
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].reduce((n, m) => n + gz(Buffer.from(m[1])), 0);

const chunkDir = join(root, ".next/static/chunks");
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const camera = walk(chunkDir)
  .filter((f) => f.endsWith(".js"))
  .map((f) => ({ f, buf: readFileSync(f) }))
  .filter(({ buf }) => buf.includes("willReadFrequently") && buf.includes("getUserMedia"));

console.log("First-load JS for / (gzip -9):");
for (const [name, size] of rows.sort((a, b) => b[1] - a[1])) console.log(`  ${kb(size).padStart(9)}  ${name}`);
console.log(`  ${kb(inline).padStart(9)}  (inline RSC payload scripts)`);
console.log(`  ---------\n  ${kb(first).padStart(9)}  external scripts total`);
console.log(`  ${kb(first + inline).padStart(9)}  including inline scripts`);
for (const src of legacy) console.log(`\nSkipped (noModule, legacy browsers only): ${kb(gz(readFileSync(join(root, ".next", src))))}  ${src}`);
for (const { f, buf } of camera) console.log(`\nLazy camera chunk: ${kb(gz(buf))}  ${f.replace(chunkDir + "/", "")}`);
