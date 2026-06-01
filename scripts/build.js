'use strict';

const fs = require('fs');
const path = require('path');

function build() {
  console.log('[Build] Starting build process...');

  const distPath = path.resolve(__dirname, '../dist');

  // 1. Clean existing dist directory
  if (fs.existsSync(distPath)) {
    console.log('[Build] Cleaning existing dist/ directory...');
    fs.rmSync(distPath, { recursive: true, force: true });
  }

  // 2. Create clean dist directory
  fs.mkdirSync(distPath, { recursive: true });
  console.log('[Build] Created clean dist/ directory.');

  // 3. Copy files/folders
  const targets = [
    { src: 'src', dest: 'src', isDir: true },
    { src: 'pipelines', dest: 'pipelines', isDir: true },
    { src: 'package.json', dest: 'package.json', isDir: false },
    { src: 'package-lock.json', dest: 'package-lock.json', isDir: false },
    { src: 'README.md', dest: 'README.md', isDir: false },
    { src: 'LICENSE', dest: 'LICENSE', isDir: false }
  ];

  for (const target of targets) {
    const srcPath = path.resolve(__dirname, '..', target.src);
    const destPath = path.resolve(distPath, target.dest);

    if (fs.existsSync(srcPath)) {
      if (target.isDir) {
        console.log(`[Build] Copying directory: ${target.src} -> dist/${target.dest}`);
        fs.cpSync(srcPath, destPath, { recursive: true });
      } else {
        console.log(`[Build] Copying file: ${target.src} -> dist/${target.dest}`);
        fs.copyFileSync(srcPath, destPath);
      }
    } else {
      console.warn(`[Build] Warning: Source path not found: ${target.src}`);
    }
  }

  console.log('[Build] Build process completed successfully!');
}

try {
  build();
} catch (error) {
  console.error('[Build] Build failed:', error.message);
  process.exit(1);
}
