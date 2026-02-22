import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger';

const GLOBAL_STATE_DB = path.join(
  process.env.HOME ?? '',
  'Library',
  'Application Support',
  'Cursor',
  'User',
  'globalStorage',
  'state.vscdb',
);

interface MinimalBubble {
  _v: number;
  type: number; // 1 = user, 2 = assistant
  bubbleId: string;
  text: string;
  createdAt: string;
  isAgentic: boolean;
  unifiedMode: number;
  // Required empty arrays to match schema
  approximateLintErrors: never[];
  lints: never[];
  codebaseContextChunks: never[];
  commits: never[];
  pullRequests: never[];
  attachedCodeChunks: never[];
  assistantSuggestedDiffs: never[];
  gitDiffs: never[];
  interpreterResults: never[];
  images: never[];
  suggestedCodeBlocks: never[];
  toolResults: never[];
  cursorRules: never[];
  allThinkingBlocks: never[];
}

function createBubble(type: 1 | 2, text: string): MinimalBubble {
  return {
    _v: 3,
    type,
    bubbleId: randomUUID(),
    text,
    createdAt: new Date().toISOString(),
    isAgentic: true,
    unifiedMode: type === 1 ? 1 : 2,
    approximateLintErrors: [],
    lints: [],
    codebaseContextChunks: [],
    commits: [],
    pullRequests: [],
    attachedCodeChunks: [],
    assistantSuggestedDiffs: [],
    gitDiffs: [],
    interpreterResults: [],
    images: [],
    suggestedCodeBlocks: [],
    toolResults: [],
    cursorRules: [],
    allThinkingBlocks: [],
  };
}

export interface QuestionAnswer {
  questionId: string;
  selectedOptionId: string;
  freeformText?: string;
}

/**
 * Write structured answers back to a pending ask_question bubble in Cursor's DB.
 * This mimics what the Cursor GUI does when the user clicks option buttons.
 */
export function submitQuestionAnswer(
  conversationId: string,
  bubbleId: string,
  answers: QuestionAnswer[],
): boolean {
  if (!fs.existsSync(GLOBAL_STATE_DB)) {
    logger.warn(`cursor state db not found: ${GLOBAL_STATE_DB}`);
    return false;
  }

  let db: Database.Database | null = null;
  try {
    db = new Database(GLOBAL_STATE_DB);
    const key = `bubbleId:${conversationId}:${bubbleId}`;
    const row = db
      .prepare('SELECT value FROM cursorDiskKV WHERE key = ?')
      .get(key) as { value: string } | undefined;

    if (!row) {
      logger.warn(`ask_question bubble not found: ${key}`);
      return false;
    }

    const bubble = JSON.parse(row.value);
    const tfd = bubble.toolFormerData;
    if (!tfd || tfd.name !== 'ask_question') {
      logger.warn(`bubble ${key} is not an ask_question`);
      return false;
    }

    // Build currentSelections: { [questionId]: [selectedOptionId] }
    const currentSelections: Record<string, string[]> = {};
    const freeformTexts: Record<string, string> = {};
    for (const a of answers) {
      currentSelections[a.questionId] = [a.selectedOptionId];
      freeformTexts[a.questionId] = a.freeformText ?? '';
    }

    // Update additionalData
    tfd.additionalData = {
      ...tfd.additionalData,
      status: 'submitted',
      currentSelections,
      freeformTexts,
    };

    // Build result
    tfd.result = JSON.stringify({
      answers: answers.map(a => ({
        questionId: a.questionId,
        selectedOptionIds: [a.selectedOptionId],
      })),
    });

    tfd.userDecision = 'accepted';

    db.prepare('INSERT OR REPLACE INTO cursorDiskKV (key, value) VALUES (?, ?)')
      .run(key, JSON.stringify(bubble));

    logger.info(`submitted answers for ask_question bubble ${bubbleId} in conversation ${conversationId}`);
    return true;
  } catch (err) {
    logger.error(`failed to submit question answer: ${String(err)}`);
    return false;
  } finally {
    db?.close();
  }
}

