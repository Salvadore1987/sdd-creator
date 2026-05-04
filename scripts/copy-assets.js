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

// Make the CLI entrypoint executable so `node dist/cli.js` and direct
// invocation work without npm's bin-link auto-chmod.
const CLI_ENTRY = path.join(__dirname, '..', 'dist', 'cli.js');
if (fs.existsSync(CLI_ENTRY)) {
  fs.chmodSync(CLI_ENTRY, 0o755);
  console.log('Made dist/cli.js executable (0o755)');
}
