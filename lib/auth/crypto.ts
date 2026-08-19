import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

export function cpfLookupHash(cpf: string, secret: string): string {
  return hmacHex(secret, `cpf:${cpf}`);
}

export function protectedIdentifierHash(
  identifierType: string | null,
  normalizedOrRaw: string,
  secret: string
): string {
  return hmacHex(secret, `${identifierType ?? "INVALIDO"}:${normalizedOrRaw}`);
}

export function attemptKeyHash(identifierHash: string, ipHash: string, secret: string): string {
  return hmacHex(secret, `tentativa:${identifierHash}:${ipHash}`);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string, secret: string): string {
  return hmacHex(secret, `sessao:${token}`);
}

export function safeEqualText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
