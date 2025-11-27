#!/usr/bin/env node

/**
 * Fix better-sqlite3 native bindings for pnpm
 * 
 * pnpm blocks build scripts by default, so we need to copy the bindings file
 * from .ignored to the actual package location after installation.
 */

const fs = require('fs');
const path = require('path');

const ignoredPath = path.join(__dirname, '../node_modules/.ignored/better-sqlite3/build/Release/better_sqlite3.node');

if (!fs.existsSync(ignoredPath)) {
  console.log('⚠️  better-sqlite3 bindings not found in .ignored, skipping fix');
  process.exit(0);
}

// Find all better-sqlite3 package directories
const pnpmPath = path.join(__dirname, '../node_modules/.pnpm');
if (!fs.existsSync(pnpmPath)) {
  console.log('⚠️  pnpm structure not found, skipping fix');
  process.exit(0);
}

const betterSqlite3Dirs = fs.readdirSync(pnpmPath)
  .filter(dir => dir.startsWith('better-sqlite3@'))
  .map(dir => path.join(pnpmPath, dir, 'node_modules', 'better-sqlite3'));

let copied = 0;
for (const betterDir of betterSqlite3Dirs) {
  if (!fs.existsSync(betterDir)) continue;
  
  const targetDir = path.join(betterDir, 'build', 'Release');
  const targetFile = path.join(targetDir, 'better_sqlite3.node');
  
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(ignoredPath, targetFile);
    copied++;
    console.log(`✅ Fixed bindings for ${path.basename(path.dirname(path.dirname(betterDir)))}`);
  } catch (err) {
    console.warn(`⚠️  Failed to copy bindings to ${betterDir}:`, err.message);
  }
}

if (copied > 0) {
  console.log(`✅ Fixed better-sqlite3 bindings for ${copied} package(s)`);
} else {
  console.log('⚠️  No better-sqlite3 packages found to fix');
}

