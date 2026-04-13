import crypto from "crypto";

/**
 * Generate a permanent EC-ID like EC-A7K2M9
 * Uses uppercase alphanumeric characters (no ambiguous chars: 0/O, 1/I/L)
 * 6 chars = 24^6 = ~191 million combinations
 */
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 30 chars, no 0/O/1/I/L

export function generateEcId(): string {
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return `EC-${code}`;
}
