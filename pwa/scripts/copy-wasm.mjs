/**
 * Copies the WebAssembly binaries the WASM backend needs into public/wasm/,
 * so they are served from this app's own origin instead of a CDN (the library
 * defaults to jsdelivr if setWasmPaths() is not pointed at a local folder,
 * which would break offline use and add a network dependency this app must
 * not have).
 *
 * Run once with:  node scripts/copy-wasm.mjs
 * The files it writes are committed, like the generated icons in
 * scripts/make-icons.mjs, so this only needs re-running if
 * @tensorflow/tfjs-backend-wasm is upgraded to a new version.
 *
 * Three variants are shipped, and tfjs-backend-wasm itself picks the right one
 * at runtime (see setWasmPaths() in src/lib/backend.js):
 *   tfjs-backend-wasm.wasm                plain, works everywhere
 *   tfjs-backend-wasm-simd.wasm           faster: used when the device supports SIMD
 *   tfjs-backend-wasm-threaded-simd.wasm  fastest: also needs cross-origin isolation
 */
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';

const SRC = 'node_modules/@tensorflow/tfjs-backend-wasm/dist';
const DEST = 'public/wasm';

mkdirSync(DEST, { recursive: true });

const files = readdirSync(SRC).filter((name) => name.endsWith('.wasm'));
for (const name of files) {
  copyFileSync(`${SRC}/${name}`, `${DEST}/${name}`);
  console.log(`wrote ${DEST}/${name}`);
}
