import { describe, expect, it } from "vitest";
import {
  classifyIdentifier,
  InvalidIdentifierError,
  isValidCpf
} from "@/lib/auth/identifier";

describe("classificacao deterministica do identificador", () => {
  it("aceita CPF valido sem formatacao", () => {
    const result = classifyIdentifier("52998224725");
    expect(result).toMatchObject({ type: "CPF", normalized: "52998224725" });
    expect(isValidCpf(result.normalized)).toBe(true);
  });

  it("aceita CPF valido formatado e armazena apenas digitos", () => {
    expect(classifyIdentifier(" 529.982.247-25 ")).toMatchObject({
      type: "CPF",
      normalized: "52998224725",
      safeHint: "***.***.***-25"
    });
  });

  it("rejeita CPF com digitos verificadores invalidos", () => {
    expect(() => classifyIdentifier("529.982.247-24")).toThrow(InvalidIdentifierError);
  });

  it("normaliza e-mail sem diferenca entre maiusculas e minusculas", () => {
    expect(classifyIdentifier(" Quilson@Exemplo.COM ")).toMatchObject({
      type: "EMAIL",
      normalized: "quilson@exemplo.com"
    });
  });

  it("normaliza usuario sem diferenca entre maiusculas e minusculas", () => {
    expect(classifyIdentifier(" Quilson.Lira ")).toMatchObject({
      type: "USUARIO",
      normalized: "quilson.lira"
    });
  });

  it("nao aceita arroba em nome de usuario", () => {
    expect(() => classifyIdentifier("usuario@invalido")).toThrow(InvalidIdentifierError);
  });

  it("nao aceita usuario publico composto por 11 digitos", () => {
    expect(() => classifyIdentifier("12345678901")).toThrow(InvalidIdentifierError);
  });

  it("nao trata ID interno curto como credencial", () => {
    expect(() => classifyIdentifier("12")).toThrow(InvalidIdentifierError);
  });
});
