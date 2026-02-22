import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { logger } from '../utils/logger';

const CURSOR_SUPPORT = path.join(
  process.env.HOME ?? '',
  'Library',
  'Application Support',
  'Cursor',
  'User',
);
const CURSOR_STORAGE_JSON = path.join(CURSOR_SUPPORT, 'globalStorage', 'storage.json');
const GLOBAL_STATE_DB = path.join(CURSOR_SUPPORT, 'globalStorage', 'state.vscdb');
const WORKSPACE_STORAGE = path.join(CURSOR_SUPPORT, 'workspaceStorage');

function getOpenFolders(): Set<string> {
  try {
    if (!fs.existsSync(CURSOR_STORAGE_JSON)) return new Set();
    const data = JSON.parse(fs.readFileSync(CURSOR_STORAGE_JSON, 'utf8'));
    const state = data.windowsState ?? {};
    const folders = new Set<string>();
    const extract = (win: any) => {
      const f = (win?.folder as string)?.replace('file://', '');
      if (f) folders.add(f);
    };
    extract(state.lastActiveWindow);
    for (const win of state.openedWindows ?? []) extract(win);
    return folders;
  } catch {
    return new Set();
  }
}

export interface Workspace {
  hash: string;
  folder: string;
  name: string;
  conversationCount: number;
  isOpen: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  mode: string;
  lastMessageAt: string;
  lastMessageType: number;
  lastMessageLength: number;
  parentId: string | null;
  subagentType: string | null;
  children?: ConversationSummary[];
  pendingAction?: 'plan_review' | 'question' | null;
}

export interface ChatMessage {
  bubbleId: string;
  type: number;
  text: string;
  createdAt: string;
  isAgentic: boolean;
  askQuestion?: {
    status: string;
    questions: PendingQuestion[];
    answers?: { questionId: string; selectedOptionIds: string[] }[];
  };
  subagentTask?: {
    description: string;
    status: string; // 'loading' | 'success' | 'error'
    terminationReason: string | null;
    subagentId: string;
  };
  plan?: {
    name: string;
    overview: string;
    markdown: string;
    todos: { id: string; content: string; status: string }[];
    reviewStatus: string; // 'Requested' | 'Approved' | 'Rejected'
  };
  toolCall?: {
    tool: string;    // 'read' | 'edit' | 'terminal' | 'search' | 'web' | 'mcp' | 'other'
    summary: string; // e.g., 'Read index.ts', 'Run npm test'
    detail?: string; // full path or command
  };
}

function shortName(folder: string): string {
  const parts = folder.replace(/\/$/, '').split('/').filter(Boolean);
  return parts[parts.length - 1] || folder;
}

