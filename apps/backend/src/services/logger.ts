import pino from 'pino';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';

const level = process.env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger = pino({
  level,
  base: {
    service: 'enviazo-backend',
    env: env.NODE_ENV,
  },
  ...(env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard' },
    },
  }),
});

export function createChildLogger(module: string, extra?: Record<string, unknown>): pino.Logger {
  return logger.child({ module, ...extra });
}

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `request completed`;
  },
  customErrorMessage: (req, res, err) => {
    return `request error: ${err.message}`;
  },
  customAttributeKeys: {
    reqId: 'requestId',
    responseTime: 'responseTimeMs',
  },
});

export type { pino };
