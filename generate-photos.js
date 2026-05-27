#!/usr/bin/env node
// Run this whenever you add new photos to assets/img/photos/:
//   node generate-photos.js

const fs   = require('fs');
const path = require('path');

const dir      = path.join(__dirname, 'assets/img/photos');
const outFile  = path.join(dir, 'manifest.json');

const files = fs.readdirSync(dir)
  .filter(f => /\.(jpg|jpeg|JPG|JPEG|webp|png|PNG)$/.test(f))
  .sort();

fs.writeFileSync(outFile, JSON.stringify({ photos: files }, null, 2));
console.log(`✓ manifest.json updated — ${files.length} files listed.`);
files.forEach(f => console.log('  ', f));
