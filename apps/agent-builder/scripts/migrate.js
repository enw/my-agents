const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/agents.db');
const migrationsDir = path.join(__dirname, '../drizzle');

// Ensure database exists
if (!fs.existsSync(dbPath)) {
  console.error('Database not found at:', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

// Get all SQL migration files, sorted
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.log('No migration files found');
  process.exit(0);
}

console.log(`Found ${files.length} migration file(s)`);

// Track applied migrations in a table
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    filename TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )
`);

let applied = 0;
let skipped = 0;

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  
  // Check if already applied
  const existing = db.prepare('SELECT filename FROM _migrations WHERE filename = ?').get(file);
  if (existing) {
    console.log(`⊘ Skipped (already applied): ${file}`);
    skipped++;
    continue;
  }

  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    db.exec(sql);
    
    // Record migration
    db.prepare('INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)')
      .run(file, Date.now());
    
    console.log(`✓ Applied migration: ${file}`);
    applied++;
  } catch (error) {
    // Check if it's a "table already exists" error (might have been applied manually)
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log(`⊘ Skipped (already exists): ${file}`);
      // Record it anyway so we don't try again
      db.prepare('INSERT OR IGNORE INTO _migrations (filename, applied_at) VALUES (?, ?)')
        .run(file, Date.now());
      skipped++;
    } else {
      console.error(`✗ Error applying ${file}:`, error.message);
      db.close();
      process.exit(1);
    }
  }
}

db.close();

console.log(`\nMigration complete: ${applied} applied, ${skipped} skipped`);





