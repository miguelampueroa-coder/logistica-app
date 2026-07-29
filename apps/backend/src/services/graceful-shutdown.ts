import { Server } from 'http';
import { WebSocketServer } from 'ws';
import type IORedis from 'ioredis';
import type { Worker } from 'bullmq';
import { createChildLogger } from './logger.js';

const log = createChildLogger('graceful-shutdown');

export interface ShutdownOptions {
  timeoutMs?: number;
  wsServers?: WebSocketServer[];
  redisConnections?: IORedis[];
  workers?: Worker[];
  onShutdown?: () => Promise<void> | void;
}

const FORCE_EXIT_TIMEOUT_MS = 30_000;
const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

function waitForServerClose(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function closeWebSocketServers(servers: WebSocketServer[]): Promise<void> {
  return Promise.all(
    servers.map(
      (wss) =>
        new Promise<void>((resolve) => {
          for (const client of wss.clients) {
            client.close(1001, 'Server shutting down');
          }
          wss.close(() => resolve());
        })
    )
  ).then(() => undefined);
}

async function closeRedisConnections(connections: IORedis[]): Promise<void> {
  await Promise.all(connections.map((c) => c.quit()));
}

async function closeWorkers(workers: Worker[]): Promise<void> {
  await Promise.all(
    workers.map(async (w) => {
      await w.close();
    })
  );
}

export function setupGracefulShutdown(server: Server, options: ShutdownOptions = {}): void {
  const {
    timeoutMs = FORCE_EXIT_TIMEOUT_MS,
    wsServers = [],
    redisConnections = [],
    workers = [],
    onShutdown,
  } = options;

  let shutdownInProgress = false;

  async function gracefulShutdown(signal: NodeJS.Signals): Promise<void> {
    if (shutdownInProgress) return;
    shutdownInProgress = true;

    log.info({ signal }, 'Shutdown signal received');

    const forceExitTimer = setTimeout(() => {
      log.fatal('Force exit timeout reached, terminating immediately');
      process.exit(1);
    }, timeoutMs);
    forceExitTimer.unref();

    try {
      if (onShutdown) {
        await onShutdown();
      }

      log.info('Closing HTTP server');
      await waitForServerClose(server);
      log.info('HTTP server closed');

      if (wsServers.length > 0) {
        log.info({ count: wsServers.length }, 'Closing WebSocket servers');
        await closeWebSocketServers(wsServers);
        log.info('WebSocket servers closed');
      }

      if (workers.length > 0) {
        log.info({ count: workers.length }, 'Stopping BullMQ workers');
        await closeWorkers(workers);
        log.info('BullMQ workers stopped');
      }

      if (redisConnections.length > 0) {
        log.info({ count: redisConnections.length }, 'Closing Redis connections');
        await closeRedisConnections(redisConnections);
        log.info('Redis connections closed');
      }

      log.info('Flushing logs');
      await new Promise<void>((resolve) => {
        log.flush();
        setTimeout(resolve, 500);
      });

      clearTimeout(forceExitTimer);
      log.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      log.fatal({ err }, 'Error during graceful shutdown');
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  }

  for (const signal of SHUTDOWN_SIGNALS) {
    process.on(signal, () => {
      gracefulShutdown(signal).catch((err) => {
        log.fatal({ err, signal }, 'Unhandled error in shutdown handler');
        process.exit(1);
      });
    });
  }

  process.on('uncaughtException', (err) => {
    log.fatal({ err }, 'Uncaught exception');
    gracefulShutdown('SIGTERM').catch(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    log.fatal({ reason }, 'Unhandled rejection');
  });

  log.info('Graceful shutdown handler registered');
}
