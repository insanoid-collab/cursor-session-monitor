import { spawn } from 'node:child_process';
import { logger } from '../utils/logger';

export interface ResumeResult {
  success: boolean;
  output: string;
}

export interface AgentState {
  startedAt: number;
  pid: number | undefined;
  output: string[];    // streaming output lines
  lastUpdate: number;  // timestamp of last output chunk
}

/** Max time before we log a warning (agent may legitimately run longer). */
const RESUME_WARN_MS = 5 * 60_000;

/** Track which conversations have an active agent process. */
const activeAgents = new Map<string, AgentState>();

/** Returns conversation IDs with an active agent resume in progress. */
export function getActiveAgents(): Map<string, AgentState> {
  return activeAgents;
}

/** Get streaming output for a specific agent. Returns null if no agent running. */
export function getAgentOutput(conversationId: string, afterLine = 0): { lines: string[]; totalLines: number; startedAt: number } | null {
  const agent = activeAgents.get(conversationId);
  if (!agent) return null;
  return {
    lines: agent.output.slice(afterLine),
    totalLines: agent.output.length,
    startedAt: agent.startedAt,
  };
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

  const agentState: AgentState = {
    startedAt: Date.now(),
    pid: child.pid,
    output: [],
    lastUpdate: Date.now(),
  };
  activeAgents.set(conversationId, agentState);

  let stdout = '';
  let stderr = '';
  let finished = false;
  let lineBuf = '';

  const cleanup = () => {
    activeAgents.delete(conversationId);
  };

  const warnTimer = setTimeout(() => {
    if (!finished) {
      logger.warn(`cursor agent still running after ${RESUME_WARN_MS / 60_000}min (pid=${child.pid})`);
    }
  }, RESUME_WARN_MS);

  child.stdout?.on('data', (data: Buffer) => {
    const chunk = data.toString();
    stdout += chunk;

    // Split into lines for streaming output
    lineBuf += chunk;
    const parts = lineBuf.split('\n');
    lineBuf = parts.pop() ?? '';
    for (const line of parts) {
      if (line.trim()) {
        agentState.output.push(line);
        agentState.lastUpdate = Date.now();
      }
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    stderr += data.toString();
  });

  child.on('close', (code) => {
    if (finished) return;
    finished = true;
    clearTimeout(warnTimer);
    // Flush remaining line buffer
    if (lineBuf.trim()) {
      agentState.output.push(lineBuf);
    }
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
