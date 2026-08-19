import type { NextRequest } from "next/server";
import { getAuthConfig } from "@/lib/auth/config";

export class UntrustedOriginError extends Error {
  constructor() {
    super("Origem da requisicao nao autorizada");
    this.name = "UntrustedOriginError";
  }
}

export function assertTrustedOrigin(request: NextRequest): void {
  const configuredOrigin = new URL(getAuthConfig().appOrigin).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin) {
    try {
      if (new URL(origin).origin === configuredOrigin) return;
    } catch {
      throw new UntrustedOriginError();
    }
  }
  if (!origin && fetchSite === "same-origin") return;
  throw new UntrustedOriginError();
}
