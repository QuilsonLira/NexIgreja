import { describe, expect, it } from "vitest";
import { hashPassword, validateNewPassword, verifyPassword } from "@/lib/auth/password";

describe("senhas", () => {
  it("usa Argon2id com salt e nunca retorna texto puro", async () => {
    const first = await hashPassword("SenhaMuitoForte123");
    const second = await hashPassword("SenhaMuitoForte123");
    expect(first).toContain("$argon2id$");
    expect(first).not.toContain("SenhaMuitoForte123");
    expect(first).not.toBe(second);
    expect(await verifyPassword(first, "SenhaMuitoForte123")).toBe(true);
    expect(await verifyPassword(first, "senhaerrada")).toBe(false);
  });

  it("exige comprimento, letras e numeros na nova senha", () => {
    expect(validateNewPassword("curta")).toHaveLength(2);
    expect(validateNewPassword("uma-senha-comprida-sem-numero")).toHaveLength(1);
    expect(validateNewPassword("SenhaMuitoForte123")).toEqual([]);
  });
});
