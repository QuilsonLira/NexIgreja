import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const envSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("mysql://"),
  SESSION_HMAC_KEY: z.string().min(32),
  CPF_LOOKUP_HMAC_KEY: z.string().min(32),
  AUDIT_HMAC_KEY: z.string().min(32),
  APP_ORIGIN: z.string().url(),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  AUTH_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_BLOCK_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  COOKIE_SECURE: booleanFromString.default(true)
});

export interface AuthConfig {
  databaseUrl: string;
  sessionHmacKey: string;
  cpfLookupHmacKey: string;
  auditHmacKey: string;
  appOrigin: string;
  sessionTtlHours: number;
  maxAttempts: number;
  blockMinutes: number;
  cookieSecure: boolean;
}

let cachedConfig: AuthConfig | null = null;

export function getAuthConfig(): AuthConfig {
  if (cachedConfig) return cachedConfig;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Configuracao segura incompleta: ${parsed.error.issues
        .map((issue) => issue.path.join("."))
        .join(", ")}`
    );
  }

  cachedConfig = {
    databaseUrl: parsed.data.DATABASE_URL,
    sessionHmacKey: parsed.data.SESSION_HMAC_KEY,
    cpfLookupHmacKey: parsed.data.CPF_LOOKUP_HMAC_KEY,
    auditHmacKey: parsed.data.AUDIT_HMAC_KEY,
    appOrigin: parsed.data.APP_ORIGIN,
    sessionTtlHours: parsed.data.SESSION_TTL_HOURS,
    maxAttempts: parsed.data.AUTH_MAX_ATTEMPTS,
    blockMinutes: parsed.data.AUTH_BLOCK_MINUTES,
    cookieSecure: parsed.data.COOKIE_SECURE
  };

  return cachedConfig;
}

export function resetAuthConfigForTests(): void {
  cachedConfig = null;
}
