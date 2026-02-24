import 'dotenv/config';
import Fastify from 'fastify';
import { createDb, runMigrations } from './database/db';
import { SessionManager } from './services/session-manager';
import { registerRoutes } from './api/routes';
import { logger } from './utils/logger';
import { loadConfig } from './config';
import { createNotifier } from './services/notifier/telegram-notifier';
import { TelegramNotificationService } from './services/telegram-notification-service';
import { TelegramMessageStore } from './services/telegram-message-store';
import { TelegramPollingService } from './services/telegram-polling';

async function main() {
  const config = loadConfig();
  const app = Fastify({ logger: false });
  const db = createDb(config.database.path);
  runMigrations(db);

  const sessionManager = new SessionManager(db, {
    dangerousCommandPatterns: config.telegram.dangerousCommands,
    sessionTimeoutMinutes: config.agents.cursor.sessionTimeoutMinutes,
  });

  const notifier = createNotifier(config);
  const messageStore = new TelegramMessageStore(db);
  const notificationService = notifier
    ? new TelegramNotificationService(notifier, config, messageStore)
    : undefined;

  await registerRoutes(app, sessionManager, notificationService);

  await app.listen({ host: config.service.host, port: config.service.port });
  logger.info(`cursor-session-monitor listening on ${config.service.host}:${config.service.port}`);

  if (notifier && config.telegram.polling.enabled && config.telegram.botToken && config.telegram.chatId) {
    const polling = new TelegramPollingService(
      config.telegram.botToken,
      config.telegram.chatId,
      messageStore,
      db,
      config.telegram.polling.intervalMs,
    );
    polling.start();
  }
}

main().catch((err) => {
  logger.error(`failed to start service: ${String(err)}`);
  process.exit(1);
});
