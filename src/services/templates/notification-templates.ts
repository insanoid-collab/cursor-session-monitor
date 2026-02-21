export function sessionStartTemplate(sessionId: string, directory?: string | null): string {
  return `🆕 *Cursor Session Started*\n\nSession: ${sessionId}\nDirectory: ${directory ?? 'unknown'}`;
}

export function fileEditBatchTemplate(sessionId: string, files: string[]): string {
  const lines = files.slice(0, 15).map((file) => `• ${file}`).join('\n');
  const suffix = files.length > 15 ? `\n• ...and ${files.length - 15} more` : '';
  return `📝 *Cursor Activity* (Session ${sessionId})\n\nModified ${files.length} file(s):\n${lines}${suffix}`;
}

export function shellBatchTemplate(sessionId: string, commands: string[]): string {
  const lines = commands.slice(0, 10).map((cmd) => `• \`${cmd}\``).join('\n');
  return `⚡ *Cursor Shell* (Session ${sessionId})\n\nCommands (${commands.length}):\n${lines}`;
}

export function dangerousCommandTemplate(sessionId: string, command: string, directory?: string | null): string {
  return `⚠️ *Cursor Needs Attention* (Session ${sessionId})\n\nDangerous command detected:\n\`${command}\`\n\nDirectory: ${directory ?? 'unknown'}`;
}

export function sessionCompleteTemplate(
  sessionId: string,
  summary: { filesModified: number; commandsExecuted: number; durationMinutes: number },
): string {
  return `✅ *Cursor Session Complete* (Session ${sessionId})\n\nDuration: ${summary.durationMinutes}m\nFiles modified: ${summary.filesModified}\nCommands: ${summary.commandsExecuted}`;
}
