import { describe, expect, it } from 'vitest';
import { createNotifier, OpenClawMessageNotifier, TelegramBotApiNotifier } from '../src/services/notifier/telegram-notifier';
import { AppConfig } from '../src/config';

const baseConfig: AppConfig = {
  service: { host: '0.0.0.0', port: 9876, logLevel: 'info' },
  database: { path: './data/sessions.db' },
  telegram: {
    enabled: true,
    mode: 'openclaw',
    channel: 'telegram',
    target: 'telegram:test',
    account: 'codex',
    notifyOn: { sessionStart: true, sessionEnd: true, fileEdit: true, shellCommand: true, attentionNeeded: true },
    thresholds: {
      fileEditBatchIntervalSeconds: 60,
      fileEditMinEvents: 1,
      shellBatchIntervalSeconds: 30,
      shellMinEvents: 1,
    },
    dangerousCommands: ['sudo'],
  },
  agents: { cursor: { sessionTimeoutMinutes: 120 } },
};

describe('createNotifier', () => {
  it('creates openclaw notifier by default', () => {
    const notifier = createNotifier(baseConfig);
    expect(notifier).toBeInstanceOf(OpenClawMessageNotifier);
  });

  it('falls back to bot api when configured', () => {
    const notifier = createNotifier({
      ...baseConfig,
      telegram: {
        ...baseConfig.telegram,
        mode: 'bot_api',
        botToken: 't',
        chatId: '1',
      },
    });
    expect(notifier).toBeInstanceOf(TelegramBotApiNotifier);
  });

  it('returns null when telegram disabled', () => {
    const notifier = createNotifier({ ...baseConfig, telegram: { ...baseConfig.telegram, enabled: false } });
    expect(notifier).toBeNull();
  });
});
