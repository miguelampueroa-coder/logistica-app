import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  messagesPerMin: number;
  quotesPerMin: number;
  ordersPerMin: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  messagesPerMin: 60,
  quotesPerMin: 30,
  ordersPerMin: 10,
};

const WINDOW_MS = 60_000;

const counters = new Map<string, Map<string, WindowEntry>>();

function getCompanyId(req: Request): string {
  return (
    (req.body?.company_id as string) ||
    (req.query?.company_id as string) ||
    (req.headers['x-company-id'] as string) ||
    'anonymous'
  );
}

function classifyRequest(req: Request): string | null {
  const path = req.path;
  if (path.includes('/message') || path.includes('/send')) return 'messages';
  if (path.includes('/quote') || path.includes('/price')) return 'quotes';
  if (path.includes('/order')) return 'orders';
  return 'messages';
}

function checkLimit(companyId: string, action: string, limit: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  let companyCounters = counters.get(companyId);
  if (!companyCounters) {
    companyCounters = new Map();
    counters.set(companyId, companyCounters);
  }

  const entry = companyCounters.get(action);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    companyCounters.set(action, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }

  entry.count++;
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
  }

  return { allowed: true, retryAfter: 0 };
}

export function whatsappRateLimiter(config?: Partial<RateLimitConfig>) {
  const limits: RateLimitConfig = { ...DEFAULT_CONFIG, ...config };

  const limitMap: Record<string, number> = {
    messages: limits.messagesPerMin,
    quotes: limits.quotesPerMin,
    orders: limits.ordersPerMin,
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    const companyId = getCompanyId(req);
    const action = classifyRequest(req);

    if (!action) {
      next();
      return;
    }

    const limit = limitMap[action] || limits.messagesPerMin;
    const result = checkLimit(companyId, action, limit);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', (Math.ceil(Date.now() / 1000) + result.retryAfter).toString());
      res.status(429).json({
        error: 'Rate limit exceeded',
        action,
        retryAfter: result.retryAfter,
      });
      return;
    }

    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [companyId, actions] of counters) {
    for (const [action, entry] of actions) {
      if (now - entry.windowStart >= WINDOW_MS * 2) {
        actions.delete(action);
      }
    }
    if (actions.size === 0) {
      counters.delete(companyId);
    }
  }
}, WINDOW_MS);
