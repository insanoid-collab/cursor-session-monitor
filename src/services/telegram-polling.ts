import axios from 'axios';
import { logger } from '../utils/logger';
import { TelegramMessageStore } from './telegram-message-store';
import { resumeConversation } from './cursor-cli';
import { appendToConversation } from './cursor-memory';
import Database from 'better-sqlite3';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    reply_to_message?: {
      message_id: number;
    };
  };
}

export class TelegramPollingService {
  private offset = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    private readonly token: string,
    private readonly chatId: string,
    private readonly messageStore: TelegramMessageStore,
    private readonly db: Database.Database,
    private readonly intervalMs: number = 3000,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('telegram polling started');
    this.poll();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info('telegram polling stopped');
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      const url = `https://api.telegram.org/bot${this.token}/getUpdates`;
      const res = await axios.get(url, {
        params: {
          offset: this.offset,
          timeout: 10,
          allowed_updates: JSON.stringify(['message']),
        },
        timeout: 15000,
      });

      const updates: TelegramUpdate[] = res.data?.result ?? [];

      for (const update of updates) {
        this.offset = update.update_id + 1;
        await this.handleUpdate(update);
      }
    } catch (err) {
      logger.error(`telegram polling error: ${String(err)}`);
    }

    if (this.running) {
      this.timer = setTimeout(() => this.poll(), this.intervalMs);
    }
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    const msg = update.message;
    if (!msg?.text) return;

    logger.info(`telegram message received: "${msg.text.slice(0, 80)}" (reply_to: ${msg.reply_to_message?.message_id ?? 'none'})`);

    if (!msg.reply_to_message) {
      logger.info('ignoring non-reply message');
      return;
    }

    const replyToId = msg.reply_to_message.message_id;

    // Check for conversation-based mapping (needs-input replies)
    const convInfo = this.messageStore.getConversationInfo(replyToId);
    if (convInfo) {
      logger.info(`telegram reply for conversation ${convInfo.conversationId}: ${msg.text.slice(0, 50)}`);
      await this.sendReply(msg.message_id, '⏳ Running...');

      resumeConversation(convInfo.conversationId, msg.text, convInfo.workspacePath, async (result) => {
        if (result.success && result.output) {
          const text = result.output.length > 4000
            ? result.output.slice(0, 4000) + '…'
            : result.output;
          const sent = await this.sendReply(msg!.message_id, `✅ Done\n\n<blockquote expandable>${this.escHtml(text)}</blockquote>`);
          if (sent?.messageId) {
            this.messageStore.saveConversationMapping(sent.messageId, convInfo.conversationId, convInfo.workspacePath);
          }
          appendToConversation(convInfo.conversationId, msg!.text!, result.output);
        } else if (!result.success) {
          await this.sendReply(msg!.message_id, `❌ Failed: ${this.escHtml(result.output.slice(0, 500))}`);
        }
      });
      return;
    }

    // Fallback: session-based mapping
    const sessionId = this.messageStore.getSessionId(replyToId);

    if (!sessionId) {
      logger.info(`no mapping for telegram message ${replyToId}`);
      return;
    }

    logger.info(`telegram reply for session ${sessionId}: ${msg.text.slice(0, 50)}`);

    // Acknowledge receipt
    await this.sendReply(msg.message_id, '⏳ Running...');

    const session = this.db
      .prepare('SELECT working_directory FROM sessions WHERE session_id = ?')
      .get(sessionId) as { working_directory: string | null } | undefined;

    resumeConversation(sessionId, msg.text, session?.working_directory, async (result) => {
      if (result.success && result.output) {
        const text = result.output.length > 4000
          ? result.output.slice(0, 4000) + '…'
          : result.output;
        const sent = await this.sendReply(msg!.message_id, `✅ Done\n\n<blockquote expandable>${this.escHtml(text)}</blockquote>`);
        if (sent?.messageId) {
          this.messageStore.saveMapping(sent.messageId, sessionId);
        }
        appendToConversation(sessionId, msg!.text!, result.output);
      } else if (!result.success) {
        await this.sendReply(msg!.message_id, `❌ Failed: ${this.escHtml(result.output.slice(0, 500))}`);
      }
    });
  }

  private async sendReply(replyToMessageId: number, text: string): Promise<{ messageId?: number } | null> {
    try {
      const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
      const res = await axios.post(url, {
        chat_id: this.chatId,
        text,
        parse_mode: 'HTML',
        reply_to_message_id: replyToMessageId,
        disable_web_page_preview: true,
      });
      return { messageId: res.data?.result?.message_id };
    } catch (err) {
      logger.error(`telegram reply failed: ${String(err)}`);
      return null;
    }
  }

  private escHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
