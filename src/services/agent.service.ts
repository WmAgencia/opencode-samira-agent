/**
 * Samira agent service.
 *
 * Bridges HTTP requests to the NVIDIA API on the backend only.
 * The API key is never exposed to clients or logs.
 *
 * NOTE: This is a minimal SDK-style implementation using fetch.
 * It is ready to be swapped for OpenCode's agent runner in a later step.
 */
import { getEnv, getNvidiaApiKey } from '../config/env.js';
import { getLogger } from '../utils/logger.js';
import type { AgentResponse } from '../types.js';

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

interface NvidiaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface NvidiaChatRequestBody {
  model: string;
  messages: NvidiaChatMessage[];
  max_tokens: number;
  temperature: number;
  top_p: number;
  stream: boolean;
}

interface NvidiaChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export async function runAgent(task: string): Promise<AgentResponse> {
  const env = getEnv();
  const log = getLogger();
  const start = Date.now();

  log.info({ taskLength: task.length }, 'agent: starting task');

  const body: NvidiaChatRequestBody = {
    model: env.AGENT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are Samira, a focused software engineering agent. ' +
          'Answer concisely and helpfully.',
      },
      { role: 'user', content: task },
    ],
    max_tokens: env.AGENT_MAX_TOKENS,
    temperature: 0.2,
    top_p: 0.7,
    stream: false,
  };

  let resultText: string;

  try {
    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getNvidiaApiKey()}`,
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    const raw = await response.text();

    if (!response.ok) {
      log.error(
        {
          status: response.status,
          // log only generic failure markers, never the body (could echo key)
        },
        'agent: NVIDIA API returned non-OK status',
      );
      throw new Error(
        `NVIDIA API request failed with status ${response.status}`,
      );
    }

    let parsed: NvidiaChatResponse;
    try {
      parsed = JSON.parse(raw) as NvidiaChatResponse;
    } catch {
      throw new Error('NVIDIA API returned non-JSON response');
    }

    if (parsed.error) {
      throw new Error(`NVIDIA API error: ${parsed.error.message ?? 'unknown'}`);
    }

    resultText = parsed.choices?.[0]?.message?.content?.trim() ?? '';
    if (!resultText) {
      resultText = '[no content returned by the model]';
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown agent error';
    log.error({ errMessage: message }, 'agent: execution failed');
    throw new Error(`Agent execution failed: ${message}`);
  }

  const latencyMs = Date.now() - start;
  log.info({ latencyMs }, 'agent: task completed');

  return {
    task,
    result: resultText,
    model: env.AGENT_MODEL,
    latencyMs,
  };
}
