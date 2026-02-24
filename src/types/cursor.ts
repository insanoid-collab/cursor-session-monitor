import { z } from 'zod';

// Cursor hook stdin payloads — matches the actual format Cursor sends.
// See: https://blog.gitbutler.com/cursor-hooks-deep-dive

const baseFields = z.object({
  conversation_id: z.string().min(1),
  generation_id: z.string().optional(),
  hook_event_name: z.string(),
  workspace_roots: z.array(z.string()).optional(),
});

export const afterFileEditSchema = baseFields.extend({
  hook_event_name: z.literal('afterFileEdit'),
  file_path: z.string().min(1),
  edits: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const beforeShellExecutionSchema = baseFields.extend({
  hook_event_name: z.literal('beforeShellExecution'),
  command: z.string().min(1),
  cwd: z.string().optional(),
});

export const afterAgentResponseSchema = baseFields.extend({
  hook_event_name: z.literal('afterAgentResponse'),
  text: z.string().optional(),
});

export const stopSchema = baseFields.extend({
  hook_event_name: z.literal('stop'),
  status: z.string().optional(),
});

export type AfterFileEditPayload = z.infer<typeof afterFileEditSchema>;
export type BeforeShellExecutionPayload = z.infer<typeof beforeShellExecutionSchema>;
export type AfterAgentResponsePayload = z.infer<typeof afterAgentResponseSchema>;
export type StopPayload = z.infer<typeof stopSchema>;
