import { z } from 'zod';

const unixTs = z.number().int().positive().optional();

export const afterFileEditSchema = z.object({
  event: z.literal('afterFileEdit'),
  sessionId: z.string().min(1),
  filePath: z.string().min(1),
  timestamp: unixTs,
  cwd: z.string().optional(),
  changes: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const beforeShellExecutionSchema = z.object({
  event: z.literal('beforeShellExecution'),
  sessionId: z.string().min(1),
  command: z.string().min(1),
  cwd: z.string().optional(),
  timestamp: unixTs,
});

export const stopSchema = z.object({
  event: z.literal('stop'),
  sessionId: z.string().min(1),
  timestamp: unixTs,
});

export type AfterFileEditPayload = z.infer<typeof afterFileEditSchema>;
export type BeforeShellExecutionPayload = z.infer<typeof beforeShellExecutionSchema>;
export type StopPayload = z.infer<typeof stopSchema>;
