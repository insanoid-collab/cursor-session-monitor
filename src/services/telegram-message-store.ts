import Database from 'better-sqlite3';
import type { PendingQuestion } from './cursor-conversations';

export interface ConversationInfo {
  conversationId: string;
  workspacePath: string;
  bubbleId: string | null;
  questions: PendingQuestion[];
}

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

  saveConversationMapping(
    telegramMessageId: number,
    conversationId: string,
    workspacePath: string,
    bubbleId?: string | null,
    questions?: PendingQuestion[],
  ): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO telegram_messages
         (telegram_message_id, conversation_id, workspace_path, bubble_id, questions_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        telegramMessageId,
        conversationId,
        workspacePath,
        bubbleId ?? null,
        questions && questions.length > 0 ? JSON.stringify(questions) : null,
        new Date().toISOString(),
      );
  }

  getConversationInfo(telegramMessageId: number): ConversationInfo | null {
    const row = this.db
      .prepare(
        'SELECT conversation_id, workspace_path, bubble_id, questions_json FROM telegram_messages WHERE telegram_message_id = ?',
      )
      .get(telegramMessageId) as {
        conversation_id: string;
        workspace_path: string;
        bubble_id: string | null;
        questions_json: string | null;
      } | undefined;
    if (!row?.conversation_id) return null;

    let questions: PendingQuestion[] = [];
    if (row.questions_json) {
      try { questions = JSON.parse(row.questions_json); } catch { /* ignore */ }
    }

    return {
      conversationId: row.conversation_id,
      workspacePath: row.workspace_path,
      bubbleId: row.bubble_id,
      questions,
    };
  }
}
