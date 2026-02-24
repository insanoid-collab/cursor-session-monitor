import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export interface AppConfig {
  service: { host: string; port: number; logLevel: string };
  database: { path: string };
  telegram: {
    enabled: boolean;
    botToken?: string;
    chatId?: string;
    notifyOn: {
      sessionStart: boolean;
      sessionEnd: boolean;
      fileEdit: boolean;
      shellCommand: boolean;
      attentionNeeded: boolean;
    };
    thresholds: {
      fileEditBatchIntervalSeconds: number;
      fileEditMinEvents: number;
      shellBatchIntervalSeconds: number;
      shellMinEvents: number;
    };
    dangerousCommands: string[];
    polling: {
      enabled: boolean;
      intervalMs: number;
    };
  };
  agents: { cursor: { sessionTimeoutMinutes: number } };
}

const defaults: AppConfig = {
  service: { host: '0.0.0.0', port: 9876, logLevel: 'info' },
  database: { path: './data/sessions.db' },
  telegram: {
    enabled: false,
    notifyOn: {
      sessionStart: true,
      sessionEnd: true,
      fileEdit: true,
      shellCommand: true,
      attentionNeeded: true,
    },
    thresholds: {
      fileEditBatchIntervalSeconds: 60,
      fileEditMinEvents: 1,
      shellBatchIntervalSeconds: 30,
      shellMinEvents: 1,
    },
    dangerousCommands: ['rm -rf', 'sudo', 'curl .*\\|\\s*sh'],
    polling: {
      enabled: true,
      intervalMs: 3000,
    },
  },
  agents: { cursor: { sessionTimeoutMinutes: 120 } },
};

function envBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function fromYaml(raw: any): Partial<AppConfig> {
  const telegram = raw?.telegram ?? {};
  const notifyOn = telegram.notify_on ?? {};
  const thresholds = telegram.thresholds ?? {};

  return {
    service: {
      host: raw?.service?.host,
      port: raw?.service?.port,
      logLevel: raw?.service?.log_level,
    } as any,
    database: { path: raw?.database?.path },
    telegram: {
      enabled: telegram.enabled,
      botToken: telegram.bot_token,
      chatId: telegram.chat_id,
      notifyOn: {
        sessionStart: notifyOn.session_start,
        sessionEnd: notifyOn.session_end,
        fileEdit: notifyOn.file_edit,
        shellCommand: notifyOn.shell_command,
        attentionNeeded: notifyOn.attention_needed,
      },
      thresholds: {
        fileEditBatchIntervalSeconds: thresholds.file_edit_batch_interval_seconds,
        fileEditMinEvents: thresholds.file_edit_min_events,
        shellBatchIntervalSeconds: thresholds.shell_batch_interval_seconds,
        shellMinEvents: thresholds.shell_min_events,
      },
      dangerousCommands: telegram.dangerous_commands,
      polling: {
        enabled: telegram.polling?.enabled,
        intervalMs: telegram.polling?.interval_ms,
      },
    } as any,
    agents: {
      cursor: { sessionTimeoutMinutes: raw?.agents?.cursor?.session_timeout_minutes },
    },
  };
}

function deepMerge<T extends Record<string, any>>(base: T, patch: Partial<T>): T {
  const out: any = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = deepMerge(base[key] ?? {}, value as any);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

export function loadConfig(): AppConfig {
  const configPath = process.env.CURSOR_MONITOR_CONFIG
    ? path.resolve(process.env.CURSOR_MONITOR_CONFIG)
    : path.resolve(process.cwd(), 'config.yaml');

  const yamlConfig = fs.existsSync(configPath)
    ? fromYaml(yaml.load(fs.readFileSync(configPath, 'utf8')) ?? {})
    : {};

  const merged = deepMerge(defaults, yamlConfig as Partial<AppConfig>);

  return {
    ...merged,
    service: {
      ...merged.service,
      host: process.env.HOST ?? merged.service.host,
      port: Number(process.env.PORT ?? merged.service.port),
      logLevel: process.env.LOG_LEVEL ?? merged.service.logLevel,
    },
    database: {
      path: process.env.DB_PATH ?? merged.database.path,
    },
    telegram: {
      ...merged.telegram,
      enabled: envBool(process.env.TELEGRAM_ENABLED, merged.telegram.enabled),
      botToken: process.env.TELEGRAM_BOT_TOKEN ?? merged.telegram.botToken,
      chatId: process.env.TELEGRAM_CHAT_ID ?? merged.telegram.chatId,
    },
    agents: {
      cursor: {
        sessionTimeoutMinutes: Number(process.env.CURSOR_SESSION_TIMEOUT_MINUTES ?? merged.agents.cursor.sessionTimeoutMinutes),
      },
    },
  };
}
