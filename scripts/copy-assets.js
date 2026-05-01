/* eslint-disable */
const fs = require('fs');
const path = require('path');

const SRC_TEMPLATES = path.join(__dirname, '..', 'src', 'templates');
const DIST_TEMPLATES = path.join(__dirname, '..', 'dist', 'templates');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(SRC_TEMPLATES, DIST_TEMPLATES);
console.log('Templates copied to dist/templates');
