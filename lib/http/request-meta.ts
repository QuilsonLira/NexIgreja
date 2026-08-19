import type { NextRequest } from "next/server";
import { isIP } from "node:net";
import { getAuthConfig } from "@/lib/auth/config";
import { hmacHex } from "@/lib/auth/crypto";
import type { RequestMetadata } from "@/lib/auth/types";

function summarizeUserAgent(userAgent: string): string {
  const browser = userAgent.includes("Edg/")
    ? "Edge"
    : userAgent.includes("Chrome/")
      ? "Chrome"
      : userAgent.includes("Firefox/")
        ? "Firefox"
        : userAgent.includes("Safari/")
          ? "Safari"
          : "Navegador";

  const device = userAgent.includes("Android")
    ? "Android"
    : /iPhone|iPad/.test(userAgent)
      ? "iOS"
      : userAgent.includes("Windows")
        ? "Windows"
        : userAgent.includes("Mac OS")
          ? "macOS"
          : userAgent.includes("Linux")
            ? "Linux"
            : "dispositivo desconhecido";

  return `${browser} em ${device}`;
}

function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  let candidate = value.trim();
  const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) candidate = ipv4WithPort[1];
  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  }
  return isIP(candidate) ? candidate.slice(0, 45) : null;
}

export function getRequestMetadata(request: NextRequest): RequestMetadata {
  const config = getAuthConfig();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipAddress = normalizeIp(forwarded || request.headers.get("x-real-ip"));
  const ip = ipAddress || "ip-desconhecido";
  const userAgent = (request.headers.get("user-agent") || "user-agent-desconhecido").slice(0, 500);

  return {
    ipHash: hmacHex(config.auditHmacKey, `ip:${ip}`),
    ipAddress,
    originSummary: summarizeUserAgent(userAgent),
    userAgent
  };
}
