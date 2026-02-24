import { describe, expect, it } from 'vitest';
import { createNotifier, TelegramNotifier } from '../src/services/notifier/telegram-notifier';
import { AppConfig } from '../src/config';

const baseConfig: AppConfig = {
  service: { host: '0.0.0.0', port: 9876, logLevel: 'info' },
  database: { path: './data/sessions.db' },
  telegram: {
    enabled: true,
    botToken: 'test-token',
    chatId: 'test-chat',
    notifyOn: { sessionStart: true, sessionEnd: true, fileEdit: true, shellCommand: true, attentionNeeded: true },
    thresholds: {
      fileEditBatchIntervalSeconds: 60,
      fileEditMinEvents: 1,
      shellBatchIntervalSeconds: 30,
      shellMinEvents: 1,
    },
    dangerousCommands: ['sudo'],
    polling: { enabled: false, intervalMs: 3000 },
  },
  agents: { cursor: { sessionTimeoutMinutes: 120 } },
};

describe('createNotifier', () => {
  it('creates telegram notifier when configured', () => {
    const notifier = createNotifier(baseConfig);
    expect(notifier).toBeInstanceOf(TelegramNotifier);
  });

  it('returns null when telegram disabled', () => {
    const notifier = createNotifier({ ...baseConfig, telegram: { ...baseConfig.telegram, enabled: false } });
    expect(notifier).toBeNull();
  });

  it('returns null when bot token missing', () => {
    const notifier = createNotifier({ ...baseConfig, telegram: { ...baseConfig.telegram, botToken: undefined } });
    expect(notifier).toBeNull();
  });
});