/**
 * Approve or reject a create_plan bubble in Cursor's DB.
 * Mimics what the Cursor GUI does when the user clicks Build/Reject.
 */
export function submitPlanReview(
  conversationId: string,
  bubbleId: string,
  action: 'approve' | 'reject',
): boolean {
  if (!fs.existsSync(GLOBAL_STATE_DB)) {
    logger.warn(`cursor state db not found: ${GLOBAL_STATE_DB}`);
    return false;
  }

  let db: Database.Database | null = null;
  try {
    db = new Database(GLOBAL_STATE_DB);
    const key = `bubbleId:${conversationId}:${bubbleId}`;
    const row = db
      .prepare('SELECT value FROM cursorDiskKV WHERE key = ?')
      .get(key) as { value: string } | undefined;

    if (!row) {
      logger.warn(`create_plan bubble not found: ${key}`);
      return false;
    }

    const bubble = JSON.parse(row.value);
    const tfd = bubble.toolFormerData;
    if (!tfd || tfd.name !== 'create_plan') {
      logger.warn(`bubble ${key} is not a create_plan`);
      return false;
    }

    const approved = action === 'approve';
    tfd.additionalData = {
      ...tfd.additionalData,
      reviewData: {
        ...tfd.additionalData?.reviewData,
        status: approved ? 'Approved' : 'Rejected',
        selectedOption: approved ? 'approve' : 'reject',
      },
    };

    tfd.result = JSON.stringify(approved ? {} : { rejected: {} });
    tfd.userDecision = approved ? 'accepted' : 'rejected';

    db.prepare('INSERT OR REPLACE INTO cursorDiskKV (key, value) VALUES (?, ?)')
      .run(key, JSON.stringify(bubble));

    logger.info(`${action}d plan bubble ${bubbleId} in conversation ${conversationId}`);
    return true;
  } catch (err) {
    logger.error(`failed to ${action} plan: ${String(err)}`);
    return false;
  } finally {
    db?.close();
  }
}

export function appendToConversation(
  conversationId: string,
  prompt: string,
  response: string,
): void {
  if (!fs.existsSync(GLOBAL_STATE_DB)) {
    logger.warn(`cursor state db not found: ${GLOBAL_STATE_DB}`);
    return;
  }

  let db: Database.Database | null = null;
  try {
    db = new Database(GLOBAL_STATE_DB);

    // Verify this conversation exists in the DB (range query for index use)
    const prefix = `bubbleId:${conversationId}:`;
    const existing = db
      .prepare('SELECT COUNT(*) as cnt FROM cursorDiskKV WHERE key >= ? AND key < ?')
      .get(prefix, prefix + '\xff') as { cnt: number } | undefined;

    if (!existing || existing.cnt === 0) {
      logger.info(`conversation ${conversationId} not found in cursor DB, skipping memory injection`);
      return;
    }

    // Create user bubble (the Telegram prompt)
    const userBubble = createBubble(1, `[via Telegram] ${prompt}`);
    const userKey = `bubbleId:${conversationId}:${userBubble.bubbleId}`;

    // Create assistant bubble (the agent response) — offset timestamp by 1ms
    // so it always sorts after the user bubble in the conversation view.
    const assistantBubble = createBubble(2, response);
    assistantBubble.createdAt = new Date(Date.now() + 1).toISOString();
    const assistantKey = `bubbleId:${conversationId}:${assistantBubble.bubbleId}`;

    const insert = db.prepare(
      'INSERT OR REPLACE INTO cursorDiskKV (key, value) VALUES (?, ?)',
    );

    const tx = db.transaction(() => {
      insert.run(userKey, JSON.stringify(userBubble));
      insert.run(assistantKey, JSON.stringify(assistantBubble));
    });

    tx();
    logger.info(
      `injected 2 bubbles into conversation ${conversationId} (user: ${userBubble.bubbleId}, assistant: ${assistantBubble.bubbleId})`,
    );
  } catch (err) {
    logger.error(`failed to inject into cursor conversation: ${String(err)}`);
  } finally {
    db?.close();
  }
}
