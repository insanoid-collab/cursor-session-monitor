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

  saveConversationMapping(telegramMessageId: number, conversationId: string, workspacePath: string): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO telegram_messages (telegram_message_id, conversation_id, workspace_path, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(telegramMessageId, conversationId, workspacePath, new Date().toISOString());
  }

  getConversationInfo(telegramMessageId: number): { conversationId: string; workspacePath: string } | null {
    const row = this.db
      .prepare('SELECT conversation_id, workspace_path FROM telegram_messages WHERE telegram_message_id = ?')
      .get(telegramMessageId) as { conversation_id: string; workspace_path: string } | undefined;
    if (!row?.conversation_id) return null;
    return { conversationId: row.conversation_id, workspacePath: row.workspace_path };
  }
}
