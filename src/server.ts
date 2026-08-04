import Fastify from 'fastify';
import { getEnv } from './config/env.js';
import { getLogger } from './utils/logger.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerStatusRoutes } from './routes/status.js';
import { registerAgentRoutes } from './routes/agent.js';

async function bootstrap(): Promise<void> {
  const log = getLogger();

  let env;
  try {
    env = getEnv();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'env error';
    // Logger may use default level here; still emit fatal then exit
    log.fatal({ errMessage: message }, 'server: environment configuration failed');
    process.exit(1);
  }

  const app = Fastify({
    logger: false, // we use our own pino instance to ensure redaction
    trustProxy: true,
    disableRequestLogging: false,
  });

  app.addHook('onRequest', async (req, _reply) => {
    log.info(
      { method: req.method, url: req.url },
      'request: incoming',
    );
  });

  app.setErrorHandler((err, req, reply) => {
    const statusCode = err.statusCode && err.statusCode >= 400
      ? err.statusCode
      : 500;
    log.error(
      {
        method: req.method,
        url: req.url,
        statusCode,
        errMessage: err.message,
      },
      'request: error',
    );
    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'internal_error' : 'request_error',
      message:
        statusCode >= 500
          ? 'Internal server error'
          : err.message,
      statusCode,
    });
  });

  registerHealthRoutes(app);
  registerStatusRoutes(app);
  registerAgentRoutes(app);

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    log.info(
      { port: env.PORT, service: env.SERVICE_NAME, version: env.SERVICE_VERSION },
      'server: listening',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'listen error';
    log.fatal({ errMessage: message }, 'server: failed to listen');
    process.exit(1);
  }

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'server: shutting down');
    try {
      await app.close();
      log.info('server: closed cleanly');
      process.exit(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'close error';
      log.fatal({ errMessage: message }, 'server: error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void bootstrap();
