// lib/security.ts
import crypto from 'node:crypto';

const SECRET_KEY_REGEX =
  /api[_-]?key|secret|token|password|passwd|credential|auth[_-]?header|bearer|authorization|private[_-]?key|client[_-]?secret|gemini[_-]?key|elevenlabs|weatherapi|env[_-]?var|webhook[_-]?url|smtp[_-]?(?:pass|user)/i;

const SENSITIVE_VALUE_REGEX =
  /^(AIza[0-9A-Za-z-_]{20,}|bn_[0-9A-Za-z-_]{16,}|sk-[0-9A-Za-z-_]{16,}|sk_(?:live|test)_[0-9A-Za-z]{16,}|gh[pous]_[0-9A-Za-z]{20,}|github_pat_[0-9A-Za-z_]{20,}|xox[baprs]-[0-9A-Za-z-]{10,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,}|-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----)/i;

const SENSITIVE_QUERY_PARAM_REGEX =
  /([?&](?:ref|key|api_key|apikey|token|access_token|secret|auth|password)=)([^&#\s]+)/gi;

const URL_CREDENTIALS_REGEX = /^(https?:\/\/)([^:@/\s]+):([^@/\s]+)@/i;

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
      crypto.timingSafeEqual(provBuf, provBuf);
      return false;
    }
    return crypto.timingSafeEqual(provBuf, expBuf);
  } catch {
    return false;
  }
}

export function escapeHtml(str: string = ''): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeJsonLdStringify(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * Strips dangerous injection, null bytes, and path traversal strings from user input.
 */
export function sanitizeInput(input?: string | null, maxLength = 1000): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/\0/g, '')
    .replace(/(\.\.[\/\\])+/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Checks whether an IPv4/IPv6 hostname belongs to loopback, private, link-local, or cloud metadata networks (SSRF defense).
 */
export function isPrivateOrReservedHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;

  if (
    host === 'localhost' ||
    host === 'localhost.localdomain' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localdomain') ||
    host === 'metadata.google.internal' ||
    host === 'metadata'
  ) {
    return true;
  }

  // IPv6 checks
  if (host.includes(':')) {
    if (
      host === '::' ||
      host === '::1' ||
      host.startsWith('fe80:') ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('ff')
    ) {
      return true;
    }
    // IPv4-mapped IPv6 e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1
    const v4Mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4Mapped) {
      return isPrivateOrReservedHost(v4Mapped[1]);
    }
    if (host.startsWith('::ffff:')) {
      return true;
    }
    return false;
  }

  // Numeric/hex/octal IPv4 shorthand or dotted IPv4
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) {
    return true;
  }

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map((n) => parseInt(n, 10));
    if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return true;
    const [a, b] = octets;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true; // multicast & reserved
    return false;
  }

  if (!host.includes('.')) return true;
  return false;
}

/**
 * Validates that an external URL is safe to fetch from server-side code (blocks SSRF).
 */
export function assertSafeExternalUrl(
  rawUrl?: string | null,
  options: { requireHttps?: boolean } = {}
): URL | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  try {
    const parsed = new URL(trimmed);
    const proto = parsed.protocol.toLowerCase();
    if (options.requireHttps) {
      if (proto !== 'https:') return null;
    } else if (proto !== 'http:' && proto !== 'https:') {
      return null;
    }
    if (parsed.username || parsed.password) return null;
    if (parsed.port && parsed.port !== '80' && parsed.port !== '443') return null;
    if (isPrivateOrReservedHost(parsed.hostname)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getClientIp(headers: Headers): string {
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return sanitizeInput(cfIp, 64) || 'anonymous';
  const xff = headers.get('x-forwarded-for');
  if (xff) return sanitizeInput(xff.split(',')[0], 64) || 'anonymous';
  const xri = headers.get('x-real-ip');
  if (xri) return sanitizeInput(xri, 64) || 'anonymous';
  return 'anonymous';
}

const EMBEDDED_TOKEN_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /sk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export function sanitizeStringSecrets(value: string): string {
  let out = value;
  if (SENSITIVE_VALUE_REGEX.test(out.trim())) {
    return maskSecret(out.trim());
  }
  for (const pattern of EMBEDDED_TOKEN_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  out = out.replace(URL_CREDENTIALS_REGEX, '$1***:***@');
  out = out.replace(SENSITIVE_QUERY_PARAM_REGEX, '$1[REDACTED]');
  return out;
}

/**
 * In-memory sliding-window rate limiter for server CPU/DDoS protection.
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

  if (now - lastRateLimitCleanup > 300000 || rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
    const cutoff = now - windowMs * 2;
    for (const [key, record] of rateLimitMap.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > cutoff);
      if (record.timestamps.length === 0) {
        rateLimitMap.delete(key);
      }
    }
    lastRateLimitCleanup = now;
  }

  const record = rateLimitMap.get(identifier) || { timestamps: [] };
  const windowStart = now - windowMs;
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

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
    return sanitizeStringSecrets(data) as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizePublicData(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      if (SECRET_KEY_REGEX.test(key)) {
        continue;
      }
      sanitizedObj[key] = sanitizePublicData(val);
    }
    return sanitizedObj as T;
  }

  return data;
}

export function isEnvironmentSecure(env: Record<string, string | undefined> = process.env): boolean {
  const envKeys = Object.keys(env);
  const leakedKeys = envKeys.filter(
    (k) =>
      k.startsWith('NEXT_PUBLIC_') &&
      /KEY|SECRET|TOKEN|PASS|AUTH|WEBHOOK|SMTP/i.test(k) &&
      !/ADSENSE/i.test(k) &&
      Boolean(env[k] && String(env[k]).trim())
  );
  return leakedKeys.length === 0;
}
