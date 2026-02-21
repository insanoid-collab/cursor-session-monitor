import { FastifyInstance } from 'fastify';
import { CursorAdapter } from '../adapters/cursor-adapter';
import { SessionManager } from '../services/session-manager';
import { TelegramNotificationService } from '../services/telegram-notification-service';

export async function registerRoutes(
  app: FastifyInstance,
  sessionManager: SessionManager,
  notifications?: TelegramNotificationService,
): Promise<void> {
  const cursorAdapter = new CursorAdapter();

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/hooks/cursor/afterFileEdit', async (req, reply) => {
    const event = cursorAdapter.parseEvent(req.body);
    const result = sessionManager.ingest(event);
    if (result.sessionStarted) {
      await notifications?.onSessionStart(event.sessionId, (event.metadata.cwd as string | null) ?? null);
    }
    notifications?.onFileEdit(event.sessionId, String(event.metadata.filePath ?? ''));
    reply.send({ status: 'ok', sessionId: event.sessionId, notificationSent: Boolean(notifications), ...result });
  });

  app.post('/hooks/cursor/beforeShellExecution', async (req, reply) => {
    const event = cursorAdapter.parseEvent(req.body);
    const result = sessionManager.ingest(event);
    if (result.sessionStarted) {
      await notifications?.onSessionStart(event.sessionId, (event.metadata.cwd as string | null) ?? null);
    }
    notifications?.onShellCommand(event.sessionId, String(event.metadata.command ?? ''));
    if (result.flagged) {
      await notifications?.onDangerousCommand(
        event.sessionId,
        String(event.metadata.command ?? ''),
        (event.metadata.cwd as string | null) ?? null,
      );
    }
    reply.send({ status: 'ok', sessionId: event.sessionId, flagged: Boolean(result.flagged), notificationSent: Boolean(notifications) });
  });

  app.post('/hooks/cursor/stop', async (req, reply) => {
    const event = cursorAdapter.parseEvent(req.body);
    sessionManager.ingest(event);
    const summary = sessionManager.getSummary(event.sessionId);
    if (summary && notifications) {
      await notifications.onSessionComplete(event.sessionId, summary);
    }
    reply.send({ status: 'ok', sessionId: event.sessionId, summary });
  });

  app.get('/sessions', async (req) => {
    const query = req.query as { status?: string; limit?: string };
    const limit = query.limit ? Number(query.limit) : 50;
    const sessions = sessionManager.listSessions(query.status, limit);
    return { sessions, total: sessions.length };
  });

  app.get('/sessions/active', async () => {
    const sessions = sessionManager.getActiveSessions();
    return { sessions, count: sessions.length };
  });

  app.get('/sessions/:sessionId', async (req, reply) => {
    const params = req.params as { sessionId: string };
    const session = sessionManager.getSession(params.sessionId);
    if (!session) {
      reply.code(404).send({ error: 'Session not found' });
      return;
    }
    reply.send(session);
  });
}
