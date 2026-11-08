// lib/security.ts
import crypto from 'node:crypto';

const SECRET_KEY_REGEX = /api[_-]?key|secret|token|password|credential|auth[_-]?header|bearer|authorization|private[_-]?key|client[_-]?secret|gemini[_-]?key|elevenlabs|weatherapi|env[_-]?var/i;
const SENSITIVE_VALUE_REGEX = /^(AIza[0-9A-Za-z-_]{35}|bn_[0-9A-Za-z-_]{20,}|sk-[0-9A-Za-z-_]{20,})/;

export function maskSecret(secret?: string | null): string {
  if (!secret) return '';
  if (secret.length <= 6) return '******';
  return secret.slice(0, 3) + '…' + secret.slice(-3);
}

/**
 * Constant-time comparison between provided secret and expected secret to prevent timing attacks.
 */
export function verifySecret(provided?: string | null, expected?: string | null): boolean {
  if (!provided || !expected) return false;
  try {
    const provBuf = Buffer.from(provided);
    const expBuf = Buffer.from(expected);
    if (provBuf.length !== expBuf.length) {
      // Execute dummy comparison to maintain uniform execution time
      crypto.timingSafeEqual(provBuf, provBuf);
      return false;
    }
    return crypto.timingSafeEqual(provBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Strips dangerous injection, null bytes, and path traversal strings from user input.
 */
export function sanitizeInput(input?: string | null, maxLength = 1000): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/\0/g, '') // strip null bytes
    .replace(/(\.\.[\/\\])+/g, '') // prevent path traversal
    .replace(/[\r\n]+/g, ' ') // normalize newlines to single space for headers/titles
    .trim()
    .slice(0, maxLength);
}

/**
 * In-memory sliding-window rate limiter for server CPU/DDoS protection.
 * Automatically evicts old records to prevent memory leaks.
 */
interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const MAX_RATE_LIMIT_ENTRIES = 5000;
let lastRateLimitCleanup = Date.now();

export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();

  // Periodic cleanup every 5 minutes to prevent memory buildup
  if (now - lastRateLimitCleanup > 300000 || rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
    const cutoff = now - windowMs * 2;
    for (const [key, record] of rateLimitMap.entries()) {
      record.timestamps = record.timestamps.filter(ts => ts > cutoff);
      if (record.timestamps.length === 0) {
        rateLimitMap.delete(key);
      }
    }
    lastRateLimitCleanup = now;
  }

  const record = rateLimitMap.get(identifier) || { timestamps: [] };
  const windowStart = now - windowMs;
  record.timestamps = record.timestamps.filter(ts => ts > windowStart);

  if (record.timestamps.length >= maxRequests) {
    const oldest = record.timestamps[0] || now;
    const resetMs = Math.max(0, windowMs - (now - oldest));
    rateLimitMap.set(identifier, record);
    return { allowed: false, remaining: 0, resetMs };
  }

  record.timestamps.push(now);
  rateLimitMap.set(identifier, record);
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - record.timestamps.length),
    resetMs: windowMs,
  };
}

export function sanitizePublicData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    if (SENSITIVE_VALUE_REGEX.test(data)) {
      return maskSecret(data) as unknown as T;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizePublicData(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      if (SECRET_KEY_REGEX.test(key)) {
        // Exclude secret keys from public responses completely
        continue;
      }
      sanitizedObj[key] = sanitizePublicData(val);
    }
    return sanitizedObj as T;
  }

  return data;
}

export function isEnvironmentSecure(): boolean {
  // Check if any secrets are accidentally published with NEXT_PUBLIC_
  const envKeys = Object.keys(process.env);
  const leakedKeys = envKeys.filter(
    k => k.startsWith('NEXT_PUBLIC_') && /KEY|SECRET|TOKEN|PASS|AUTH/i.test(k) && !/ADSENSE/i.test(k)
  );
  return leakedKeys.length === 0;
}
