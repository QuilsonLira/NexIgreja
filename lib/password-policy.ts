export const PASSWORD_MIN_LENGTH = 4;
export const PASSWORD_POLICY_MESSAGE = "A senha deve ter no mínimo 4 caracteres.";

export function isPasswordValid(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH;
}

export function passwordPolicyMessage(password: string): string | null {
  return isPasswordValid(password) ? null : PASSWORD_POLICY_MESSAGE;
}
