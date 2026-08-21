import type { IdentifierType } from "@/lib/types";

export interface NormalizedLoginIdentifier {
  type: IdentifierType;
  normalized: string;
  valid: boolean;
}

export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeDigits(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

export function normalizeOptionalText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  return normalized.slice(0, max);
}

export function isValidCnpj(value: string): boolean {
  const cnpj = value.replace(/\D/g, "");
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;

  const digit = (length: number): number => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

export function normalizeCnpj(value: unknown): string | null {
  const digits = normalizeDigits(value);
  if (!digits) return null;
  return isValidCnpj(digits) ? digits : null;
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email) return null;
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

export const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export function normalizeBrazilianState(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const state = value.trim().toUpperCase();
  if (!state) return null;
  return BRAZILIAN_STATES.includes(state as (typeof BRAZILIAN_STATES)[number]) ? state : null;
}

export function normalizePhone(value: unknown): string | null {
  const digits = normalizeDigits(value);
  if (!digits) return null;
  return /^\d{10,11}$/.test(digits) ? digits : null;
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10]);
}

export function normalizeLoginIdentifier(value: string): NormalizedLoginIdentifier {
  const trimmed = value.trim().normalize("NFKC");

  if (trimmed.includes("@")) {
    const normalized = trimmed.toLowerCase();
    return {
      type: "EMAIL",
      normalized,
      valid: normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized),
    };
  }

  if (/^[\d.\-\s]+$/.test(trimmed)) {
    const normalized = normalizeCpf(trimmed);
    return { type: "CPF", normalized, valid: isValidCpf(normalized) };
  }

  const normalized = trimmed.toLowerCase();
  return {
    type: "USUARIO",
    normalized,
    valid: /^[a-z0-9._-]{3,50}$/.test(normalized),
  };
}
