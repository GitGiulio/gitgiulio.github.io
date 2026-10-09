// Render NASA's equirectangular LROC map as a small globe under the room's lamp.
// Run with the bundled Node/Sharp setup. Source and credits: site/media/moon-source.md.
const sharp = require('sharp');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const media = path.join(__dirname, '../site/media');
  const { data, info } = await sharp(path.join(media, 'moon-lroc-color.jpg')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const size = 256;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x + .5) / size * 2 - 1;
    const ny = (y + .5) / size * 2 - 1;
    const radius = nx * nx + ny * ny;
    if (radius >= 1) continue;
    const nz = Math.sqrt(1 - radius);
    // Tilt the map 15 degrees, retaining the familiar near-side maria.
    const mx = nx * .966 - ny * .259;
    const my = nx * .259 + ny * .966;
    const u = .5 + Math.atan2(mx, nz) / (2 * Math.PI);
    const v = .5 + Math.asin(my) / Math.PI;
    const sx = Math.min(info.width - 1, Math.floor(u * info.width));
    const sy = Math.min(info.height - 1, Math.floor(v * info.height));
    const source = (sy * info.width + sx) * info.channels;
    const target = (y * size + x) * 4;
    const light = .32 + .58 * Math.max(0, -.58 * nx + .68 * ny + .45 * nz);
    for (let c = 0; c < 3; c++) pixels[target + c] = Math.round(data[source + c] * light * [1, .88, .73][c]);
    pixels[target + 3] = Math.round(255 * Math.min(1, (1 - Math.sqrt(radius)) * size / 2));
  }
  assert.equal(pixels[3], 0, 'The globe corners must remain transparent.');
  assert.equal(pixels[(size / 2 * size + size / 2) * 4 + 3], 255, 'The lunar surface must fill the globe centre.');
  const left = (192 * size + 64) * 4;
  const right = (64 * size + 192) * 4;
  assert.ok(pixels[left] > pixels[right], 'The lower-left lamp must illuminate the globe more than the upper-right shadow.');
  await sharp(pixels, { raw: { width: size, height: size, channels: 4 } }).png().toFile(path.join(media, 'moon-globe.png'));
  console.log('Rendered moon-globe.png from the NASA LROC map.');
})().catch(error => { console.error(error); process.exitCode = 1; });
