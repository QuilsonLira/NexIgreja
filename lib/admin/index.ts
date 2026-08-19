import { AdminService } from "@/lib/admin/service";
import { mysqlAdminStore } from "@/lib/admin/mysql-store";

let adminService: AdminService | null = null;

export function getAdminService(): AdminService {
  if (!adminService) adminService = new AdminService(mysqlAdminStore);
  return adminService;
}

export * from "@/lib/admin/permissions";
export * from "@/lib/admin/service";
export type * from "@/lib/admin/types";
