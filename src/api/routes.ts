import { FastifyInstance } from 'fastify';
import { CursorAdapter } from '../adapters/cursor-adapter';
import { SessionManager } from '../services/session-manager';
import { TelegramNotificationService } from '../services/telegram-notification-service';
import { listWorkspaces, listConversations, getConversation, getConversationTitle, getWaitingConversations } from '../services/cursor-conversations';
import { logger } from '../utils/logger';
import { appendToConversation, submitQuestionAnswer, submitPlanReview } from '../services/cursor-memory';
import { resumeConversation, getActiveAgents, getAgentOutput } from '../services/cursor-cli';
import { chatPageHtml } from './chat-page';

// Runtime state: Telegram notifications off by default
let telegramEnabled = false;

// Track recently-updated sessions from hooks (sessionId → timestamp)
const recentUpdates = new Map<string, number>();
const UPDATE_TTL_MS = 60_000;

function recordUpdate(sessionId: string): void {
  recentUpdates.set(sessionId, Date.now());
  // Prune old entries
  const cutoff = Date.now() - UPDATE_TTL_MS;
  for (const [id, ts] of recentUpdates) {
    if (ts < cutoff) recentUpdates.delete(id);
  }
}

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
    recordUpdate(event.sessionId);
    reply.send({ status: 'ok', sessionId: event.sessionId, ...result });
  });

  app.post('/hooks/cursor/beforeShellExecution', async (req, reply) => {
    const event = cursorAdapter.parseEvent(req.body);
    const result = sessionManager.ingest(event);
    recordUpdate(event.sessionId);
    if (result.flagged && telegramEnabled) {
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
    recordUpdate(event.sessionId);
    reply.send({ status: 'ok', sessionId: event.sessionId, ...result });
  });

  app.post('/hooks/cursor/stop', async (req, reply) => {
    const event = cursorAdapter.parseEvent(req.body);
    sessionManager.ingest(event);
    recordUpdate(event.sessionId);
    const summary = sessionManager.getSummary(event.sessionId);
    if (summary && notifications && telegramEnabled) {
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

  // --- Settings API ---

  app.get('/api/settings', async () => ({
    telegramEnabled,
  }));

  app.post('/api/settings', async (req) => {
    const body = req.body as { telegramEnabled?: boolean };
    if (typeof body.telegramEnabled === 'boolean') {
      telegramEnabled = body.telegramEnabled;
    }
    return { telegramEnabled };
  });

  // --- Updates API (for live sidebar highlighting) ---

  app.get('/api/updates', async (req) => {
    const { since } = req.query as { since?: string };
    const sinceTs = since ? Number(since) : 0;
    const updates: { sessionId: string; timestamp: number }[] = [];
    for (const [sessionId, ts] of recentUpdates) {
      if (ts > sinceTs) updates.push({ sessionId, timestamp: ts });
    }
    return { updates, serverTime: Date.now() };
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
    const conversations = listConversations(workspace);
    const agents = getActiveAgents();
    const now = Date.now();
    for (const c of conversations) {
      if (agents.has(c.id)) {
        (c as any).agentRunning = true;
      } else if (c.lastMessageAt) {
        // Heuristic: last message is assistant (type 2), recent, and short = agent still working
        const age = now - new Date(c.lastMessageAt).getTime();
        if (age < 120_000 && c.lastMessageType === 2 && c.lastMessageLength < 80) {
          (c as any).agentRunning = true;
        }
      }
    }
    return { conversations };
  });

  app.get('/api/conversations/:id', async (req) => {
    const { id } = req.params as { id: string };
    const { limit, before } = req.query as { limit?: string; before?: string };
    const page = getConversation(id, limit ? Number(limit) : 50, before || undefined);
    const cursorTitle = getConversationTitle(id);
    const title = cursorTitle !== 'Untitled' ? cursorTitle
      : page.messages.find(m => m.type === 1)?.text?.slice(0, 80) ?? 'Untitled';
    const agentRunning = getActiveAgents().has(id) || page.agentBusy;
    return { id, title, agentRunning, ...page };
  });

  // Streaming agent output (for live progress while agent runs)
  app.get('/api/agents/:id/output', async (req) => {
    const { id } = req.params as { id: string };
    const { after } = req.query as { after?: string };
    const result = getAgentOutput(id, after ? Number(after) : 0);
    if (!result) return { running: false, lines: [], totalLines: 0 };
    return { running: true, ...result };
  });

  app.post('/api/conversations/:id/reply', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { text, workspaceHash } = req.body as { text: string; workspaceHash?: string };
    if (!text?.trim()) {
      reply.code(400).send({ error: 'text is required' });
      return;
    }

    let workspacePath: string | null = null;
    if (workspaceHash) {
      const ws = listWorkspaces().find(w => w.hash === workspaceHash);
      if (ws) workspacePath = ws.folder;
    }

    appendToConversation(id, text, '(processing...)');

    resumeConversation(id, text, workspacePath, (result) => {
      appendToConversation(id, text, result.output || '(no response)');
    });

    reply.send({ status: 'queued' });
  });

  app.post('/api/conversations/:id/answer', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      bubbleId: string;
      answers: { questionId: string; selectedOptionId: string | null; selectedLabel: string | null; freeformText: string | null }[];
      workspaceHash?: string;
    };

    if (!body.bubbleId || !Array.isArray(body.answers) || body.answers.length === 0) {
      reply.code(400).send({ error: 'bubbleId and answers are required' });
      return;
    }

    // Build structured answers for the DB write
    const dbAnswers = body.answers.map(a => ({
      questionId: a.questionId,
      selectedOptionId: a.selectedOptionId ?? '__freeform__',
      freeformText: a.freeformText ?? undefined,
    }));

    const ok = submitQuestionAnswer(id, body.bubbleId, dbAnswers);
    if (!ok) {
      reply.code(500).send({ error: 'failed to write answer to cursor DB' });
      return;
    }

    // Build summary prompt for the agent using readable labels
    const summaryLines = body.answers.map((a, i) => {
      if (a.freeformText) return `Q${i + 1}: ${a.freeformText}`;
      return `Q${i + 1}: ${a.selectedLabel || a.selectedOptionId}`;
    });
    const summaryPrompt = `User answered questions:\n${summaryLines.join('\n')}`;

    let workspacePath: string | null = null;
    if (body.workspaceHash) {
      const ws = listWorkspaces().find(w => w.hash === body.workspaceHash);
      if (ws) workspacePath = ws.folder;
    }

    resumeConversation(id, summaryPrompt, workspacePath);
    reply.send({ status: 'submitted' });
  });

  app.post('/api/conversations/:id/plan-review', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { bubbleId: string; action: 'approve' | 'reject' | 'reset'; workspaceHash?: string };

    if (!body.bubbleId || !['approve', 'reject', 'reset'].includes(body.action)) {
      reply.code(400).send({ error: 'bubbleId and action (approve/reject/reset) are required' });
      return;
    }

    const ok = submitPlanReview(id, body.bubbleId, body.action);
    if (!ok) {
      reply.code(500).send({ error: 'failed to update plan in cursor DB' });
      return;
    }

    if (body.action === 'reset') {
      reply.send({ status: 'reset' });
      return;
    }

    const prompt = body.action === 'approve'
      ? 'User approved the plan. Proceed with implementation.'
      : 'User rejected the plan.';

    let workspacePath: string | null = null;
    if (body.workspaceHash) {
      const ws = listWorkspaces().find(w => w.hash === body.workspaceHash);
      if (ws) workspacePath = ws.folder;
    }

    resumeConversation(id, prompt, workspacePath);
    reply.send({ status: body.action === 'approve' ? 'approved' : 'rejected' });
  });

  // --- Refresh Cursor IDE window via AppleScript ---
  app.post('/api/cursor/refresh', async (req, reply) => {
    const { exec } = await import('node:child_process');
    const body = req.body as { workspaceHash?: string };

    // Resolve workspace folder name to match against Cursor window titles
    let windowMatch = '';
    if (body.workspaceHash) {
      const ws = listWorkspaces().find(w => w.hash === body.workspaceHash);
      if (ws?.folder) {
        const folderName = ws.folder.split('/').pop() ?? '';
        if (folderName) windowMatch = folderName;
      }
    }

    // AppleScript: find the matching window, bring it to front, reload it
    const script = windowMatch
      ? `
        tell application "System Events"
          tell process "Cursor"
            set targetWindow to missing value
            repeat with w in windows
              if name of w contains "${windowMatch}" then
                set targetWindow to w
                exit repeat
              end if
            end repeat
            if targetWindow is not missing value then
              perform action "AXRaise" of targetWindow
              set frontmost to true
              delay 0.2
              keystroke "p" using {command down, shift down}
              delay 0.4
              keystroke "Reload Window"
              delay 0.4
              key code 36
            end if
          end tell
        end tell
      `
      : `
        tell application "System Events"
          tell process "Cursor"
            set frontmost to true
            keystroke "p" using {command down, shift down}
            delay 0.4
            keystroke "Reload Window"
            delay 0.4
            key code 36
          end tell
        end tell
      `;

    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err) => {
      if (err) {
        logger.error(`cursor refresh failed: ${err.message}`);
        reply.code(500).send({ error: err.message });
      } else {
        logger.info(`cursor window reload triggered${windowMatch ? ` for ${windowMatch}` : ''}`);
        reply.send({ status: 'refreshed' });
      }
    });
  });

  // --- Periodic scan for "needs input" conversations ---
  const notifiedWaiting = new Set<string>();

  setInterval(async () => {
    if (!telegramEnabled || !notifications) return;
    try {
      const waiting = getWaitingConversations();
      const currentIds = new Set(waiting.map(w => w.conversationId));

      // Clear stale entries (conversation no longer waiting)
      for (const id of notifiedWaiting) {
        if (!currentIds.has(id)) notifiedWaiting.delete(id);
      }

      // Notify new ones
      for (const conv of waiting) {
        if (!notifiedWaiting.has(conv.conversationId)) {
          await notifications.onNeedsInput(conv);
          notifiedWaiting.add(conv.conversationId);
          logger.info(`sent needs-input notification for ${conv.workspaceName}/${conv.title.slice(0, 30)}`);
        }
      }
    } catch (err) {
      logger.error(`needs-input scan failed: ${String(err)}`);
    }
  }, 30_000);
}
