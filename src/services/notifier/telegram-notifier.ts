import axios from 'axios';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AppConfig } from '../../config';

const execFileAsync = promisify(execFile);

export interface Notifier {
  send(message: string): Promise<void>;
}

export class OpenClawMessageNotifier implements Notifier {
  constructor(private readonly channel: string, private readonly target: string, private readonly account?: string) {}

  async send(message: string): Promise<void> {
    const args = ['message', 'send', '--channel', this.channel, '--target', this.target, '--message', message];
    if (this.account) {
      args.push('--accountId', this.account);
    }
    await execFileAsync('openclaw', args);
  }
}

export class TelegramBotApiNotifier implements Notifier {
  constructor(private readonly token: string, private readonly chatId: string) {}

  async send(message: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    await axios.post(url, {
      chat_id: this.chatId,
      text: message,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  }
}

export function createNotifier(config: AppConfig): Notifier | null {
  if (!config.telegram.enabled) return null;

  if (config.telegram.mode === 'bot_api') {
    if (!config.telegram.botToken || !config.telegram.chatId) return null;
    return new TelegramBotApiNotifier(config.telegram.botToken, config.telegram.chatId);
  }

  if (!config.telegram.target) return null;
  return new OpenClawMessageNotifier(config.telegram.channel, config.telegram.target, config.telegram.account);
}
