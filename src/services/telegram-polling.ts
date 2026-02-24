import axios from 'axios';
import { logger } from '../utils/logger';
import { TelegramMessageStore, ConversationInfo } from './telegram-message-store';
import type { PendingQuestion } from './cursor-conversations';
import { resumeConversation } from './cursor-cli';
import { appendToConversation, submitQuestionAnswer, QuestionAnswer } from './cursor-memory';
import Database from 'better-sqlite3';

const OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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

/**
 * Parse a Telegram reply into structured question answers.
 *
 * Supported formats:
 *   "A"       → single question, option A
 *   "A B"     → two questions, option A for first, B for second
 *   "1A 2B"   → explicit question numbering
 *   "1A, 2B"  → with separator
 *   anything else → free text (returns null)
 */
function parseAnswerText(
  text: string,
  questions: PendingQuestion[],
): QuestionAnswer[] | null {
  const trimmed = text.trim().toUpperCase();
  if (!trimmed) return null;

  // Try "1A 2B" or "1A, 2B" format (explicit question numbering)
  const numberedPattern = /(\d+)\s*([A-Z])/g;
  const numbered: { qIdx: number; letter: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = numberedPattern.exec(trimmed)) !== null) {
    numbered.push({ qIdx: parseInt(match[1], 10) - 1, letter: match[2] });
  }
  if (numbered.length > 0 && numbered.length <= questions.length) {
    const answers: QuestionAnswer[] = [];
    for (const { qIdx, letter } of numbered) {
      if (qIdx < 0 || qIdx >= questions.length) return null;
      const optIdx = letter.charCodeAt(0) - 'A'.charCodeAt(0);
      const q = questions[qIdx];
      if (optIdx < 0 || optIdx >= q.options.length) return null;
      answers.push({ questionId: q.id, selectedOptionId: q.options[optIdx].id });
    }
    return answers;
  }

  // Try space-separated letters: "A B" or "A, B" or just "A"
  const letters = trimmed
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(s => /^[A-Z]$/.test(s));

  if (letters.length > 0 && letters.length <= questions.length) {
    const answers: QuestionAnswer[] = [];
    for (let i = 0; i < letters.length; i++) {
      const optIdx = letters[i].charCodeAt(0) - 'A'.charCodeAt(0);
      const q = questions[i];
      if (optIdx < 0 || optIdx >= q.options.length) return null;
      answers.push({ questionId: q.id, selectedOptionId: q.options[optIdx].id });
    }
    return answers;
  }

  return null;
}

/** Format selected answers as human-readable text for the agent prompt. */
function formatAnswersForAgent(
  answers: QuestionAnswer[],
  questions: PendingQuestion[],
): string {
  const qMap = new Map(questions.map(q => [q.id, q]));
  const parts: string[] = [];
  for (const a of answers) {
    const q = qMap.get(a.questionId);
    if (!q) continue;
    const opt = q.options.find(o => o.id === a.selectedOptionId);
    parts.push(`Q: "${q.prompt}" → "${opt?.label ?? a.selectedOptionId}"`);
  }
  return parts.join('\n');
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
      await this.handleConversationReply(msg, convInfo);
      return;
    }

    // Fallback: session-based mapping
    const sessionId = this.messageStore.getSessionId(replyToId);

    if (!sessionId) {
      logger.info(`no mapping for telegram message ${replyToId}`);
      return;
    }

    logger.info(`telegram reply for session ${sessionId}: ${msg.text.slice(0, 50)}`);
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

  private async handleConversationReply(
    msg: NonNullable<TelegramUpdate['message']>,
    convInfo: ConversationInfo,
  ): Promise<void> {
    logger.info(`telegram reply for conversation ${convInfo.conversationId}: ${msg.text!.slice(0, 50)}`);

    // If this notification had structured questions, try to parse the answer
    if (convInfo.questions.length > 0 && convInfo.bubbleId) {
      const answers = parseAnswerText(msg.text!, convInfo.questions);

      if (answers) {
        // Write structured answer to Cursor's DB
        const wrote = submitQuestionAnswer(convInfo.conversationId, convInfo.bubbleId, answers);
        const summary = answers.map((a, i) => {
          const q = convInfo.questions[i];
          const letter = OPTION_LETTERS[q?.options.findIndex(o => o.id === a.selectedOptionId) ?? 0];
          const opt = q?.options.find(o => o.id === a.selectedOptionId);
          return `${i + 1}. ${letter}: ${opt?.label?.slice(0, 40) ?? a.selectedOptionId}`;
        }).join('\n');

        if (wrote) {
          await this.sendReply(msg.message_id, `✅ Answer submitted\n\n${this.escHtml(summary)}`);
        } else {
          await this.sendReply(msg.message_id, '⚠️ Could not write answer to Cursor DB, sending as text...');
        }

        // Also resume the conversation so the agent continues
        const agentPrompt = formatAnswersForAgent(answers, convInfo.questions);
        resumeConversation(convInfo.conversationId, agentPrompt, convInfo.workspacePath, async (result) => {
          if (result.success && result.output) {
            const text = result.output.length > 4000
              ? result.output.slice(0, 4000) + '…'
              : result.output;
            const sent = await this.sendReply(msg!.message_id, `🤖 Agent continued:\n\n<blockquote expandable>${this.escHtml(text)}</blockquote>`);
            if (sent?.messageId) {
              this.messageStore.saveConversationMapping(sent.messageId, convInfo.conversationId, convInfo.workspacePath);
            }
          }
        });
        return;
      }
    }

    // Free-text reply (no structured question, or couldn't parse)
    await this.sendReply(msg.message_id, '⏳ Running...');

    resumeConversation(convInfo.conversationId, msg.text!, convInfo.workspacePath, async (result) => {
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
