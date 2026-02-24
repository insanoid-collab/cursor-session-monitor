import { AppConfig } from '../config';
import { Notifier } from './notifier/telegram-notifier';
import { TelegramMessageStore } from './telegram-message-store';
import {
  dangerousCommandTemplate,
  needsInputTemplate,
  sessionCompleteTemplate,
  SessionSummary,
} from './templates/notification-templates';
import type { WaitingConversation } from './cursor-conversations';

export class TelegramNotificationService {
  constructor(
    private readonly notifier: Notifier,
    private readonly config: AppConfig,
    private readonly messageStore?: TelegramMessageStore,
  ) {}

  async onDangerousCommand(sessionId: string, command: string, cwd?: string | null): Promise<void> {
    if (!this.config.telegram.notifyOn.attentionNeeded) return;
    await this.notifier.send(dangerousCommandTemplate(sessionId, command, cwd));
  }

  async onSessionComplete(sessionId: string, summary: SessionSummary): Promise<void> {
    if (!this.config.telegram.notifyOn.sessionEnd) return;
    const result = await this.notifier.send(sessionCompleteTemplate(sessionId, summary));
    if (result.messageId && this.messageStore) {
      this.messageStore.saveMapping(result.messageId, sessionId);
    }
  }

  async onNeedsInput(conv: WaitingConversation): Promise<void> {
    if (!this.config.telegram.notifyOn.attentionNeeded) return;
    const ageMs = Date.now() - new Date(conv.lastMessageAt).getTime();
    const mins = Math.floor(ageMs / 60000);
    const timeAgo = mins < 1 ? 'just now' : `${mins}m ago`;
    const result = await this.notifier.send(needsInputTemplate({
      workspaceName: conv.workspaceName,
      title: conv.title,
      lastMessagePreview: conv.lastMessagePreview,
      timeAgo,
      questions: conv.questions.length > 0 ? conv.questions : undefined,
    }));
    if (result.messageId && this.messageStore) {
      this.messageStore.saveConversationMapping(
        result.messageId,
        conv.conversationId,
        conv.workspacePath,
        conv.bubbleId,
        conv.questions.length > 0 ? conv.questions : undefined,
      );
    }
  }
}
