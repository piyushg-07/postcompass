#!/usr/bin/env node
/**
 * Builds every app icon, rendering each size directly (no downscaling of one big image):
 *
 *   ≤ 48 px  →  generated per size on that size's own pixel grid (title bar, taskbar, Alt+Tab).
 *              Ring, needle and tile are measured in whole pixels for *that* size, so edges land
 *              on pixel boundaries instead of being smeared by antialiasing.
 *   ≥ 64 px  →  app-icon.svg, the detailed design (installer, Start menu, Explorer, Dock).
 *
 * Writes the PNGs listed in tauri.conf.json plus icon.ico with every size Windows asks for
 * (16/20/24 for 100/125/150% scaling, 32/40/48 for the taskbar, 64 and 256 for Explorer).
 * macOS icon.icns is still produced by `tauri icon`.
 *
 * Usage: pnpm icons
 */
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src-tauri", "icons");
const large = readFileSync(join(root, "app-icon.svg"), "utf8");

/** Up to this size the pixel-fitted design is used; above it, the detailed one. */
const SMALL_MAX = 48;

const roundHalf = (value) => Math.round(value * 2) / 2;

/**
 * The compass mark for one exact pixel size. The ring stroke is 1 px (2 px from 40 px up) and its
 * radius is chosen so both stroke edges fall exactly on pixel boundaries; the needle's width and
 * height are whole pixels; there is no center dot or border below 32 px, where they only smudge.
 */
function smallSvg(n) {
  const c = n / 2;
  const stroke = n >= 40 ? 2 : 1;
  const ring = Math.round(n * 0.34 + stroke / 2) - stroke / 2;
  const half = Math.round(n * 0.19);
  const tip = roundHalf(n * 0.1);
  const radius = roundHalf(n * 0.22);
  const detail =
    n >= 32
      ? `<rect x="0.5" y="0.5" width="${n - 1}" height="${n - 1}" rx="${radius - 0.5}" fill="none" stroke="#303030"/>` +
        `<circle cx="${c}" cy="${c}" r="${roundHalf(n * 0.045)}" fill="#121212"/>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 ${n} ${n}">
  <rect width="${n}" height="${n}" rx="${radius}" fill="#121212"/>
  <circle cx="${c}" cy="${c}" r="${ring}" fill="none" stroke="#525252" stroke-width="${stroke}"/>
  <path d="M${c} ${tip} L${c + half} ${c} L${c - half} ${c} Z" fill="#3ecf8e"/>
  <path d="M${c - half} ${c} L${c + half} ${c} L${c} ${n - tip} Z" fill="#f2f2f2"/>
  ${detail}
</svg>`;
}

function render(size) {
  // Small sizes render 1:1 from their own grid; large sizes scale the detailed design
  const svg = size <= SMALL_MAX ? smallSvg(size) : large;
  const fitTo = size <= SMALL_MAX ? { mode: "original" } : { mode: "width", value: size };
  return new Resvg(svg, { fitTo, shapeRendering: 2 }).render().asPng();
}

const pngs = {
  "32x32.png": 32,
  "64x64.png": 64,
  "128x128.png": 128,
  "128x128@2x.png": 256,
  "icon.png": 512,
  "StoreLogo.png": 50,
  "Square30x30Logo.png": 30,
  "Square44x44Logo.png": 44,
  "Square71x71Logo.png": 71,
  "Square89x89Logo.png": 89,
  "Square107x107Logo.png": 107,
  "Square142x142Logo.png": 142,
  "Square150x150Logo.png": 150,
  "Square284x284Logo.png": 284,
  "Square310x310Logo.png": 310,
};
for (const [file, size] of Object.entries(pngs)) {
  writeFileSync(join(out, file), render(size));
}

/** An .ico holding PNG images (supported since Windows Vista), one per size. */
function buildIco(sizes) {
  const images = sizes.map((size) => ({ size, data: render(size) }));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry); // 0 means 256
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2); // no palette
    header.writeUInt8(0, entry + 3); // reserved
    header.writeUInt16LE(1, entry + 4); // color planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

writeFileSync(join(out, "icon.ico"), buildIco([16, 20, 24, 32, 40, 48, 64, 256]));
console.log(`Icons written to ${out}`);
