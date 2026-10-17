// One-off: builds the install icons from the white logo. Run `node scripts/make-icons.mjs`
// after changing public/logo-white.png; the PNGs it writes are committed.
import sharp from "sharp";

const GREEN = "#075B43";
const SRC = "public/logo-white.png";

async function icon(size, logoShare, out, radius = 0) {
  const logo = await sharp(SRC).resize({ width: Math.round(size * logoShare), height: Math.round(size * logoShare), fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  const bg = radius
    ? Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${GREEN}"/></svg>`)
    : { create: { width: size, height: size, channels: 4, background: GREEN } };
  const base = radius ? sharp(bg) : sharp(bg);
  await base.composite([{ input: logo, gravity: "center" }]).png().toFile(out);
  console.log(out);
}

// "any" icons: logo fills ~62 %. Maskable: logo inside the 80 % safe zone (~50 %), full bleed.
await icon(192, 0.62, "public/icons/icon-192.png");
await icon(512, 0.62, "public/icons/icon-512.png");
await icon(512, 0.5, "public/icons/maskable-512.png");
await icon(180, 0.6, "public/icons/apple-touch-icon.png");
await icon(64, 0.66, "public/icons/favicon-64.png", 14);
