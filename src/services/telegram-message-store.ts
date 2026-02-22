import Database from 'better-sqlite3';

export class TelegramMessageStore {
  constructor(private readonly db: Database.Database) {}

  saveMapping(telegramMessageId: number, sessionId: string): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO telegram_messages (telegram_message_id, session_id, created_at)
         VALUES (?, ?, ?)`,
      )
      .run(telegramMessageId, sessionId, new Date().toISOString());
  }

  getSessionId(telegramMessageId: number): string | null {
    const row = this.db
      .prepare('SELECT session_id FROM telegram_messages WHERE telegram_message_id = ?')
      .get(telegramMessageId) as { session_id: string } | undefined;
    return row?.session_id ?? null;
  }
}
