import type { PermissionCode } from "@/lib/admin/permissions";

export type HelpProfile = "TODOS" | "USUARIO" | "ADMIN_FILIAL" | "ADMIN_MATRIZ" | "ADMIN_CONVENCAO" | "PLATFORM_OWNER";

export interface HelpArticle {
  id: number;
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  displayOrder: number;
  targetProfiles: HelpProfile[];
  requiredPermission: PermissionCode | null;
  relatedRoute: string | null;
  published: boolean;
  isNewFeature: boolean;
  releasedAt: string | null;
  version: string;
  read: boolean;
  tenantSpecific: boolean;
  updatedAt: string;
}

export interface HelpCenterPayload {
  articles: HelpArticle[];
  categories: string[];
  unreadNews: number;
  profile: HelpProfile;
  canManage: boolean;
}

export interface HelpArticleInput {
  title?: unknown; slug?: unknown; summary?: unknown; content?: unknown; category?: unknown;
  displayOrder?: unknown; targetProfiles?: unknown; requiredPermission?: unknown; relatedRoute?: unknown;
  published?: unknown; isNewFeature?: unknown; releasedAt?: unknown; version?: unknown;
}
