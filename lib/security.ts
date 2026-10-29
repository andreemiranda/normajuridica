// lib/security.ts

const SECRET_KEY_REGEX = /api[_-]?key|secret|token|password|credential|auth[_-]?header|bearer|authorization|private[_-]?key|client[_-]?secret|gemini[_-]?key|elevenlabs|weatherapi|env[_-]?var/i;
const SENSITIVE_VALUE_REGEX = /^(AIza[0-9A-Za-z-_]{35}|bn_[0-9A-Za-z-_]{20,}|sk-[0-9A-Za-z-_]{20,})/;

export function maskSecret(secret?: string | null): string {
  if (!secret) return '';
  if (secret.length <= 6) return '******';
  return secret.slice(0, 3) + '…' + secret.slice(-3);
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
