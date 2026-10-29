// lib/protocol.ts

/**
 * Generates an official 13-digit service protocol number:
 * - Digits 1 to 9 only (no zero)
 * - No adjacent identical digits
 * - Balanced distribution across digits
 * - Formatted as XXXX-XXXX-XXXXX
 */
export function generateProtocolNumber(): { raw: string; formatted: string } {
  const digits: number[] = [];
  const availableDigits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  let lastDigit = -1;

  for (let i = 0; i < 13; i++) {
    // Filter out the last digit to avoid adjacent identical digits
    const candidates = availableDigits.filter(d => d !== lastDigit);
    // Pick randomly
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    digits.push(picked);
    lastDigit = picked;
  }

  const raw = digits.join('');
  const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 13)}`;

  return { raw, formatted };
}

export function validateProtocolNumber(protocol: string): boolean {
  const clean = protocol.replace(/[^0-9]/g, '');
  if (clean.length !== 13) return false;
  if (clean.includes('0')) return false;

  for (let i = 0; i < clean.length - 1; i++) {
    if (clean[i] === clean[i + 1]) return false;
  }

  return true;
}
