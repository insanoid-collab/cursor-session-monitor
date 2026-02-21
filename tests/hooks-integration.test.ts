import Database from 'better-sqlite3';
import Fastify from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { registerRoutes } from '../src/api/routes';
import { SessionManager } from '../src/services/session-manager';
import { TelegramNotificationService } from '../src/services/telegram-notification-service';
import { Notifier } from '../src/services/notifier/telegram-notifier';
import { AppConfig } from '../src/config';

class FakeNotifier implements Notifier {
  public messages: string[] = [];
  async send(message: string): Promise<void> {
    this.messages.push(message);
  }
}

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

const config: AppConfig = {
  service: { host: '0.0.0.0', port: 9876, logLevel: 'info' },
  database: { path: ':memory:' },
  telegram: {
    enabled: true,
    mode: 'openclaw',
    channel: 'telegram',
    target: 'telegram:test',
    account: 'codex',
    botToken: undefined,
    chatId: undefined,
    notifyOn: {
      sessionStart: true,
      sessionEnd: true,
      fileEdit: true,
      shellCommand: true,
      attentionNeeded: true,
    },
    thresholds: {
      fileEditBatchIntervalSeconds: 60,
      fileEditMinEvents: 2,
      shellBatchIntervalSeconds: 60,
      shellMinEvents: 2,
    },
    dangerousCommands: ['rm -rf', 'sudo'],
  },
  agents: { cursor: { sessionTimeoutMinutes: 120 } },
};

describe('hooks integration + notifier', () => {
  let app = Fastify();
  let notifier: FakeNotifier;

  beforeEach(async () => {
    app = Fastify();
    const db = setupDb();
    const manager = new SessionManager(db, { dangerousCommandPatterns: config.telegram.dangerousCommands });
    notifier = new FakeNotifier();
    const notifications = new TelegramNotificationService(notifier, config);
    await registerRoutes(app, manager, notifications);
  });

  it('sends start, danger, batched, and completion notifications', async () => {
    await app.inject({
      method: 'POST',
      url: '/hooks/cursor/afterFileEdit',
      payload: { event: 'afterFileEdit', sessionId: 's1', filePath: 'a.ts', cwd: '/tmp' },
    });

    await app.inject({
      method: 'POST',
      url: '/hooks/cursor/afterFileEdit',
      payload: { event: 'afterFileEdit', sessionId: 's1', filePath: 'b.ts', cwd: '/tmp' },
    });

    const shellRes = await app.inject({
      method: 'POST',
      url: '/hooks/cursor/beforeShellExecution',
      payload: { event: 'beforeShellExecution', sessionId: 's1', command: 'sudo rm -rf /tmp', cwd: '/tmp' },
    });
    expect(shellRes.statusCode).toBe(200);
    expect(shellRes.json().flagged).toBe(true);

    const stopRes = await app.inject({
      method: 'POST',
      url: '/hooks/cursor/stop',
      payload: { event: 'stop', sessionId: 's1' },
    });
    expect(stopRes.statusCode).toBe(200);

    expect(notifier.messages.some((m) => m.includes('Session Started'))).toBe(true);
    expect(notifier.messages.some((m) => m.includes('Needs Attention'))).toBe(true);
    expect(notifier.messages.some((m) => m.includes('Cursor Activity'))).toBe(true);
    expect(notifier.messages.some((m) => m.includes('Cursor Shell'))).toBe(true);
    expect(notifier.messages.some((m) => m.includes('Session Complete'))).toBe(true);
  });
});
