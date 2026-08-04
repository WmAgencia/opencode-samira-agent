import pino, { type Logger } from 'pino';
import { getEnv } from '../config/env.js';

let logger: Logger | null = null;

export function getLogger(): Logger {
  if (logger) return logger;

  let level = 'info';
  try {
    level = getEnv().LOG_LEVEL;
  } catch {
    // env not loaded yet (e.g. during early import) - fall back to info
  }

  logger = pino({
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        // Never allow secrets to appear in logs
        'NVIDIA_API_KEY',
        'apiKey',
        'headers.authorization',
        'req.headers.authorization',
        'req.headers["x-api-key"]',
      ],
      remove: false,
    },
  });
  return logger;
}
