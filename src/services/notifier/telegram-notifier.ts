import axios from 'axios';
import { AppConfig } from '../../config';
import { logger } from '../../utils/logger';

export interface SendResult {
  messageId?: number;
}

export interface Notifier {
  send(message: string): Promise<SendResult>;
}

export class TelegramNotifier implements Notifier {
  constructor(private readonly token: string, private readonly chatId: string) {}

  async send(message: string): Promise<SendResult> {
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    try {
      const res = await axios.post(url, {
        chat_id: this.chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      return { messageId: res.data?.result?.message_id };
    } catch (err) {
      logger.error(`telegram send failed: ${String(err)}`);
      return {};
    }
  }
}

export function createNotifier(config: AppConfig): Notifier | null {
  if (!config.telegram.enabled) return null;
  if (!config.telegram.botToken || !config.telegram.chatId) return null;
  return new TelegramNotifier(config.telegram.botToken, config.telegram.chatId);
}
