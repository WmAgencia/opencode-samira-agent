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

  SERVICE_NAME: z
    .string()
    .optional()
    .default('opencode-samira-agent'),

  SERVICE_VERSION: z
    .string()
    .optional()
    .default('0.1.0'),

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
    .default('z-ai/glm-5.2'),

  AGENT_MAX_TOKENS: z
    .string()
    .optional()
    .default('1024')
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, {
      message: 'AGENT_MAX_TOKENS must be a positive integer',
    }),

  // === Evolution API integration (webhook MVP) ===
  EVOLUTION_API_URL: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^https?:\/\//.test(v) || v === 'mock://evolution',
      { message: 'EVOLUTION_API_URL must start with http://, https:// or be "mock://evolution"' },
    ),

  EVOLUTION_API_KEY: z
    .string()
    .optional(),

  EVOLUTION_INSTANCE_NAME: z
    .string()
    .optional(),

  WEBHOOK_SECRET: z
    .string()
    .optional(),

  EVOLUTION_WEBHOOK_EVENTS: z
    .string()
    .optional()
    .default('messages.upsert,messages.upsert-ephemeral')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),

  EVOLUTION_AGENT_CONCURRENCY: z
    .string()
    .optional()
    .default('1')
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, {
      message: 'EVOLUTION_AGENT_CONCURRENCY must be a positive integer',
    }),

  // === Agent loop + tools ===
  AGENT_ENABLE_TOOLS: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),

  AGENT_ALLOWED_PERMS: z
    .string()
    .optional()
    .default('READ'),

  AGENT_ALLOWED_TOOLS: z
    .string()
    .optional()
    .default(''),

  AGENT_ALLOWED_DIR: z
    .string()
    .optional()
    .default(''),

  AGENT_MAX_ITERATIONS: z
    .string()
    .optional()
    .default('6')
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v >= 1 && v <= 20, {
      message: 'AGENT_MAX_ITERATIONS must be an integer between 1 and 20',
    }),

  AGENT_TOOL_TIMEOUT_MS: z
    .string()
    .optional()
    .default('15000')
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, {
      message: 'AGENT_TOOL_TIMEOUT_MS must be a positive integer',
    }),

  AGENT_MODEL_SUPPORTS_TOOLS: z
    .string()
    .optional()
    .default('auto')
    .refine((v) => ['auto', 'true', 'false'].includes(v), {
      message: 'AGENT_MODEL_SUPPORTS_TOOLS must be auto|true|false',
    }),

  // === Persistence (Etapa 2B) ===
  DATABASE_URL: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^postgres(ql)?:\/\//.test(v),
      { message: 'DATABASE_URL must start with postgres:// or postgresql://' },
    ),

  // === Public API (Site Samira Revela) ===

  // Bearer token that the site must send as `Authorization: Bearer <AGENT_API_KEY>`
  // on every call to POST /api/chat. Lives only server-side. When unset, the
  // /api/chat endpoint refuses requests with 503 (never serves open by default).
  AGENT_API_KEY: z.string().optional(),

  // Comma-separated origin allowlist for CORS. Only these origins may call the
  // API from a browser. Use the literal "*" only for local dev (allows all).
  // When unset, cross-origin requests are blocked (no CORS headers emitted).
  // Example: ALLOWED_ORIGINS=https://samirarevela.com.br,https://www.samirarevela.com.br
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),

  // === Scheduling / availability (site agenda) ===

  // Endpoint on the site that returns already-booked appointments so the agent
  // can tell which times are still free. JSON: array of date/time strings,
  // array of objects with start/date/time fields, or {appointments: [...]}.
  // When unset, consultar_horarios reports it cannot determine availability.
  AGENDA_API_URL: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//.test(v), {
      message: 'AGENDA_API_URL must start with http:// or https://',
    }),

  // WhatsApp JID of the admin group notified when a client is left waiting.
  // Used by notify_admin_group (requires Evolution API configured here).
  AGENT_ADMIN_GROUP_JID: z.string().optional(),

  // === Rate limiting (Etapa 2C) ===
  RATE_LIMIT_MAX: z
    .string()
    .optional()
    .default('60')
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, {
      message: 'RATE_LIMIT_MAX must be a positive integer',
    }),

  RATE_LIMIT_WINDOW: z
    .string()
    .optional()
    .default('60')
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, {
      message: 'RATE_LIMIT_WINDOW must be a positive integer (seconds)',
    }),

  // === Evolution API production hardening (Etapa 2D) ===
  EVOLUTION_ALLOWED_INSTANCES: z
    .string()
    .optional()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),

  // JIDs of allowed group chats (e.g. "120363xxx@g.us"). Empty => all groups
  // allowed. Single-PC anti-spam defense.
  EVOLUTION_ALLOWED_GROUPS: z
    .string()
    .optional()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),

  // When true, in group chats the agent only replies when its number is
  // mentioned (pushName appears in the message body or quotedJid matches).
  // Default false because single-chat is the primary use case.
  EVOLUTION_MENTION_ONLY: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),

  EVOLUTION_SENDTEXT_MAX_RETRIES: z
    .string()
    .optional()
    .default('3')
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v >= 1 && v <= 10, {
      message: 'EVOLUTION_SENDTEXT_MAX_RETRIES must be an integer 1..10',
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
  if (!cached) {
    cached = loadEnv();
  }

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

/**
 * Returns true when Evolution API configuration is available.
 * Used by status endpoint without leaking values.
 */
export function hasEvolutionConfig(): boolean {
  try {
    const e = getEnv();
    return Boolean(
      e.EVOLUTION_API_URL && e.EVOLUTION_API_KEY && e.EVOLUTION_INSTANCE_NAME,
    );
  } catch {
    return false;
  }
}

/**
 * Returns the WEBHOOK_SECRET for validating Evolution webhook calls.
 * Never log or return this value from HTTP handlers.
 */
export function getWebhookSecret(): string | undefined {
  return getEnv().WEBHOOK_SECRET;
}

/**
 * Returns true when DATABASE_URL has been configured.
 * Used by status and health endpoints without leaking the URL.
 */
export function hasDatabase(): boolean {
  try {
    return Boolean(getEnv().DATABASE_URL);
  } catch {
    return false;
  }
}

/**
 * Returns the DATABASE_URL for the pg pool. Throws if not set.
 * Never log or return this value from HTTP handlers.
 */
export function getDatabaseUrl(): string {
  const e = getEnv();
  if (!e.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  return e.DATABASE_URL;
}

/**
 * Returns true when AGENT_API_KEY is configured.
 * Used by status endpoint and /api/chat preHandler without leaking the value.
 */
export function hasAgentApiKey(): boolean {
  try {
    return Boolean(getEnv().AGENT_API_KEY);
  } catch {
    return false;
  }
}

/**
 * Returns the AGENT_API_KEY for server-side Bearer validation only.
 * Never log or return this value from HTTP handlers.
 */
export function getAgentApiKey(): string {
  return getEnv().AGENT_API_KEY ?? '';
}

/**
 * Returns the comma-separated CORS origin allowlist (trimmed). Never contains
 * secrets. The literal "*" means "allow any origin" (local dev only).
 */
export function getAllowedOrigins(): string[] {
  try {
    return getEnv().ALLOWED_ORIGINS ?? [];
  } catch {
    return [];
  }
}

/**
 * Returns Evolution API configuration for backend calls only.
 * Never log or return apiKey from HTTP handlers.
 */
export function getEvolutionConfig(): {
  apiUrl: string;
  apiKey: string;
  instance: string;
  allowedEvents: string[];
  concurrency: number;
} {
  const e = getEnv();
  if (!e.EVOLUTION_API_URL || !e.EVOLUTION_API_KEY || !e.EVOLUTION_INSTANCE_NAME) {
    throw new Error(
      'Evolution API not configured: EVOLUTION_API_URL, EVOLUTION_API_KEY and EVOLUTION_INSTANCE_NAME are required',
    );
  }
  return {
    apiUrl: e.EVOLUTION_API_URL.replace(/\/$/, ''),
    apiKey: e.EVOLUTION_API_KEY,
    instance: e.EVOLUTION_INSTANCE_NAME,
    allowedEvents: e.EVOLUTION_WEBHOOK_EVENTS,
    concurrency: e.EVOLUTION_AGENT_CONCURRENCY,
  };
}