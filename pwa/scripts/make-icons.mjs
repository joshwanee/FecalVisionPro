/**
 * Generates the app icons. Run once with:  node scripts/make-icons.mjs
 * The PNGs it writes to public/ are committed, so this only needs re-running
 * if the mark or colours change.
 *
 * The mark: a round dropping seen from above, inside four corner brackets, the
 * same "framing square" idea the capture screen uses.
 *
 * Two kinds of icon are needed:
 *   "any"       shown as-is (browser tab, install dialog, iOS home screen)
 *   "maskable"  Android crops it to a circle/squircle, so the artwork must sit
 *               inside the central 80% "safe zone" and the background must
 *               reach every edge.
 * Colours match --brand and --bg in src/tokens.css.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const FIELD = '#166a3f'; // --brand
const PAPER = '#f4f6f3'; // --bg

/** SVG of the mark on a 512x512 canvas. `scale` shrinks or grows the artwork. */
function markSvg(scale) {
  const c = 256; // centre
  const half = 118 * scale; // half the bracket square
  const arm = 62 * scale; // length of each bracket arm
  const t = 22 * scale; // line thickness
  const r = 62 * scale; // dropping radius
  const corner = (sx, sy) =>
    `<path d="M ${c + sx * half} ${c + sy * (half - arm)} L ${c + sx * half} ${c + sy * half} L ${c + sx * (half - arm)} ${c + sy * half}" />`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${FIELD}"/>
  <g fill="none" stroke="${PAPER}" stroke-width="${t}" stroke-linecap="square" stroke-linejoin="miter">
    ${corner(-1, -1)}${corner(1, -1)}${corner(-1, 1)}${corner(1, 1)}
  </g>
  <circle cx="${c}" cy="${c}" r="${r}" fill="${PAPER}"/>
</svg>`;
}

const anySvg = markSvg(1.3); // larger: it is not cropped
const maskableSvg = markSvg(1.0); // stays inside the safe zone

const outputs = [
  ['icon-192.png', anySvg, 192],
  ['icon-512.png', anySvg, 512],
  ['icon-192-maskable.png', maskableSvg, 192],
  ['icon-512-maskable.png', maskableSvg, 512],
  ['apple-touch-icon.png', anySvg, 180],
];

for (const [name, svg, size] of outputs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/${name}`);
  console.log('wrote public/' + name);
}

// The browser-tab icon is the same mark, kept as a tiny SVG.
writeFileSync('public/favicon.svg', anySvg);
console.log('wrote public/favicon.svg');
