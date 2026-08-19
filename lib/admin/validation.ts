import { z } from "zod";
import { PERMISSION_CODES } from "@/lib/admin/permissions";

export const unitTypeSchema = z.enum(["CONVENCAO", "MATRIZ", "FILIAL"]);
export const unitStatusSchema = z.enum(["ATIVO", "INATIVO"]);
export const accountStatusSchema = z.enum(["ATIVO", "INATIVO", "EX_USUARIO", "BLOQUEADO"]);
export const organizationalScopeSchema = z.enum(["CONVENCAO", "MATRIZ", "FILIAL"]);
export const identifierTypeSchema = z.enum(["CPF", "USUARIO", "EMAIL"]);
export const accessResultSchema = z.enum(["SUCESSO", "FALHA", "SEGURANCA"]);

export const unitWriteSchema = z.object({
  type: unitTypeSchema.optional(),
  name: z.string().min(1).max(150),
  matrixId: z.number().int().positive().nullable().optional()
});

export const userWriteSchema = z.object({
  name: z.string().min(1).max(150),
  username: z.string().min(1).max(50),
  email: z.string().min(1).max(254),
  cpf: z.string().max(20).optional(),
  roleName: z.string().min(1).max(100),
  scope: organizationalScopeSchema,
  matrixId: z.number().int().positive().nullable().optional(),
  branchId: z.number().int().positive().nullable().optional(),
  temporaryPassword: z.string().max(128).optional(),
  permissions: z.array(z.enum(PERMISSION_CODES)).max(PERMISSION_CODES.length)
});

export const statusWriteSchema = z.object({ status: unitStatusSchema });
export const passwordResetSchema = z.object({
  temporaryPassword: z.string().min(1).max(128),
  confirmPassword: z.string().min(1).max(128)
});

export function positiveInteger(value: string | null, fallback: number, max?: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

export function optionalEnum<T extends string>(
  value: string | null,
  values: readonly T[]
): T | null {
  return value && values.includes(value as T) ? (value as T) : null;
}

export function safeSearch(value: string | null): string {
  return (value ?? "").trim().slice(0, 120);
}

export function safeDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : value;
}
