import Redis from 'ioredis';
import { env } from '../config/env.js';
import { createChildLogger } from './logger.js';

const log = createChildLogger('cache-service');

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CacheService {
  private client: Redis | null = null;
  private prefix: string;
  private defaultTtl: number;
  private memoryFallback = new Map<string, CacheEntry<unknown>>();
  private useMemory = false;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: CacheOptions) {
    this.prefix = options?.prefix ?? 'enviazo';
    this.defaultTtl = options?.ttl ?? 300;

    try {
      this.client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
        enableReadyCheck: true,
        connectTimeout: 5000,
      });

      this.client.on('error', (err: Error) => {
        if (!this.useMemory) {
          log.warn('Redis unavailable, falling back to in-memory cache: %s', err.message);
          this.useMemory = true;
        }
      });

      this.client.on('connect', () => {
        if (this.useMemory) {
          log.info('Redis reconnected, switching back from memory cache');
          this.useMemory = false;
        }
      });

      this.client.connect().catch(() => {
        log.warn('Redis not available at startup, using in-memory fallback');
        this.useMemory = true;
      });

      this.cleanupTimer = setInterval(() => this.cleanupMemoryCache(), 60_000);
    } catch {
      log.warn('Failed to create Redis client, using in-memory fallback');
      this.useMemory = true;
    }
  }

  private prefixedKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (this.useMemory || !this.client) {
      return this.getMemory<T>(key);
    }

    try {
      const raw = await this.client.get(this.prefixedKey(key));
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      log.warn('Cache GET error for key %s: %s', key, (err as Error).message);
      return this.getMemory<T>(key);
    }
  }

  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTtl = ttl ?? this.defaultTtl;

    this.setMemory(key, value, effectiveTtl);

    if (this.useMemory || !this.client) return;

    try {
      await this.client.setex(this.prefixedKey(key), effectiveTtl, JSON.stringify(value));
    } catch (err) {
      log.warn('Cache SET error for key %s: %s', key, (err as Error).message);
    }
  }

  async del(key: string): Promise<void> {
    this.memoryFallback.delete(this.prefixedKey(key));

    if (this.useMemory || !this.client) return;

    try {
      await this.client.del(this.prefixedKey(key));
    } catch (err) {
      log.warn('Cache DEL error for key %s: %s', key, (err as Error).message);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (this.useMemory || !this.client) {
      const entry = this.memoryFallback.get(this.prefixedKey(key));
      if (!entry) return false;
      if (Date.now() > entry.expiresAt) {
        this.memoryFallback.delete(this.prefixedKey(key));
        return false;
      }
      return true;
    }

    try {
      const result = await this.client.exists(this.prefixedKey(key));
      return result === 1;
    } catch (err) {
      log.warn('Cache EXISTS error for key %s: %s', key, (err as Error).message);
      const entry = this.memoryFallback.get(this.prefixedKey(key));
      return !!entry && Date.now() <= entry.expiresAt;
    }
  }

  async ttl(key: string): Promise<number> {
    if (this.useMemory || !this.client) {
      const entry = this.memoryFallback.get(this.prefixedKey(key));
      if (!entry) return -2;
      const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    }

    try {
      return await this.client.ttl(this.prefixedKey(key));
    } catch (err) {
      log.warn('Cache TTL error for key %s: %s', key, (err as Error).message);
      return -2;
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const fullPattern = this.prefixedKey(pattern);

    this.memoryFallback.forEach((_, k) => {
      if (k.startsWith(this.prefix + ':') && this.matchPattern(k, fullPattern)) {
        this.memoryFallback.delete(k);
      }
    });

    if (this.useMemory || !this.client) return;

    try {
      const keys = await this.client.keys(fullPattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err) {
      log.warn('Cache INVALIDATE_PATTERN error for %s: %s', pattern, (err as Error).message);
    }
  }

  private getMemory<T>(key: string): T | null {
    const entry = this.memoryFallback.get(this.prefixedKey(key));
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memoryFallback.delete(this.prefixedKey(key));
      return null;
    }
    return entry.value as T;
  }

  private setMemory<T>(key: string, value: T, ttl: number): void {
    this.memoryFallback.set(this.prefixedKey(key), {
      value,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  private matchPattern(key: string, pattern: string): boolean {
    const regexStr = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${regexStr}$`).test(key);
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryFallback) {
      if (now > entry.expiresAt) {
        this.memoryFallback.delete(key);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}

let instance: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!instance) {
    instance = new CacheService();
  }
  return instance;
}
