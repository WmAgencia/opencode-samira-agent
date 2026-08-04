import { z } from 'zod';

export const agentRequestSchema = z.object({
  task: z
    .string()
    .min(1, 'task must be a non-empty string')
    .max(8000, 'task must be at most 8000 characters'),
});

export type AgentRequest = z.infer<typeof agentRequestSchema>;

export interface AgentResponse {
  task: string;
  result: string;
  model: string;
  latencyMs: number;
}

export interface HealthResponse {
  status: 'ok';
  uptime: number;
}

export interface StatusResponse {
  service: string;
  version: string;
  status: 'operational';
  uptime: number;
  nvidiaApiKeyConfigured: boolean;
  model: string;
  timestamp: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
