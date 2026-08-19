import argon2, { type HashOptions } from "argon2";

const ARGON_OPTIONS: HashOptions = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32
};

let dummyHashPromise: Promise<string> | null = null;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function getDummyPasswordHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword("senha-ficticia-interna-que-nunca-autentica");
  }
  return dummyHashPromise;
}

export function validateNewPassword(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 12) errors.push("Use pelo menos 12 caracteres.");
  if (password.length > 128) errors.push("Use no máximo 128 caracteres.");
  if (!/[\p{L}]/u.test(password)) errors.push("Inclua pelo menos uma letra.");
  if (!/\d/.test(password)) errors.push("Inclua pelo menos um número.");
  return errors;
}
