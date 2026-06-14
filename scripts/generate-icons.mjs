import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

// Creates an SVG with the ₹ symbol on a violet gradient background.
// Content fits within the 80% safe zone so it works as both "any" and "maskable".
function iconSvg(size) {
  const fontSize = Math.round(size * 0.46);
  const textY = Math.round(size * 0.645);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#6d28d9"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <text
    x="${size / 2}"
    y="${textY}"
    font-family="'Segoe UI Symbol','Arial Unicode MS','Noto Sans',sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    fill="white"
    text-anchor="middle">&#x20B9;</text>
</svg>`;
}

const icons = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of icons) {
  const dest = join(publicDir, file);
  await sharp(Buffer.from(iconSvg(size))).png().toFile(dest);
  console.log(`✓ ${file} (${size}×${size})`);
}

console.log("Done — icons written to /public");
