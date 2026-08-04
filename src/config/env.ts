/**
 * Centralized environment configuration and validation.
 * Secrets are read here and never re-exposed via getters that leak them.
 */
import { z } from 'zod';

const envSchema = z.object({
  PORT: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 3000))
    .refine((v) => Number.isInteger(v) && v > 0 && v < 65536, {
      message: 'PORT must be a valid integer between 1 and 65535',
    }),
  NVIDIA_API_KEY: z
    .string()
    .min(1, 'NVIDIA_API_KEY is required and must not be empty'),
  SERVICE_NAME: z.string().optional().default('opencode-samira-agent'),
  SERVICE_VERSION: z.string().optional().default('0.1.0'),
  LOG_LEVEL: z
    .string()
    .optional()
    .default('info')
    .refine(
      (v) =>
        ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(v),
      { message: 'Invalid LOG_LEVEL' },
    ),
  AGENT_MODEL: z
    .string()
    .optional()
    .default('nvidia/llama-3.1-nemotron-70b-instruct'),
  AGENT_MAX_TOKENS: z
    .string()
    .optional()
    .default('1024')
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, {
      message: 'AGENT_MAX_TOKENS must be a positive integer',
    }),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}

/**
 * Returns true when the NVIDIA API key has been configured.
 * Used by status endpoint without leaking the actual value.
 */
export function hasNvidiaApiKey(): boolean {
  try {
    return Boolean(getEnv().NVIDIA_API_KEY);
  } catch {
    return false;
  }
}

/**
 * Returns the NVIDIA API key for use in backend calls only.
 * Never log or return this value from HTTP handlers.
 */
export function getNvidiaApiKey(): string {
  return getEnv().NVIDIA_API_KEY;
}
