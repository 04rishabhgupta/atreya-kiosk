// Copies the MediaPipe Vision WebAssembly runtime into public/ so it is served from our own origin
// (the CSP only allows 'self'). Runs before `dev` and `build`. The folder name carries the version,
// so the files can be cached as immutable; a version bump simply lands in a new folder.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const pkgDir = path.join(root, "node_modules", "@mediapipe", "tasks-vision");
const { version } = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));

// lib/config.ts must point at the same version, or the client would request a folder that doesn't exist.
const config = fs.readFileSync(path.join(root, "lib", "config.ts"), "utf8");
const configured = /MEDIAPIPE_VERSION = "([^"]+)"/.exec(config)?.[1];
if (configured !== version) {
  console.error(`copy-mediapipe: lib/config.ts MEDIAPIPE_VERSION is "${configured}" but ${version} is installed.`);
  process.exit(1);
}

const outDir = path.join(root, "public", "mediapipe", `wasm-${version}`);
fs.mkdirSync(outDir, { recursive: true });
// SIMD build for modern CPUs, plus the no-SIMD fallback; FilesetResolver picks one at runtime.
for (const f of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
  const src = path.join(pkgDir, "wasm", f);
  const dst = path.join(outDir, f);
  if (!fs.existsSync(dst) || fs.statSync(dst).size !== fs.statSync(src).size) fs.copyFileSync(src, dst);
}
console.log(`copy-mediapipe: runtime ${version} -> public/mediapipe/wasm-${version}`);
