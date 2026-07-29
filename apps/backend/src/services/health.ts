import os from 'os';
import fs from 'fs';
import IORedis from 'ioredis';
import { createChildLogger } from './logger.js';
import { getSupabaseAdmin } from '../config/database.js';
import { env } from '../config/env.js';

const log = createChildLogger('health-check');

export type HealthStatusLevel = 'healthy' | 'degraded' | 'unhealthy';

export interface ServiceHealth {
  status: HealthStatusLevel;
  latencyMs?: number;
  error?: string;
}

export interface HealthStatus {
  status: HealthStatusLevel;
  version: string;
  uptime: number;
  timestamp: string;
  checks: {
    database: ServiceHealth;
    redis: ServiceHealth;
    disk: ServiceHealth;
  };
  system: {
    memoryUsageMb: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
    };
    memoryFreeMb: number;
    cpuUsagePercent: number;
    loadAverage: number[];
  };
}

const VERSION = process.env.npm_package_version || '1.0.0';

async function checkDatabase(): Promise<ServiceHealth> {
  const start = performance.now();
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('dispatch_orders').select('id', { count: 'exact', head: true });
    const latencyMs = Math.round(performance.now() - start);

    if (error) {
      return { status: 'unhealthy', latencyMs, error: error.message };
    }

    return {
      status: latencyMs > 1000 ? 'degraded' : 'healthy',
      latencyMs,
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

async function checkRedis(): Promise<ServiceHealth> {
  const start = performance.now();
  try {
    const client = new IORedis(env.REDIS_URL, {
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    await client.connect();
    const pong = await client.ping();
    const latencyMs = Math.round(performance.now() - start);
    await client.quit();

    return {
      status: latencyMs > 500 ? 'degraded' : 'healthy',
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: 'unhealthy',
      latencyMs,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

function checkDisk(): ServiceHealth {
  try {
    const uploadDir = env.UPLOAD_DIR;
    const stats = fs.statfsSync(uploadDir);
    const freeGb = Math.round((stats.bavail * stats.bsize) / (1024 * 1024 * 1024));
    const totalGb = Math.round((stats.blocks * stats.bsize) / (1024 * 1024 * 1024));
    const usedPercent = Math.round(((totalGb - freeGb) / totalGb) * 100);

    return {
      status: usedPercent > 95 ? 'unhealthy' : usedPercent > 85 ? 'degraded' : 'healthy',
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      error: err instanceof Error ? err.message : 'Could not read disk stats',
    };
  }
}

function getCpuUsagePercent(): number {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  }

  return Math.round((1 - totalIdle / totalTick) * 100 * 100) / 100;
}

function resolveOverallStatus(checks: HealthStatus['checks']): HealthStatusLevel {
  const statuses = [checks.database.status, checks.redis.status, checks.disk.status];
  if (statuses.some((s) => s === 'unhealthy')) return 'unhealthy';
  if (statuses.some((s) => s === 'degraded')) return 'degraded';
  return 'healthy';
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const [database, redis, disk] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    Promise.resolve(checkDisk()),
  ]);

  const mem = process.memoryUsage();
  const system: HealthStatus['system'] = {
    memoryUsageMb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    },
    memoryFreeMb: Math.round(os.freemem() / 1024 / 1024),
    cpuUsagePercent: getCpuUsagePercent(),
    loadAverage: os.loadavg().map((l) => Math.round(l * 100) / 100),
  };

  const checks = { database, redis, disk };
  const status = resolveOverallStatus(checks);

  log.info({ status, checks }, 'Health check completed');

  return {
    status,
    version: VERSION,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks,
    system,
  };
}
