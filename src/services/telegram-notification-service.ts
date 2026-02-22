import { AppConfig } from '../config';
import { Notifier } from './notifier/telegram-notifier';
import { TelegramMessageStore } from './telegram-message-store';
import {
  dangerousCommandTemplate,
  sessionCompleteTemplate,
  SessionSummary,
} from './templates/notification-templates';

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
}
