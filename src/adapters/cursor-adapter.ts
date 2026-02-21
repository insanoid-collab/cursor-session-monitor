import { nanoid } from 'nanoid';
import { AgentAdapter } from './agent-adapter';
import {
  afterFileEditSchema,
  beforeShellExecutionSchema,
  stopSchema,
} from '../types/cursor';
import { NormalizedEvent } from '../types/domain';

const iso = (unixTs?: number) => (unixTs ? new Date(unixTs * 1000).toISOString() : new Date().toISOString());

export class CursorAdapter implements AgentAdapter {
  parseEvent(payload: unknown): NormalizedEvent {
    const eventName = (payload as { event?: string })?.event;

    if (eventName === 'afterFileEdit') {
      const parsed = afterFileEditSchema.parse(payload);
      return {
        eventId: nanoid(),
        sessionId: parsed.sessionId,
        agentType: 'cursor',
        eventType: 'file_edit',
        timestamp: iso(parsed.timestamp),
        payload: parsed,
        metadata: { filePath: parsed.filePath, cwd: parsed.cwd ?? null },
      };
    }

    if (eventName === 'beforeShellExecution') {
      const parsed = beforeShellExecutionSchema.parse(payload);
      return {
        eventId: nanoid(),
        sessionId: parsed.sessionId,
        agentType: 'cursor',
        eventType: 'shell_exec',
        timestamp: iso(parsed.timestamp),
        payload: parsed,
        metadata: { command: parsed.command, cwd: parsed.cwd ?? null },
      };
    }

    if (eventName === 'stop') {
      const parsed = stopSchema.parse(payload);
      return {
        eventId: nanoid(),
        sessionId: parsed.sessionId,
        agentType: 'cursor',
        eventType: 'session_end',
        timestamp: iso(parsed.timestamp),
        payload: parsed,
        metadata: {},
      };
    }

    throw new Error('Unsupported cursor event');
  }
}
