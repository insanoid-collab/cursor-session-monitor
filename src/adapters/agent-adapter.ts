import { NormalizedEvent } from '../types/domain';

export interface AgentAdapter<TPayload = unknown> {
  parseEvent(payload: TPayload): NormalizedEvent;
}
