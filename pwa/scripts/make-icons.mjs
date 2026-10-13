/**
 * Generates the app icons from the logo. Run once with:  node scripts/make-icons.mjs
 * The files it writes to public/ are committed, so this only needs re-running
 * if the logo changes.
 *
 * Source: scripts/logo-source.svg, a 572x526 trace of the logo: a rounded
 * green tile with the chicken emblem. The trace also caught a black drop
 * shadow around the tile and cuts its bottom edge off, so the icons use a
 * square cut from the middle of the tile (CROP), clear of the shadow, the cut
 * edge and the tile's rounded corners. Re-measure CROP if the logo changes.
 *
 * Icons needed:
 *   "any"       shown as-is (browser tab, install dialog): the crop with
 *               rounded corners, transparent outside them
 *   "maskable"  Android crops it to its own circle/squircle, so the background
 *               must reach every edge and the emblem must sit in the central
 *               80% safe zone (the emblem's dashed ring is ~74% of the crop)
 *   apple-touch iOS rounds the corners itself and fills transparency with
 *               black, so it gets the full square too
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'scripts/logo-source.svg';
const CROP = { x: 75, y: 75, size: 420 }; // in the source's own pixels
// The browser tab shows the icon at 16-32 px, where the full crop turns to
// mush; it gets a tighter crop so the chicken itself is bigger.
const TAB_CROP = { x: 140, y: 140, size: 290 };
const RADIUS = 0.22; // corner radius of the "any" icons, as a share of the side
const RENDER = 3; // render the source at 3x so every output is downscaled

const source = readFileSync(SOURCE);
const cut = (crop) =>
  sharp(source, { density: 72 * RENDER })
    .extract({
      left: crop.x * RENDER,
      top: crop.y * RENDER,
      width: crop.size * RENDER,
      height: crop.size * RENDER,
    })
    .png()
    .toBuffer();
const big = await cut(CROP);
const tab = await cut(TAB_CROP);

const square = (size, from = big) => sharp(from).resize(size, size).png();

const rounded = async (size, from = big) => {
  const r = Math.round(size * RADIUS);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`,
  );
  const img = await square(size, from).toBuffer();
  return sharp(img).composite([{ input: mask, blend: 'dest-in' }]).png();
};

const outputs = [
  ['icon-192.png', () => rounded(192)],
  ['icon-512.png', () => rounded(512)],
  ['favicon-32.png', () => rounded(32, tab)],
  ['icon-192-maskable.png', () => square(192)],
  ['icon-512-maskable.png', () => square(512)],
  ['apple-touch-icon.png', () => square(180)],
];

for (const [name, make] of outputs) {
  await (await make()).toFile(`public/${name}`);
  console.log('wrote public/' + name);
}

// The browser-tab icon: the tab crop, kept as vector. The source's paths are
// reused as they are; the viewBox picks the crop and a clip rounds the corners.
const paths = source
  .toString()
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '');
const { x, y, size } = TAB_CROP;
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${size} ${size}">` +
    `<clipPath id="tile"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${Math.round(size * RADIUS)}"/></clipPath>` +
    `<g clip-path="url(#tile)">${paths}</g></svg>\n`,
);
console.log('wrote public/favicon.svg');
