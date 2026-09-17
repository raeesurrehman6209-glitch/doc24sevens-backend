const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'medifind.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

function columnExists(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

// Adds the reset-token columns to an already-existing database.
// schema.sql's CREATE TABLE IF NOT EXISTS won't touch tables that already
// exist, so new columns need to be added here, guarded so it's safe to
// run on every startup.
function runMigrations() {
  for (const table of ['patients', 'doctors']) {
    if (!columnExists(table, 'reset_token')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN reset_token TEXT`);
      console.log(`Migration: added reset_token to ${table}`);
    }
    if (!columnExists(table, 'reset_token_expires')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN reset_token_expires TEXT`);
      console.log(`Migration: added reset_token_expires to ${table}`);
    }
  }
}

function initSchema() {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  console.log(`Schema applied to ${DB_PATH}`);
  runMigrations();
}

// node:sqlite has no built-in .transaction() helper like better-sqlite3 did,
// so this wraps a block of work in BEGIN/COMMIT, rolling back on any error.
function withTransaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Allows `npm run init-db` to set up tables without starting the server
if (require.main === module && process.argv.includes('--init')) {
  initSchema();
}

module.exports = { db, initSchema, withTransaction };