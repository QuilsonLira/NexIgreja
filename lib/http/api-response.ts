import { NextResponse } from "next/server";
import { PublicAuthError } from "@/lib/auth/service";

export function noStoreJson(body: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof PublicAuthError) {
    return noStoreJson(
      { error: { code: error.code, message: error.publicMessage } },
      { status: error.status }
    );
  }
  return noStoreJson(
    { error: { code: "ERRO_INTERNO", message: "Não foi possível concluir a solicitação." } },
    { status: 500 }
  );
}
