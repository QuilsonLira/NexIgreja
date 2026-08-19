import type { ClassifiedIdentifier, IdentifierType } from "@/lib/auth/types";

export class InvalidIdentifierError extends Error {
  constructor(public readonly reason: string) {
    super("Identificador invalido");
    this.name = "InvalidIdentifierError";
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[\p{L}\p{N}._-]{3,50}$/u;
const CPF_FORMATTING_PATTERN = /[.\-\s]/g;

export function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;

  const calculateDigit = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(value[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(value[9]) && calculateDigit(10) === Number(value[10]);
}

export function classifyIdentifier(input: string): ClassifiedIdentifier {
  const value = input.trim();
  if (!value) throw new InvalidIdentifierError("VAZIO");

  const cpfCandidate = value.replace(CPF_FORMATTING_PATTERN, "");
  const containsOnlyCpfCharacters = /^[\d.\-\s]+$/.test(value);
  if (containsOnlyCpfCharacters && cpfCandidate.length === 11) {
    if (!isValidCpf(cpfCandidate)) throw new InvalidIdentifierError("CPF_INVALIDO");
    return {
      type: "CPF",
      normalized: cpfCandidate,
      lookupValue: cpfCandidate,
      safeHint: `***.***.***-${cpfCandidate.slice(-2)}`
    };
  }

  if (value.includes("@")) {
    if (value.length > 254 || !EMAIL_PATTERN.test(value)) {
      throw new InvalidIdentifierError("EMAIL_INVALIDO");
    }
    const normalized = value.toLowerCase();
    const [local, domain] = normalized.split("@");
    return {
      type: "EMAIL",
      normalized,
      lookupValue: normalized,
      safeHint: `${local.slice(0, 1)}***@${domain}`
    };
  }

  if (!USERNAME_PATTERN.test(value)) throw new InvalidIdentifierError("USUARIO_INVALIDO");
  if (/^\d{11}$/.test(value)) throw new InvalidIdentifierError("USUARIO_SOMENTE_DIGITOS");

  const normalized = value.toLowerCase();
  return {
    type: "USUARIO",
    normalized,
    lookupValue: normalized,
    safeHint: `${normalized.slice(0, 1)}***`
  };
}

export function inferIdentifierTypeForAudit(input: string): IdentifierType | null {
  const value = input.trim();
  if (!value) return null;
  if (value.includes("@")) return "EMAIL";
  if (/^[\d.\-\s]+$/.test(value) && value.replace(CPF_FORMATTING_PATTERN, "").length === 11) {
    return "CPF";
  }
  return "USUARIO";
}