function openReadonly(dbPath: string): Database.Database | null {
  try {
    if (!fs.existsSync(dbPath)) return null;
    return new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch {
    return null;
  }
}

interface ComposerInfo {
  id: string;
  createdAt: number;
  mode: string;
  parentId: string | null;
  subagentType: string | null;
}

function getComposerIds(workspaceHash: string): ComposerInfo[] {
  const dbPath = path.join(WORKSPACE_STORAGE, workspaceHash, 'state.vscdb');
  const db = openReadonly(dbPath);
  if (!db) return [];

  try {
    const row = db.prepare("SELECT value FROM ItemTable WHERE key = 'composer.composerData'").get() as
      | { value: string }
      | undefined;
    if (!row) return [];

    const data = JSON.parse(row.value);
    const composers: ComposerInfo[] = [];
    for (const c of data.allComposers ?? []) {
      const sub = c.subagentInfo as { parentComposerId?: string; subagentTypeName?: string } | undefined;
      composers.push({
        id: c.composerId,
        createdAt: c.createdAt ?? 0,
        mode: c.unifiedMode ?? 'unknown',
        parentId: sub?.parentComposerId ?? null,
        subagentType: sub?.subagentTypeName ?? null,
      });
    }
    return composers;
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export function listWorkspaces(onlyOpen = false): Workspace[] {
  if (!fs.existsSync(WORKSPACE_STORAGE)) return [];

  const openFolders = getOpenFolders();
  const entries = fs.readdirSync(WORKSPACE_STORAGE, { withFileTypes: true });
  const workspaces: Workspace[] = [];
  const globalDb = openReadonly(GLOBAL_STATE_DB);
  const hasMessagesStmt = globalDb?.prepare(
    'SELECT 1 FROM cursorDiskKV WHERE key >= ? AND key < ? LIMIT 1',
  );

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const wsJson = path.join(WORKSPACE_STORAGE, entry.name, 'workspace.json');
    if (!fs.existsSync(wsJson)) continue;

    try {
      const data = JSON.parse(fs.readFileSync(wsJson, 'utf8'));
      const folder = (data.folder as string)?.replace('file://', '') ?? '';
      if (!folder) continue;

      const isOpen = openFolders.has(folder);
      // Skip expensive composer scan for closed workspaces when filtering
      if (onlyOpen && !isOpen) continue;

      const composers = getComposerIds(entry.name);

      // Count only conversations that have at least one message
      let withMessages = 0;
      if (composers.length > 0 && hasMessagesStmt) {
        for (const c of composers) {
          const prefix = `bubbleId:${c.id}:`;
          const row = hasMessagesStmt.get(prefix, prefix + '\xff');
          if (row) withMessages++;
        }
      } else {
        withMessages = composers.length;
      }

      // Still show open workspaces even with 0 conversations
      if (withMessages === 0 && !isOpen) continue;

      workspaces.push({
        hash: entry.name,
        folder,
        name: shortName(folder),
        conversationCount: withMessages,
        isOpen,
      });
    } catch {
      continue;
    }
  }

  globalDb?.close();

  // Open workspaces first, then alphabetical
  return workspaces.sort((a, b) => {
    if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function listConversations(workspaceHash: string): ConversationSummary[] {
  const composers = getComposerIds(workspaceHash);
  if (composers.length === 0) return [];

  const db = openReadonly(GLOBAL_STATE_DB);
  if (!db) return [];

  try {
    // Use range queries instead of LIKE for index utilization
    const countStmt = db.prepare(
      'SELECT COUNT(*) as cnt FROM cursorDiskKV WHERE key >= ? AND key < ?',
    );
    const titleStmt = db.prepare(
      'SELECT value FROM cursorDiskKV WHERE key >= ? AND key < ? LIMIT 50',
    );
    // Fetch last messages (reverse key order) to find the most recent
    const lastMsgStmt = db.prepare(
      'SELECT value FROM cursorDiskKV WHERE key >= ? AND key < ? ORDER BY key DESC LIMIT 10',
    );
    // Targeted scan for pending plan reviews and questions
    const pendingStmt = db.prepare(
      `SELECT value FROM cursorDiskKV WHERE key >= ? AND key < ?
       AND (value LIKE '%"status":"pending"%' OR value LIKE '%"status":"Requested"%')
       LIMIT 5`,
    );

    const conversations: ConversationSummary[] = [];
    for (const c of composers) {
      const prefix = `bubbleId:${c.id}:`;
      const prefixEnd = `bubbleId:${c.id}:\xff`;
      const countRow = countStmt.get(prefix, prefixEnd) as { cnt: number } | undefined;
      const msgCount = countRow?.cnt ?? 0;
      if (msgCount === 0) continue;

      // Find title from first user message
      let title = 'Untitled';
      const rows = titleStmt.all(prefix, prefixEnd) as { value: string }[];
      for (const row of rows) {
        try {
          const msg = JSON.parse(row.value);
          if (msg.type === 1 && msg.text && msg.text.length > 0) {
            title = msg.text.slice(0, 80).replace(/\n/g, ' ').trim();
            break;
          }
        } catch {
          continue;
        }
      }

      // Find last message timestamp, type, and length
      let lastMessageAt = '';
      let lastMessageType = 0;
      let lastMessageLength = 0;
      const lastRows = lastMsgStmt.all(prefix, prefixEnd) as { value: string }[];
      for (const row of lastRows) {
        try {
          const msg = JSON.parse(row.value);
          if (msg.createdAt) {
            if (!lastMessageAt || msg.createdAt > lastMessageAt) {
              lastMessageAt = msg.createdAt;
              lastMessageType = msg.type ?? 0;
              lastMessageLength = (msg.text as string | undefined)?.length ?? 0;
            }
          }
        } catch {
          continue;
        }
      }

      // Detect pending plan reviews and questions (targeted full-conversation scan).
      // Plan reviews take priority — pending questions are often stale context replays.
      let hasPendingQuestion = false;
      let hasPendingPlanReview = false;
      const pendingRows = pendingStmt.all(prefix, prefixEnd) as { value: string }[];
      for (const row of pendingRows) {
        try {
          const msg = JSON.parse(row.value);
          const tfd = msg.toolFormerData;
          if (tfd?.name === 'ask_question' && tfd.additionalData?.status === 'pending') {
            hasPendingQuestion = true;
          }
          if (tfd?.name === 'create_plan' && tfd.additionalData?.reviewData?.status === 'Requested') {
            hasPendingPlanReview = true;
          }
        } catch {
          continue;
        }
      }
      const pendingAction: ConversationSummary['pendingAction'] =
        hasPendingPlanReview ? 'plan_review' : hasPendingQuestion ? 'question' : null;

      conversations.push({
        id: c.id,
        title,
        messageCount: msgCount,
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : '',
        mode: c.mode,
        lastMessageAt,
        lastMessageType,
        lastMessageLength,
        parentId: c.parentId,
        subagentType: c.subagentType,
        pendingAction,
      });
    }

    // Build tree: nest children under parents
    const byId = new Map<string, ConversationSummary>();
    for (const conv of conversations) byId.set(conv.id, conv);

    const roots: ConversationSummary[] = [];
    for (const conv of conversations) {
      if (conv.parentId && byId.has(conv.parentId)) {
        const parent = byId.get(conv.parentId)!;
        if (!parent.children) parent.children = [];
        parent.children.push(conv);
      } else {
        roots.push(conv);
      }
    }

    // Sort children by createdAt, roots by lastMessageAt
    for (const r of roots) {
      if (r.children) r.children.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
    }
    return roots.sort((a, b) => (b.lastMessageAt > a.lastMessageAt ? 1 : -1));
  } finally {
    db.close();
  }
}

export interface ConversationPage {
  messages: ChatMessage[];
  hasMore: boolean;
  oldestTimestamp: string;
  totalCount: number;
}

/**
 * Deduplicate messages caused by Cursor's context window replays.
 * When the context resets, Cursor replays earlier messages with new bubble IDs,
 * creating duplicates. This merges them by keeping only the last occurrence of
 * each unique message and consolidating sub-agent states.
 */
function deduplicateMessages(messages: ChatMessage[]): ChatMessage[] {
  const statusRank = (s: string) => (s === 'success' ? 3 : s === 'error' ? 2 : 1);

  // Phase 1: Build best-known state for each subagentId
  const subagentBest = new Map<string, {
    description: string;
    status: string;
    terminationReason: string | null;
  }>();

  for (const m of messages) {
    const sid = m.subagentTask?.subagentId;
    if (!sid) continue;
    const existing = subagentBest.get(sid);
    if (!existing || statusRank(m.subagentTask!.status) >= statusRank(existing.status)) {
      subagentBest.set(sid, {
        description: m.subagentTask!.description || existing?.description || '',
        status: m.subagentTask!.status,
        terminationReason: m.subagentTask!.terminationReason,
      });
    } else if (!existing.description && m.subagentTask!.description) {
      existing.description = m.subagentTask!.description;
    }
  }

  // Also build a description→subagentId lookup for matching empty-ID sub-agents
  const descToSid = new Map<string, string>();
  for (const [sid, best] of subagentBest) {
    if (best.description) descToSid.set(best.description, sid);
  }

  // Phase 2: Walk backwards keeping only the last occurrence of each unique message.
  // For sub-agents we prefer the LATEST chronological position (correct after context
  // replays) but patch in the real subagentId from earlier versions for navigation.
  const seenText = new Set<string>();
  const seenSubagentDescs = new Set<string>();
  const seenSubagentIds = new Set<string>();
  const seenQuestions = new Set<string>();
  const seenPlans = new Set<string>();
  const result: ChatMessage[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];

    // Sub-agent dedup
    if (m.subagentTask) {
      const sid = m.subagentTask.subagentId;
      const desc = m.subagentTask.description;

      // Skip orphaned empty-desc + empty-id sub-agents
      if (!desc && !sid) continue;

      // Dedup key: prefer subagentId, fall back to description
      const dedupKey = desc || sid;
      if (seenSubagentDescs.has(dedupKey)) continue;
      seenSubagentDescs.add(dedupKey);
      if (desc) seenSubagentDescs.add(desc);
      if (sid) {
        seenSubagentIds.add(sid);
        seenSubagentDescs.add(sid);
      }

      // Patch: ensure best state + real subagentId for navigation
      const realSid = sid || (desc ? descToSid.get(desc) : undefined);
      const best = realSid ? subagentBest.get(realSid) : undefined;
      if (best) {
        m.subagentTask.description = best.description || desc;
        m.subagentTask.status = best.status;
        m.subagentTask.terminationReason = best.terminationReason;
      }
      if (!sid && realSid) {
        m.subagentTask.subagentId = realSid;
      }

      // Mark all resolved identifiers as seen so later duplicates are skipped
      if (m.subagentTask.description) seenSubagentDescs.add(m.subagentTask.description);
      if (realSid) { seenSubagentDescs.add(realSid); seenSubagentIds.add(realSid); }

      result.unshift(m);
      continue;
    }

    // Question dedup — key on question prompts
    if (m.askQuestion?.questions?.length) {
      const key = m.askQuestion.questions.map(q => q.prompt).join('|');
      if (seenQuestions.has(key)) continue;
      seenQuestions.add(key);
      // Skip cancelled questions entirely — they're from context resets
      if (m.askQuestion.status === 'cancelled') continue;
      result.unshift(m);
      continue;
    }

    // Plan dedup — key on plan name
    if (m.plan) {
      const key = m.plan.name;
      if (seenPlans.has(key)) continue;
      seenPlans.add(key);
      result.unshift(m);
      continue;
    }

    // Text message dedup — key on type + text content
    if (m.text.length > 10) {
      const key = `${m.type}:${m.text}`;
      if (seenText.has(key)) continue;
      seenText.add(key);
    }

    result.unshift(m);
  }

  // Phase 3: Move orphaned assistant messages before the first user message
  // to just after it. Context window replays can cause agent output to appear
  // chronologically before the user prompt that triggered it.
  const firstUserIdx = result.findIndex(m => m.type === 1);
  if (firstUserIdx > 0) {
    const before = result.slice(0, firstUserIdx);
    const after = result.slice(firstUserIdx);
    // Insert the pre-user messages just after the user message
    after.splice(1, 0, ...before);
    return after;
  }

  return result;
}

function parseToolCall(tfd: any): ChatMessage['toolCall'] {
  const name = tfd?.name as string | undefined;
  if (!name) return undefined;

  let params: Record<string, any> = {};
  try { params = JSON.parse(tfd.params ?? '{}'); } catch { /* noop */ }

  const bn = (p: string | undefined) => {
    if (!p) return '?';
    const parts = p.split('/');
    return parts[parts.length - 1] || p;
  };
  const trunc = (s: string | undefined, n: number) => {
    if (!s) return '?';
    return s.length > n ? s.slice(0, n) + '...' : s;
  };

  switch (name) {
    case 'read_file_v2':
    case 'read_file': {
      const file = params.targetFile || params.filePath || '';
      return { tool: 'read', summary: `Read ${bn(file)}`, detail: file };
    }
    case 'edit_file_v2':
    case 'search_replace': {
      const file = params.targetFile || '';
      return { tool: 'edit', summary: `Edit ${bn(file)}`, detail: file };
    }
    case 'write': {
      const file = params.targetFile || '';
      return { tool: 'edit', summary: `Write ${bn(file)}`, detail: file };
    }
    case 'delete_file': {
      const file = params.targetFile || '';
      return { tool: 'edit', summary: `Delete ${bn(file)}`, detail: file };
    }
    case 'apply_patch': {
      const file = params.targetFile || '';
      return { tool: 'edit', summary: `Patch ${bn(file)}`, detail: file };
    }
    case 'run_terminal_command_v2':
    case 'run_terminal_cmd': {
      const cmd = params.command || '';
      return { tool: 'terminal', summary: `Run: ${trunc(cmd, 50)}`, detail: cmd };
    }
    case 'ripgrep_raw_search':
    case 'grep': {
      const pattern = params.pattern || params.query || '';
      return { tool: 'search', summary: `Search: ${trunc(pattern, 40)}`, detail: pattern };
    }
    case 'codebase_search':
    case 'semantic_search_full':
    case 'file_search': {
      const query = params.query || '';
      return { tool: 'search', summary: `Search: ${trunc(query, 40)}`, detail: query };
    }
    case 'glob_file_search': {
      const pattern = params.pattern || '';
      return { tool: 'search', summary: `Find: ${trunc(pattern, 40)}`, detail: pattern };
    }
    case 'list_dir_v2':
    case 'list_dir': {
      const dir = params.directory || params.path || '.';
      return { tool: 'read', summary: `List ${bn(dir)}`, detail: dir };
    }
    case 'web_search': {
      const q = params.query || '';
      return { tool: 'web', summary: `Web: ${trunc(q, 40)}`, detail: q };
    }
    case 'web_fetch': {
      const url = params.url || '';
      return { tool: 'web', summary: `Fetch: ${trunc(url, 50)}`, detail: url };
    }
    case 'read_lints':
      return { tool: 'read', summary: 'Read lint errors' };
    case 'todo_write':
      return { tool: 'edit', summary: 'Update TODOs' };
    default: {
      if (name.startsWith('mcp-')) {
        return { tool: 'mcp', summary: `MCP: ${name.slice(4)}` };
      }
      return { tool: 'other', summary: name };
    }
  }
}

export function getConversation(
  conversationId: string,
  limit = 50,
  before?: string,
): ConversationPage {
  const db = openReadonly(GLOBAL_STATE_DB);
  if (!db) return { messages: [], hasMore: false, oldestTimestamp: '', totalCount: 0 };

  try {
    const prefix = `bubbleId:${conversationId}:`;
    const rows = db
      .prepare('SELECT value FROM cursorDiskKV WHERE key >= ? AND key < ?')
      .all(prefix, prefix + '\xff') as { value: string }[];

    let messages: ChatMessage[] = [];
    for (const row of rows) {
      try {
        const msg = JSON.parse(row.value);
        if (!msg.bubbleId) continue;
        // Skip context window separators
        if (msg.capabilityType === 30) continue;

        // Build ask_question data if present
        let askQuestion: ChatMessage['askQuestion'];
        const tfd = msg.toolFormerData;
        if (tfd?.name === 'ask_question') {
          try {
            const params = JSON.parse(tfd.params ?? '{}');
            const questions: PendingQuestion[] = (params.questions ?? []).map((q: any) => ({
              id: q.id ?? '',
              prompt: q.prompt ?? '',
              options: (q.options ?? []).map((o: any) => ({ id: o.id ?? '', label: o.label ?? '' })),
            }));
            let answers: { questionId: string; selectedOptionIds: string[] }[] | undefined;
            if (tfd.result) {
              try {
                const r = JSON.parse(tfd.result);
                answers = r.answers;
              } catch { /* ignore */ }
            }
            askQuestion = {
              status: tfd.additionalData?.status ?? 'unknown',
              questions,
              answers,
            };
          } catch { /* malformed params */ }
        }

        // Build task_v2 (sub-agent) data if present
        let subagentTask: ChatMessage['subagentTask'];
        if (tfd?.name === 'task_v2') {
          try {
            const params = JSON.parse(tfd.params ?? '{}');
            const ad = tfd.additionalData ?? {};
            subagentTask = {
              description: params.description ?? '',
              status: ad.status ?? 'loading',
              terminationReason: ad.terminationReason ?? null,
              subagentId: ad.subagentComposerId ?? '',
            };
          } catch { /* malformed params */ }
        }

        // Build create_plan data if present
        let plan: ChatMessage['plan'];
        if (tfd?.name === 'create_plan') {
          try {
            const params = JSON.parse(tfd.params ?? '{}');
            const ad = tfd.additionalData ?? {};
            plan = {
              name: params.name ?? 'Plan',
              overview: params.overview ?? '',
              markdown: params.plan ?? '',
              todos: (params.todos ?? []).map((t: any) => ({
                id: t.id ?? '',
                content: t.content ?? '',
                status: t.status ?? 'pending',
              })),
              reviewStatus: ad.reviewData?.status ?? 'unknown',
            };
          } catch { /* malformed params */ }
        }

        // Build tool call data for activity signals
        let toolCall: ChatMessage['toolCall'];
        if (tfd && !['ask_question', 'task_v2', 'create_plan'].includes(tfd.name)) {
          toolCall = parseToolCall(tfd);
        }

        // Allow empty text for special bubble types
        if ((!msg.text || msg.text.length === 0) && !askQuestion && !subagentTask && !plan && !toolCall) continue;

        messages.push({
          bubbleId: msg.bubbleId,
          type: msg.type ?? 0,
          text: msg.text ?? '',
          createdAt: msg.createdAt ?? '',
          isAgentic: msg.isAgentic ?? false,
          askQuestion,
          subagentTask,
          plan,
          toolCall,
        });
      } catch {
        continue;
      }
    }

    // Sort chronologically
    messages.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));

    // Deduplicate context-window replays
    messages = deduplicateMessages(messages);

    // Strip intermediate thinking steps when agent is no longer running.
    // Thinking steps = very short assistant fragments (<80 chars) that are just
    // status updates like "Analyzing imports...", "Checking file..." etc.
    // Keep substantive short messages (progress summaries, conclusions).
    const last = messages[messages.length - 1];
    const ageMs = last ? Date.now() - new Date(last.createdAt).getTime() : Infinity;
    const isRunning = last && last.type === 2 && last.text.length < 300 && ageMs < 2 * 60_000;
    if (!isRunning) {
      messages = messages.filter(m => {
        if (m.toolCall || m.askQuestion || m.subagentTask || m.plan) return true;
        if (m.type !== 2) return true;
        if (m.text.length >= 80) return true;
        return false;
      });
    }

    const totalCount = messages.length;

    // If "before" cursor provided, slice messages before that timestamp
    if (before) {
      const idx = messages.findIndex((m) => m.createdAt >= before);
      if (idx > 0) {
        messages = messages.slice(0, idx);
      } else if (idx === 0) {
        return { messages: [], hasMore: false, oldestTimestamp: '', totalCount };
      }
    }

    // Take last N messages
    const hasMore = messages.length > limit;
    const sliced = messages.slice(-limit);
    const oldestTimestamp = sliced[0]?.createdAt ?? '';

    return { messages: sliced, hasMore, oldestTimestamp, totalCount };
  } finally {
    db.close();
  }
}

export interface PendingQuestion {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
}

export interface WaitingConversation {
  conversationId: string;
  workspaceHash: string;
  workspaceName: string;
  workspacePath: string;
  title: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  bubbleId: string | null;
  questions: PendingQuestion[];
}

export function getWaitingConversations(): WaitingConversation[] {
  const workspaces = listWorkspaces(true);
  const results: WaitingConversation[] = [];

  const db = openReadonly(GLOBAL_STATE_DB);
  if (!db) return results;

  try {
    const allMsgStmt = db.prepare(
      'SELECT key, value FROM cursorDiskKV WHERE key >= ? AND key < ?',
    );

    for (const ws of workspaces) {
      const conversations = listConversations(ws.hash);
      for (const conv of conversations) {
        if (conv.parentId) continue;
        if (!conv.lastMessageAt) continue;

        const ageMs = Date.now() - new Date(conv.lastMessageAt).getTime();
        if (ageMs > 60 * 60 * 1000) continue;

        const prefix = `bubbleId:${conv.id}:`;
        const rows = allMsgStmt.all(prefix, prefix + '\xff') as { key: string; value: string }[];

        // Look for pending ask_question bubbles
        let pendingQuestion: {
          bubbleId: string;
          questions: PendingQuestion[];
          createdAt: string;
        } | null = null;

        let lastAssistant: { text: string; createdAt: string } | null = null;
        let latestCreatedAt = '';
        let latestType = 0;

        for (const row of rows) {
          try {
            const msg = JSON.parse(row.value);
            if (!msg.createdAt) continue;

            if (msg.createdAt > latestCreatedAt) {
              latestCreatedAt = msg.createdAt;
              latestType = msg.type ?? 0;
            }

            // Check for pending ask_question tool
            const tfd = msg.toolFormerData;
            if (tfd?.name === 'ask_question' && tfd.additionalData?.status === 'pending') {
              try {
                const params = JSON.parse(tfd.params);
                const questions: PendingQuestion[] = (params.questions ?? []).map((q: any) => ({
                  id: q.id ?? '',
                  prompt: q.prompt ?? '',
                  options: (q.options ?? []).map((o: any) => ({
                    id: o.id ?? '',
                    label: o.label ?? '',
                  })),
                }));
                if (questions.length > 0) {
                  pendingQuestion = {
                    bubbleId: msg.bubbleId,
                    questions,
                    createdAt: msg.createdAt,
                  };
                }
              } catch { /* malformed params */ }
            }

            if (msg.type === 2 && msg.text && msg.text.length > 0) {
              if (!lastAssistant || msg.createdAt > lastAssistant.createdAt) {
                lastAssistant = { text: msg.text, createdAt: msg.createdAt };
              }
            }
          } catch { continue; }
        }

        // Prefer pending ask_question detection
        if (pendingQuestion) {
          results.push({
            conversationId: conv.id,
            workspaceHash: ws.hash,
            workspaceName: ws.name,
            workspacePath: ws.folder,
            title: conv.title,
            lastMessageAt: pendingQuestion.createdAt,
            lastMessagePreview: pendingQuestion.questions
              .map((q, i) => `${i + 1}. ${q.prompt}`)
              .join('\n'),
            bubbleId: pendingQuestion.bubbleId,
            questions: pendingQuestion.questions,
          });
          continue;
        }

        // Fallback: general "waiting" heuristic
        if (latestType !== 2) continue;
        if (!lastAssistant || lastAssistant.text.length < 200) continue;

        results.push({
          conversationId: conv.id,
          workspaceHash: ws.hash,
          workspaceName: ws.name,
          workspacePath: ws.folder,
          title: conv.title,
          lastMessageAt: conv.lastMessageAt,
          lastMessagePreview: lastAssistant.text.slice(0, 500),
          bubbleId: null,
          questions: [],
        });
      }
    }
  } finally {
    db.close();
  }

  return results;
}
