import { spawn } from 'node:child_process';
import { logger } from '../utils/logger';

export interface ResumeResult {
  success: boolean;
  output: string;
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
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (data: Buffer) => {
    stdout += data.toString();
  });

  child.stderr.on('data', (data: Buffer) => {
    stderr += data.toString();
  });

  child.on('close', (code) => {
    if (code !== 0) {
      logger.error(`cursor agent exited with code ${code}: ${stderr || stdout}`);
      onComplete?.({ success: false, output: stderr || stdout });
    } else {
      logger.info(`cursor agent completed (${stdout.length} chars output)`);
      onComplete?.({ success: true, output: stdout });
    }
  });

  child.on('error', (err) => {
    logger.error(`cursor agent spawn failed: ${String(err)}`);
    onComplete?.({ success: false, output: String(err) });
  });
}
