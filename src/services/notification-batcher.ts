import { Notifier } from './notifier/telegram-notifier';
import { fileEditBatchTemplate, shellBatchTemplate } from './templates/notification-templates';

interface BatchOptions {
  fileIntervalMs: number;
  fileMinEvents: number;
  shellIntervalMs: number;
  shellMinEvents: number;
}

export class NotificationBatcher {
  private readonly fileBatches = new Map<string, Set<string>>();
  private readonly shellBatches = new Map<string, string[]>();
  private readonly fileTimers = new Map<string, NodeJS.Timeout>();
  private readonly shellTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly notifier: Notifier, private readonly options: BatchOptions) {}

  queueFileEdit(sessionId: string, filePath: string): void {
    const bucket = this.fileBatches.get(sessionId) ?? new Set<string>();
    bucket.add(filePath);
    this.fileBatches.set(sessionId, bucket);
    if (bucket.size >= this.options.fileMinEvents) {
      this.scheduleFileFlush(sessionId);
    }
  }

  queueShellCommand(sessionId: string, command: string): void {
    const bucket = this.shellBatches.get(sessionId) ?? [];
    bucket.push(command);
    this.shellBatches.set(sessionId, bucket);
    if (bucket.length >= this.options.shellMinEvents) {
      this.scheduleShellFlush(sessionId);
    }
  }

  async flushSession(sessionId: string): Promise<void> {
    await this.flushFiles(sessionId);
    await this.flushShell(sessionId);
  }

  private scheduleFileFlush(sessionId: string): void {
    if (this.fileTimers.has(sessionId)) return;
    const t = setTimeout(() => {
      void this.flushFiles(sessionId);
    }, this.options.fileIntervalMs);
    t.unref?.();
    this.fileTimers.set(sessionId, t);
  }

  private scheduleShellFlush(sessionId: string): void {
    if (this.shellTimers.has(sessionId)) return;
    const t = setTimeout(() => {
      void this.flushShell(sessionId);
    }, this.options.shellIntervalMs);
    t.unref?.();
    this.shellTimers.set(sessionId, t);
  }

  private async flushFiles(sessionId: string): Promise<void> {
    const timer = this.fileTimers.get(sessionId);
    if (timer) clearTimeout(timer);
    this.fileTimers.delete(sessionId);

    const files = this.fileBatches.get(sessionId);
    if (!files || files.size === 0) return;
    this.fileBatches.delete(sessionId);
    await this.notifier.send(fileEditBatchTemplate(sessionId, Array.from(files)));
  }

  private async flushShell(sessionId: string): Promise<void> {
    const timer = this.shellTimers.get(sessionId);
    if (timer) clearTimeout(timer);
    this.shellTimers.delete(sessionId);

    const commands = this.shellBatches.get(sessionId);
    if (!commands || commands.length === 0) return;
    this.shellBatches.delete(sessionId);
    await this.notifier.send(shellBatchTemplate(sessionId, commands));
  }
}
