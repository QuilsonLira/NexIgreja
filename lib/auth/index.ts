import { mysqlAuthStore } from "@/lib/auth/mysql-store";
import { AuthService } from "@/lib/auth/service";

let service: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!service) service = new AuthService(mysqlAuthStore);
  return service;
}
