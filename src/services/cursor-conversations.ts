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
}

export interface ChatMessage {
  bubbleId: string;
  type: number;
  text: string;
  createdAt: string;
  isAgentic: boolean;
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
        if (!msg.text || msg.text.length === 0) continue;
        messages.push({
          bubbleId: msg.bubbleId,
          type: msg.type ?? 0,
          text: msg.text ?? '',
          createdAt: msg.createdAt ?? '',
          isAgentic: msg.isAgentic ?? false,
        });
      } catch {
        continue;
      }
    }

    // Sort chronologically
    messages.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
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

export interface WaitingConversation {
  conversationId: string;
  workspaceHash: string;
  workspaceName: string;
  workspacePath: string;
  title: string;
  lastMessageAt: string;
  lastMessagePreview: string;
}

export function getWaitingConversations(): WaitingConversation[] {
  const workspaces = listWorkspaces(true);
  const results: WaitingConversation[] = [];

  const db = openReadonly(GLOBAL_STATE_DB);
  if (!db) return results;

  try {
    const allMsgStmt = db.prepare(
      'SELECT value FROM cursorDiskKV WHERE key >= ? AND key < ?',
    );

    for (const ws of workspaces) {
      const conversations = listConversations(ws.hash);
      for (const conv of conversations) {
        if (conv.parentId) continue; // only root conversations
        if (!conv.lastMessageAt) continue;

        const ageMs = Date.now() - new Date(conv.lastMessageAt).getTime();
        if (ageMs > 60 * 60 * 1000) continue; // within 60 minutes

        // Find the actual last message by parsing all and sorting by createdAt
        const prefix = `bubbleId:${conv.id}:`;
        const rows = allMsgStmt.all(prefix, prefix + '\xff') as { value: string }[];

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
            if (msg.type === 2 && msg.text && msg.text.length > 0) {
              if (!lastAssistant || msg.createdAt > lastAssistant.createdAt) {
                lastAssistant = { text: msg.text, createdAt: msg.createdAt };
              }
            }
          } catch { continue; }
        }

        // The latest message must be from the assistant (type 2)
        if (latestType !== 2) continue;
        // Must have a substantial assistant response (not just a thinking step)
        if (!lastAssistant || lastAssistant.text.length < 200) continue;

        results.push({
          conversationId: conv.id,
          workspaceHash: ws.hash,
          workspaceName: ws.name,
          workspacePath: ws.folder,
          title: conv.title,
          lastMessageAt: conv.lastMessageAt,
          lastMessagePreview: lastAssistant.text.slice(0, 500),
        });
      }
    }
  } finally {
    db.close();
  }

  return results;
}
