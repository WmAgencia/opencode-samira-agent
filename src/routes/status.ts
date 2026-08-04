import type { FastifyInstance } from 'fastify';
import { getEnv, hasNvidiaApiKey } from '../config/env.js';
import { getLogger } from '../utils/logger.js';
import type { StatusResponse } from '../types.js';

export function registerStatusRoutes(app: FastifyInstance): void {
  const startedAt = Date.now();

  app.get('/api/status', async (_req, _reply) => {
    const log = getLogger();
    let env;
    try {
      env = getEnv();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'env error';
      log.error({ errMessage: message }, 'status: env misconfigured');
      throw err;
    }

    const body: StatusResponse = {
      service: env.SERVICE_NAME,
      version: env.SERVICE_VERSION,
      status: 'operational',
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      nvidiaApiKeyConfigured: hasNvidiaApiKey(),
      model: env.AGENT_MODEL,
      timestamp: new Date().toISOString(),
    };
    return body;
  });
}
