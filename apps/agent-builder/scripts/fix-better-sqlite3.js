#!/usr/bin/env node

/**
 * Fix better-sqlite3 native bindings for pnpm monorepo
 * 
 * Builds better-sqlite3 native bindings directly in the pnpm store location.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find root node_modules (monorepo structure)
const rootDir = path.resolve(__dirname, '../../../');
const pnpmPath = path.join(rootDir, 'node_modules/.pnpm');

if (!fs.existsSync(pnpmPath)) {
  console.log('⚠️  pnpm structure not found, skipping fix');
  process.exit(0);
}

// Find all better-sqlite3 package directories
const betterSqlite3Dirs = fs.readdirSync(pnpmPath)
  .filter(dir => dir.startsWith('better-sqlite3@'))
  .map(dir => path.join(pnpmPath, dir, 'node_modules', 'better-sqlite3'))
  .filter(dir => fs.existsSync(dir));

if (betterSqlite3Dirs.length === 0) {
  console.log('⚠️  No better-sqlite3 packages found');
  process.exit(0);
}

let built = 0;
for (const betterDir of betterSqlite3Dirs) {
  const buildDir = path.join(betterDir, 'build', 'Release');
  const targetFile = path.join(buildDir, 'better_sqlite3.node');
  
  // Check if already built
  if (fs.existsSync(targetFile)) {
    console.log(`✅ Bindings already exist for ${path.basename(path.dirname(path.dirname(betterDir)))}`);
    built++;
    continue;
  }
  
  try {
    // Build better-sqlite3 in place using npm run build-release
    console.log(`🔨 Building better-sqlite3 for ${path.basename(path.dirname(path.dirname(betterDir)))}...`);
    
    execSync('npm run build-release', {
      cwd: betterDir,
      stdio: 'pipe',
      env: { 
        ...process.env, 
        npm_config_build_from_source: 'true'
      }
    });
    
    // Verify it was built
    if (fs.existsSync(targetFile)) {
      built++;
      console.log(`✅ Built bindings for ${path.basename(path.dirname(path.dirname(betterDir)))}`);
    } else {
      console.warn(`⚠️  Build completed but bindings not found at ${targetFile}`);
    }
  } catch (err) {
    console.warn(`⚠️  Failed to build bindings for ${betterDir}:`, err.message);
  }
}

if (built > 0) {
  console.log(`✅ Fixed better-sqlite3 bindings for ${built} package(s)`);
} else {
  console.log('⚠️  No better-sqlite3 bindings were built');
}
