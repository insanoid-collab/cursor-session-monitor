import { spawn } from 'node:child_process';
import { logger } from '../utils/logger';

export interface ResumeResult {
  success: boolean;
  output: string;
}

/** Max time before we log a warning (agent may legitimately run longer). */
const RESUME_WARN_MS = 5 * 60_000;

/** Track which conversations have an active agent process. */
const activeAgents = new Map<string, { startedAt: number; pid: number | undefined }>();

/** Returns conversation IDs with an active agent resume in progress. */
export function getActiveAgents(): Map<string, { startedAt: number; pid: number | undefined }> {
  return activeAgents;
}

export function resumeConversation(
  conversationId: string,
  prompt: string,
  workspacePath?: string | null,
  onComplete?: (result: ResumeResult) => void,
): void {
  const args = ['agent', '--resume', conversationId, '--trust', '--yolo', '--print'];
  if (workspacePath) {
    args.push('--workspace', workspacePath);
  }
  args.push(prompt);

  logger.info(`cursor cli: cursor ${args.join(' ')}`);

  const child = spawn('cursor', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    cwd: workspacePath || undefined,
  });

  // Unref so the child doesn't prevent the server from exiting cleanly,
  // but we still capture output while the server is alive.
  child.unref();

  activeAgents.set(conversationId, { startedAt: Date.now(), pid: child.pid });

  let stdout = '';
  let stderr = '';
  let finished = false;

  const cleanup = () => {
    activeAgents.delete(conversationId);
  };

  const warnTimer = setTimeout(() => {
    if (!finished) {
      logger.warn(`cursor agent still running after ${RESUME_WARN_MS / 60_000}min (pid=${child.pid})`);
    }
  }, RESUME_WARN_MS);

  child.stdout?.on('data', (data: Buffer) => {
    stdout += data.toString();
  });

  child.stderr?.on('data', (data: Buffer) => {
    stderr += data.toString();
  });

  child.on('close', (code) => {
    if (finished) return;
    finished = true;
    clearTimeout(warnTimer);
    cleanup();
    if (code !== 0) {
      logger.error(`cursor agent exited with code ${code}: ${stderr || stdout}`);
      onComplete?.({ success: false, output: stderr || stdout });
    } else {
      logger.info(`cursor agent completed (${stdout.length} chars output)`);
      onComplete?.({ success: true, output: stdout });
    }
  });

  child.on('error', (err) => {
    if (finished) return;
    finished = true;
    clearTimeout(warnTimer);
    cleanup();
    logger.error(`cursor agent spawn failed: ${String(err)}`);
    onComplete?.({ success: false, output: String(err) });
  });
}
