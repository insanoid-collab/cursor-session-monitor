import Database from 'better-sqlite3';
import { describe, expect, it, beforeEach } from 'vitest';
import { SessionManager } from '../src/services/session-manager';

function setupDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE sessions (
      session_id TEXT PRIMARY KEY,
      agent_type TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      last_activity TEXT,
      completed_at TEXT,
      working_directory TEXT,
      needs_attention INTEGER DEFAULT 0,
      attention_reason TEXT,
      last_response_text TEXT,
      metadata TEXT
    );
    CREATE TABLE events (
      event_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      payload TEXT NOT NULL,
      metadata TEXT
    );
    CREATE TABLE session_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      edit_count INTEGER DEFAULT 1,
      first_edit TEXT NOT NULL,
      last_edit TEXT NOT NULL,
      UNIQUE(session_id, file_path)
    );
    CREATE TABLE session_commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      command TEXT NOT NULL,
      executed_at TEXT NOT NULL,
      cwd TEXT,
      flagged INTEGER DEFAULT 0
    );
  `);
  return db;
}

describe('SessionManager', () => {
  let db: Database.Database;
  let manager: SessionManager;

  beforeEach(() => {
    db = setupDb();
    manager = new SessionManager(db);
  });

  it('creates session and tracks file edits', () => {
    manager.ingest({
      eventId: 'e1',
      sessionId: 's1',
      agentType: 'cursor',
      eventType: 'file_edit',
      timestamp: new Date().toISOString(),
      payload: {},
      metadata: { filePath: '/tmp/a.ts' },
    });

    const sessions = manager.listSessions();
    expect(sessions).toHaveLength(1);
    expect((sessions[0] as any).files_modified).toBe(1);
  });

  it('flags dangerous commands', () => {
    const result = manager.ingest({
      eventId: 'e2',
      sessionId: 's2',
      agentType: 'cursor',
      eventType: 'shell_exec',
      timestamp: new Date().toISOString(),
      payload: {},
      metadata: { command: 'sudo rm -rf /tmp', cwd: '/tmp' },
    });

    expect(result.flagged).toBe(true);
    const session = manager.getSession('s2') as any;
    expect(session.needs_attention).toBe(1);
  });
});
