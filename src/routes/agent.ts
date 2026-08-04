import type { FastifyInstance } from 'fastify';
import { agentRequestSchema } from '../types.js';
import { runAgent } from '../services/agent.service.js';
import { getLogger } from '../utils/logger.js';
import type { AgentResponse } from '../types.js';

export function registerAgentRoutes(app: FastifyInstance): void {
  app.post('/api/agent', async (req, reply) => {
    const log = getLogger();

    const parseResult = agentRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const message = parseResult.error.issues
        .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
        .join('; ');
      log.warn({ message }, 'agent: validation rejected');
      return reply.status(400).send({
        error: 'validation_error',
        message,
        statusCode: 400,
      });
    }

    try {
      const response: AgentResponse = await runAgent(parseResult.data.task);
      return reply.status(200).send(response);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Agent execution failed';
      log.error({ errMessage: message }, 'agent: route handler error');
      return reply.status(502).send({
        error: 'agent_error',
        message,
        statusCode: 502,
      });
    }
  });
}
