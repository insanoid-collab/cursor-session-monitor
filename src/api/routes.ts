import { FastifyInstance } from 'fastify';
import { CursorAdapter } from '../adapters/cursor-adapter';
import { SessionManager } from '../services/session-manager';
import { TelegramNotificationService } from '../services/telegram-notification-service';
import { listWorkspaces, listConversations, getConversation } from '../services/cursor-conversations';
import { appendToConversation } from '../services/cursor-memory';
import { resumeConversation } from '../services/cursor-cli';
import { chatPageHtml } from './chat-page';

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
    reply.send({ status: 'ok', sessionId: event.sessionId, ...result });
  });

  app.post('/hooks/cursor/beforeShellExecution', async (req, reply) => {
    const event = cursorAdapter.parseEvent(req.body);
    const result = sessionManager.ingest(event);
    if (result.flagged) {
      await notifications?.onDangerousCommand(
        event.sessionId,
        String(event.metadata.command ?? ''),
        (event.metadata.cwd as string | null) ?? null,
      );
    }
    reply.send({ status: 'ok', sessionId: event.sessionId, flagged: Boolean(result.flagged) });
  });

  app.post('/hooks/cursor/afterAgentResponse', async (req, reply) => {
    const event = cursorAdapter.parseEvent(req.body);
    const result = sessionManager.ingest(event);
    reply.send({ status: 'ok', sessionId: event.sessionId, ...result });
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

  // --- Cursor Chat Web UI ---

  app.get('/chat', async (_req, reply) => {
    reply.type('text/html').send(chatPageHtml());
  });

  app.get('/api/workspaces', async (req) => {
    const { onlyOpen } = req.query as { onlyOpen?: string };
    return { workspaces: listWorkspaces(onlyOpen === '1') };
  });

  app.get('/api/conversations', async (req) => {
    const { workspace } = req.query as { workspace?: string };
    if (!workspace) return { conversations: [] };
    return { conversations: listConversations(workspace) };
  });

  app.get('/api/conversations/:id', async (req) => {
    const { id } = req.params as { id: string };
    const { limit, before } = req.query as { limit?: string; before?: string };
    const page = getConversation(id, limit ? Number(limit) : 50, before || undefined);
    const title = page.messages.find(m => m.type === 1)?.text?.slice(0, 80) ?? 'Untitled';
    return { id, title, ...page };
  });

  app.post('/api/conversations/:id/reply', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { text, workspaceHash } = req.body as { text: string; workspaceHash?: string };
    if (!text?.trim()) {
      reply.code(400).send({ error: 'text is required' });
      return;
    }

    // Find workspace path for the CLI
    let workspacePath: string | null = null;
    if (workspaceHash) {
      const ws = listWorkspaces().find(w => w.hash === workspaceHash);
      if (ws) workspacePath = ws.folder;
    }

    // Inject prompt into conversation and kick off agent
    appendToConversation(id, text, '(processing...)');

    resumeConversation(id, text, workspacePath, (result) => {
      // Replace placeholder with actual response
      appendToConversation(id, text, result.output || '(no response)');
    });

    reply.send({ status: 'queued' });
  });
}
