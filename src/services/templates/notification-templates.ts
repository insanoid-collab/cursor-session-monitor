import path from 'node:path';

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function projectName(dir?: string | null): string {
  if (!dir) return 'unknown';
  return path.basename(dir);
}

function shortDir(dir?: string | null): string {
  if (!dir) return 'unknown';
  const parts = dir.split(path.sep).filter(Boolean);
  return parts.slice(-2).join('/');
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (seconds < 3600) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function dangerousCommandTemplate(sessionId: string, command: string, directory?: string | null): string {
  const project = esc(projectName(directory));
  return [
    `⚠️ <b>Attention Required</b>`,
    ``,
    `Project: <b>${project}</b>`,
    `Command: <code>${esc(command)}</code>`,
    `Directory: ${esc(shortDir(directory))}`,
  ].join('\n');
}

export interface SessionSummary {
  workingDirectory: string | null;
  filesModified: number;
  files: string[];
  commandsExecuted: number;
  flaggedCommands: string[];
  durationSeconds: number;
  lastResponseText?: string | null;
}

export function sessionCompleteTemplate(sessionId: string, summary: SessionSummary): string {
  const project = esc(projectName(summary.workingDirectory));
  const duration = formatDuration(summary.durationSeconds);

  const lines: string[] = [
    `✅ <b>Session Complete</b>`,
    ``,
    `Project: <b>${project}</b> (${esc(shortDir(summary.workingDirectory))})`,
    `Duration: ${duration} | Files: ${summary.filesModified} | Commands: ${summary.commandsExecuted}`,
  ];

  if (summary.lastResponseText) {
    lines.push('');
    lines.push(`<blockquote expandable>${esc(summary.lastResponseText)}</blockquote>`);
  }

  if (summary.flaggedCommands.length > 0) {
    lines.push('');
    lines.push('⚠️ Flagged commands:');
    for (const cmd of summary.flaggedCommands) {
      lines.push(`• <code>${esc(cmd)}</code>`);
    }
  }

  return lines.join('\n');
}

const OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface NeedsInputData {
  workspaceName: string;
  title: string;
  lastMessagePreview: string;
  timeAgo: string;
  questions?: { id: string; prompt: string; options: { id: string; label: string }[] }[];
}

export function needsInputTemplate(conv: NeedsInputData): string {
  const lines: string[] = [
    `🟠 <b>Needs Input</b>`,
    ``,
    `Project: <b>${esc(conv.workspaceName)}</b>`,
    `Chat: "${esc(conv.title.slice(0, 60))}"`,
    `${conv.timeAgo}`,
  ];

  if (conv.questions && conv.questions.length > 0) {
    lines.push('');
    for (let qi = 0; qi < conv.questions.length; qi++) {
      const q = conv.questions[qi];
      lines.push(`<b>${qi + 1}.</b> ${esc(q.prompt)}`);
      for (let oi = 0; oi < q.options.length; oi++) {
        const letter = OPTION_LETTERS[oi] ?? String(oi);
        lines.push(`  <b>${letter}</b>  ${esc(q.options[oi].label)}`);
      }
      if (qi < conv.questions.length - 1) lines.push('');
    }
    lines.push('');
    if (conv.questions.length === 1) {
      lines.push('<i>Reply with a letter (A, B, ...) or type your own answer.</i>');
    } else {
      lines.push('<i>Reply with letters for each question (e.g. "A B") or type your own answer.</i>');
    }
  } else if (conv.lastMessagePreview) {
    lines.push('');
    lines.push(`<blockquote expandable>${esc(conv.lastMessagePreview)}</blockquote>`);
    lines.push('');
    lines.push('<i>Reply to this message to respond.</i>');
  }

  return lines.join('\n');
}
