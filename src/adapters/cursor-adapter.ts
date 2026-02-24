import { nanoid } from 'nanoid';
import { AgentAdapter } from './agent-adapter';
import {
  afterAgentResponseSchema,
  afterFileEditSchema,
  beforeShellExecutionSchema,
  stopSchema,
} from '../types/cursor';
import { NormalizedEvent } from '../types/domain';

export class CursorAdapter implements AgentAdapter {
  parseEvent(payload: unknown): NormalizedEvent {
    const eventName = (payload as { hook_event_name?: string })?.hook_event_name;
    const now = new Date().toISOString();

    if (eventName === 'afterFileEdit') {
      const parsed = afterFileEditSchema.parse(payload);
      const cwd = parsed.workspace_roots?.[0] ?? null;
      return {
        eventId: nanoid(),
        sessionId: parsed.conversation_id,
        agentType: 'cursor',
        eventType: 'file_edit',
        timestamp: now,
        payload: parsed,
        metadata: { filePath: parsed.file_path, cwd },
      };
    }

    if (eventName === 'beforeShellExecution') {
      const parsed = beforeShellExecutionSchema.parse(payload);
      const cwd = parsed.cwd || parsed.workspace_roots?.[0] || null;
      return {
        eventId: nanoid(),
        sessionId: parsed.conversation_id,
        agentType: 'cursor',
        eventType: 'shell_exec',
        timestamp: now,
        payload: parsed,
        metadata: { command: parsed.command, cwd },
      };
    }

    if (eventName === 'afterAgentResponse') {
      const parsed = afterAgentResponseSchema.parse(payload);
      const cwd = parsed.workspace_roots?.[0] ?? null;
      return {
        eventId: nanoid(),
        sessionId: parsed.conversation_id,
        agentType: 'cursor',
        eventType: 'agent_response',
        timestamp: now,
        payload: parsed,
        metadata: { text: parsed.text ?? '', cwd },
      };
    }

    if (eventName === 'stop') {
      const parsed = stopSchema.parse(payload);
      return {
        eventId: nanoid(),
        sessionId: parsed.conversation_id,
        agentType: 'cursor',
        eventType: 'session_end',
        timestamp: now,
        payload: parsed,
        metadata: { status: parsed.status ?? null },
      };
    }

    throw new Error(`Unsupported cursor event: ${eventName}`);
  }
}
