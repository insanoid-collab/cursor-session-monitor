import { AppConfig } from '../config';
import { NotificationBatcher } from './notification-batcher';
import { Notifier } from './notifier/telegram-notifier';
import {
  dangerousCommandTemplate,
  sessionCompleteTemplate,
  sessionStartTemplate,
} from './templates/notification-templates';

export class TelegramNotificationService {
  private readonly batcher: NotificationBatcher;

  constructor(private readonly notifier: Notifier, private readonly config: AppConfig) {
    this.batcher = new NotificationBatcher(notifier, {
      fileIntervalMs: config.telegram.thresholds.fileEditBatchIntervalSeconds * 1000,
      fileMinEvents: config.telegram.thresholds.fileEditMinEvents,
      shellIntervalMs: config.telegram.thresholds.shellBatchIntervalSeconds * 1000,
      shellMinEvents: config.telegram.thresholds.shellMinEvents,
    });
  }

  async onSessionStart(sessionId: string, cwd?: string | null): Promise<void> {
    if (!this.config.telegram.notifyOn.sessionStart) return;
    await this.notifier.send(sessionStartTemplate(sessionId, cwd));
  }

  onFileEdit(sessionId: string, filePath: string): void {
    if (!this.config.telegram.notifyOn.fileEdit) return;
    this.batcher.queueFileEdit(sessionId, filePath);
  }

  onShellCommand(sessionId: string, command: string): void {
    if (!this.config.telegram.notifyOn.shellCommand) return;
    this.batcher.queueShellCommand(sessionId, command);
  }

  async onDangerousCommand(sessionId: string, command: string, cwd?: string | null): Promise<void> {
    if (!this.config.telegram.notifyOn.attentionNeeded) return;
    await this.notifier.send(dangerousCommandTemplate(sessionId, command, cwd));
  }

  async onSessionComplete(
    sessionId: string,
    summary: { filesModified: number; commandsExecuted: number; durationMinutes: number },
  ): Promise<void> {
    if (!this.config.telegram.notifyOn.sessionEnd) return;
    await this.batcher.flushSession(sessionId);
    await this.notifier.send(sessionCompleteTemplate(sessionId, summary));
  }
}
