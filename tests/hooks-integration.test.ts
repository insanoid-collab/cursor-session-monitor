import Database from 'better-sqlite3';
import Fastify from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { registerRoutes } from '../src/api/routes';
import { SessionManager } from '../src/services/session-manager';
import { TelegramNotificationService } from '../src/services/telegram-notification-service';
import { Notifier, SendResult } from '../src/services/notifier/telegram-notifier';
import { AppConfig } from '../src/config';

class FakeNotifier implements Notifier {
  public messages: string[] = [];
  async send(message: string): Promise<SendResult> {
    this.messages.push(message);
    return { messageId: this.messages.length };
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

const config: AppConfig = {
  service: { host: '0.0.0.0', port: 9876, logLevel: 'info' },
  database: { path: ':memory:' },
  telegram: {
    enabled: true,
    botToken: 'test-token',
    chatId: 'test-chat',
    notifyOn: {
      sessionStart: false,
      sessionEnd: true,
      fileEdit: false,
      shellCommand: false,
      attentionNeeded: true,
    },
    thresholds: {
      fileEditBatchIntervalSeconds: 60,
      fileEditMinEvents: 2,
      shellBatchIntervalSeconds: 60,
      shellMinEvents: 2,
    },
    dangerousCommands: ['rm -rf', 'sudo'],
    polling: { enabled: false, intervalMs: 3000 },
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

  it('sends danger and completion notifications with project context', async () => {
    await app.inject({
      method: 'POST',
      url: '/hooks/cursor/afterFileEdit',
      payload: { hook_event_name: 'afterFileEdit', conversation_id: 's1', file_path: '/projects/myapp/src/app.ts', workspace_roots: ['/projects/myapp'] },
    });

    await app.inject({
      method: 'POST',
      url: '/hooks/cursor/afterFileEdit',
      payload: { hook_event_name: 'afterFileEdit', conversation_id: 's1', file_path: '/projects/myapp/src/utils.ts', workspace_roots: ['/projects/myapp'] },
    });

    const shellRes = await app.inject({
      method: 'POST',
      url: '/hooks/cursor/beforeShellExecution',
      payload: { hook_event_name: 'beforeShellExecution', conversation_id: 's1', command: 'sudo rm -rf /tmp', cwd: '/projects/myapp' },
    });
    expect(shellRes.statusCode).toBe(200);
    expect(shellRes.json().flagged).toBe(true);

    const stopRes = await app.inject({
      method: 'POST',
      url: '/hooks/cursor/stop',
      payload: { hook_event_name: 'stop', conversation_id: 's1' },
    });
    expect(stopRes.statusCode).toBe(200);

    // Dangerous command notification with project name
    const dangerMsg = notifier.messages.find((m) => m.includes('Attention Required'));
    expect(dangerMsg).toBeDefined();
    expect(dangerMsg).toContain('myapp');
    expect(dangerMsg).toContain('sudo rm -rf /tmp');

    // Completion notification with project context and file count (no individual files)
    const completeMsg = notifier.messages.find((m) => m.includes('Session Complete'));
    expect(completeMsg).toBeDefined();
    expect(completeMsg).toContain('myapp');
    expect(completeMsg).toContain('Files: 2');
    expect(completeMsg).toContain('projects/myapp');

    // No spammy notifications
    expect(notifier.messages.length).toBe(2);
  });

  it('includes agent response text in completion notification', async () => {
    await app.inject({
      method: 'POST',
      url: '/hooks/cursor/afterFileEdit',
      payload: { hook_event_name: 'afterFileEdit', conversation_id: 's2', file_path: '/projects/myapp/src/index.ts', workspace_roots: ['/projects/myapp'] },
    });

    await app.inject({
      method: 'POST',
      url: '/hooks/cursor/afterAgentResponse',
      payload: { hook_event_name: 'afterAgentResponse', conversation_id: 's2', text: 'I have updated the index file with the new route handler.' },
    });

    await app.inject({
      method: 'POST',
      url: '/hooks/cursor/stop',
      payload: { hook_event_name: 'stop', conversation_id: 's2' },
    });

    const completeMsg = notifier.messages.find((m) => m.includes('Session Complete'));
    expect(completeMsg).toBeDefined();
    expect(completeMsg).toContain('updated the index file');
  });
});
