import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const defaultDbPath = path.join(process.cwd(), 'data', 'sessions.db');

export function createDb(dbPath = process.env.DB_PATH ?? defaultDbPath): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

export function runMigrations(db: Database.Database): void {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const fallback = path.join(process.cwd(), 'src', 'database', 'schema.sql');
  const sqlPath = fs.existsSync(schemaPath) ? schemaPath : fallback;
  const sql = fs.readFileSync(sqlPath, 'utf8');
  db.exec(sql);
}
