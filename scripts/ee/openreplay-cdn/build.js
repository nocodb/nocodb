#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Building OpenReplay CDN bundle...');

try {
  // Clean dist if exists
  if (fs.existsSync('dist')) fs.rmSync('dist', { recursive: true });

  console.log('🔨 Building...');
  execSync('npx rspack build', { stdio: 'inherit' });

  console.log(`✅ Built OpenReplay successfully!`);
  console.log(`📍 Output: ./dist/`);
  console.log(`📁 Files: or.min.js`);

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
