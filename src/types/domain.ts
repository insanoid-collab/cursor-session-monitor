export type AgentType = 'cursor' | 'claude' | 'codex';

export type SessionStatus = 'active' | 'idle' | 'completed';

export type NormalizedEventType =
  | 'session_start'
  | 'file_edit'
  | 'shell_exec'
  | 'session_end';

export interface NormalizedEvent {
  eventId: string;
  sessionId: string;
  agentType: AgentType;
  eventType: NormalizedEventType;
  timestamp: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface SessionRecord {
  sessionId: string;
  agentType: AgentType;
  status: SessionStatus;
  startedAt: string;
  lastActivity: string | null;
  completedAt: string | null;
  workingDirectory: string | null;
  needsAttention: number;
  attentionReason: string | null;
  metadata: string | null;
}
