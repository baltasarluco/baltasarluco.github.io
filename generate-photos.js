#!/usr/bin/env node
// Run this whenever you add new photos to assets/img/photos/:
//   node generate-photos.js
//
// 1. Rebuilds assets/img/photos/manifest.json (list of originals).
// 2. Creates the web-sized copies the site actually serves, when missing:
//      thumbs/<name>.webp  1000px wide  (collage grid)
//      large/<name>.webp   2000px wide  (lightbox)
//    Needs `cwebp` and `dwebp` (brew install webp / port install webp).

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dir     = path.join(__dirname, 'assets/img/photos');
const outFile = path.join(dir, 'manifest.json');
const sizes   = { thumbs: { width: 1000, q: 76 }, large: { width: 2000, q: 80 } };

const files = fs.readdirSync(dir)
  .filter(f => /\.(jpg|jpeg|JPG|JPEG|webp|png|PNG)$/.test(f))
  .filter(f => fs.statSync(path.join(dir, f)).isFile())
  .sort();

fs.writeFileSync(outFile, JSON.stringify({ photos: files }, null, 2));
console.log(`✓ manifest.json updated — ${files.length} files listed.`);

function has(cmd){ try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch { return false; } }
if (!has('cwebp') || !has('dwebp')) {
  console.warn('! cwebp/dwebp not found — skipped generating thumbs/ and large/. Install the webp tools and re-run.');
  process.exit(0);
}

let made = 0;
for (const [sub, { width, q }] of Object.entries(sizes)) {
  const outDir = path.join(dir, sub);
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of files) {
    const src = path.join(dir, f);
    const out = path.join(outDir, f.replace(/\.[^.]+$/, '.webp'));
    if (fs.existsSync(out)) continue;
    let input = src;
    if (/\.webp$/i.test(f)) {           // cwebp does not read webp: decode first
      input = path.join(require('os').tmpdir(), `gp-${process.pid}.png`);
      execFileSync('dwebp', ['-quiet', src, '-o', input]);
    }
    execFileSync('cwebp', ['-quiet', '-mt', '-q', String(q), '-resize', String(width), '0', input, '-o', out]);
    if (input !== src) fs.unlinkSync(input);
    made++;
  }
}
console.log(made ? `✓ generated ${made} resized copies.` : '✓ thumbs/ and large/ already up to date.');
