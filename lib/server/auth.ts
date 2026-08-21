import bcrypt from "bcryptjs";
import type {
  ActiveContext,
  AdministrativeSession,
  AvailableContexts,
  IdentifierType,
  OrganizationOption,
  OrganizationalScope,
  RequestMetadata,
  SafeSessionPayload,
  InstitutionContext,
  PlatformOwnerSession,
} from "@/lib/types";
import { isUnitWithinScope } from "@/lib/server/authorization";
import { normalizeLoginIdentifier } from "@/lib/server/validation";
import {
  isPasswordValid,
  PASSWORD_POLICY_MESSAGE,
} from "@/lib/password-policy";
import {
  resolveEffectiveLogoUrl,
  unitLogoUrl,
  userPhotoUrl,
} from "@/lib/image-policy";
import { classifyUnexpectedError } from "@/lib/server/error-policy";
import {
  isInstitutionAvailable,
  isInstitutionCode,
  loginIsolationNamespace,
} from "@/lib/auth/tenant-login-policy";
import {
  canBypassLicense,
  evaluateLicense,
  todayInBrazil,
} from "@/lib/billing/policy";
import type {
  BillingSettingsPublic,
  LicenseSummary,
  SubscriptionStatus,
} from "@/lib/billing/types";

const COOKIE_NAME = "nexigreja_session";
const INSTITUTION_COOKIE_NAME = "nexigreja_institution";
const INSTITUTION_CONTEXT_DAYS = 30;
const SESSION_HOURS = 8;
const IDLE_MINUTES = 30;
const MAX_FAILURES = 5;
const RATE_WINDOW_MINUTES = 15;
const HISTORY_RETENTION_DAYS = 90;
const GENERIC_LOGIN_MESSAGE = "Usuário ou senha inválidos";

// Hash for timing-safe comparison when an account does not exist. It is not
// associated with any usable account or documented test password.
const DUMMY_PASSWORD_HASH =
  "$2b$12$hkXx0UaJDmSxjfrFN2HS1evEkSt1KYXrysQEH2jJIbcEreFPVtRUO";

const TEST_USERS = [
  {
    id: 1,
    name: "Quilson Lira",
    username: "quilson",
    email: "admin@nexigreja.com.br",
    cpf: "52998224725",
    passwordHash:
      "$2b$12$vKBgQEcWT09ZrxcVGupu6es0b5ZQsEWCDXFcVku9sAglTJPxSlIlm",
    roleName: "Administrador da Convenção",
    scope: "CONVENCAO" as const,
    tenantId: null,
    unitId: 1,
  },
  {
    id: 2,
    name: "Gestor da Matriz",
    username: "gestor.matriz",
    email: "matriz@nexigreja.com.br",
    cpf: "16899535009",
    passwordHash:
      "$2b$12$naI090qiCEpj24vZDmFbWetGWqTH4eT7dXiuYD/.HfqGiHY4X3PCu",
    roleName: "Administrador da Matriz",
    scope: "MATRIZ" as const,
    tenantId: 1,
    unitId: 2,
  },
  {
    id: 3,
    name: "Gestor da Filial",
    username: "gestor.filial",
    email: "filial@nexigreja.com.br",
    cpf: "11144477735",
    passwordHash:
      "$2b$12$mJRoZkBp9omVTiSdqF1eGOhojXF8d9bD1GZKgV5ryBZMvIa2eCOD.",
    roleName: "Administrador da Filial",
    scope: "FILIAL" as const,
    tenantId: 1,
    unitId: 4,
  },
];

const TEST_ADMIN_PERMISSIONS = [
  "USUARIOS_VISUALIZAR",
  "USUARIOS_CRIAR",
  "USUARIOS_EDITAR",
  "USUARIOS_DESATIVAR",
  "USUARIOS_REDEFINIR_SENHA",
  "UNIDADES_VISUALIZAR",
  "UNIDADES_CRIAR",
  "UNIDADES_EDITAR",
  "FUNCOES_VISUALIZAR",
  "FUNCOES_CRIAR",
  "FUNCOES_EDITAR",
  "FUNCOES_DESATIVAR",
  "ACESSOS_VISUALIZAR",
  "ASSINATURA_VISUALIZAR",
  "MEMBROS_VISUALIZAR",
  "MEMBROS_CRIAR",
  "MEMBROS_EDITAR",
  "MEMBROS_ALTERAR_SITUACAO",
  "MEMBROS_TRANSFERIR",
  "MEMBROS_IMPRIMIR",
  "MEMBROS_HISTORICO_VISUALIZAR",
  "MEMBROS_OBSERVACOES_VISUALIZAR",
  "MEMBROS_OBSERVACOES_EDITAR",
  "PRECADASTROS_VISUALIZAR",
  "PRECADASTROS_ANALISAR",
  "PRECADASTROS_APROVAR",
  "PRECADASTROS_RECUSAR",
  "CAMPOS_MEMBROS_CONFIGURAR",
  "FORMULARIOS_PRECADASTRO_GERENCIAR",
  "DADOS_EXPORTAR",
  "DADOS_EXPORTAR_COMPLETO",
] as const;

type UnitType = "CONVENCAO" | "MATRIZ" | "FILIAL";

type DbUser = {
  user_id: number;
  membership_id: number | null;
  membership_status: "ATIVO" | "INATIVO" | "PENDENTE" | null;
  name: string;
  username: string;
  email: string;
  cpf: string;
  password_hash: string;
  role_name: string;
  scope: OrganizationalScope;
  status: string;
  must_change_password: number;
  failed_attempts: number;
  blocked_until: string | null;
  tenant_id: number | null;
  scope_unit_id: number | null;
  scope_unit_type: UnitType | null;
  is_platform_owner: number;
};

type SessionRow = DbUser & {
  session_tenant_id: number | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  tenant_status: "ATIVO" | "SUSPENSO" | "CANCELADO" | null;
  session_id: string;
  organization_selection_required: number;
  platform_context_active: number;
  selected_unit_id: number | null;
  previous_login_at: string | null;
  previous_identifier_type: IdentifierType | null;
  previous_device_summary: string | null;
  expires_at: string;
  last_seen_at: string;
};

type IdentityRow = {
  user_id: number;
  tenant_id: number | null;
  name: string;
  username: string;
  email: string;
  cpf: string;
  password_hash: string;
  status: string;
  must_change_password: number;
  failed_attempts: number;
  blocked_until: string | null;
  is_platform_owner: number;
};

type MembershipLoginRow = {
  membership_id: number;
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  tenant_status: "ATIVO" | "SUSPENSO" | "CANCELADO";
  display_name: string;
  role_name: string;
  scope: OrganizationalScope;
  scope_unit_id: number;
  scope_unit_type: UnitType;
  membership_status: "ATIVO" | "INATIVO" | "PENDENTE";
};

type LoginResult = {
  payload: SafeSessionPayload | null;
  organizations: OrganizationOption[];
  requiresOrganizationSelection: boolean;
  cookie: string | null;
};

type UnitPath = {
  id: number;
  tenant_id: number;
  name: string;
  type: UnitType;
  status: string;
  parent_id: number | null;
  parent_name: string | null;
  parent_type: UnitType | null;
  parent_status: string | null;
  grandparent_id: number | null;
  grandparent_name: string | null;
  grandparent_status: string | null;
  archived_at: string | null;
  parent_archived_at: string | null;
  grandparent_archived_at: string | null;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public publicMessage: string,
  ) {
    super(publicMessage);
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

function randomToken(size = 32): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(size)));
}

export function database(): D1Database {
  const db = (globalThis as typeof globalThis & { __NEXIGREJA_DB?: D1Database })
    .__NEXIGREJA_DB;
  if (!db) {
    throw new ApiError(
      503,
      "BANCO_INDISPONIVEL",
      "Banco de dados indisponível. Tente novamente em instantes.",
    );
  }
  return db;
}

let databaseInitialization: Promise<void> | null = null;

async function initializeDatabase(): Promise<void> {
  const db = database();
  await db.batch([
    db.prepare(
      "CREATE TABLE IF NOT EXISTS tenants (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, access_code TEXT NOT NULL UNIQUE CHECK (length(access_code) = 7 AND access_code NOT GLOB '*[^0-9]*'), status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'SUSPENSO', 'CANCELADO')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS organizational_units (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, type TEXT NOT NULL CHECK (type IN ('CONVENCAO', 'MATRIZ', 'FILIAL')), name TEXT NOT NULL, fantasy_name TEXT, legal_name TEXT, cnpj TEXT, uses_parent_cnpj INTEGER NOT NULL DEFAULT 0 CHECK (uses_parent_cnpj IN (0, 1)), phone TEXT, whatsapp TEXT, email TEXT, postal_code TEXT, street TEXT, number TEXT, complement TEXT, district TEXT, city TEXT, state TEXT, responsible_name TEXT, foundation_date TEXT, notes TEXT, code TEXT NOT NULL UNIQUE, parent_id INTEGER, status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')), archived_at TEXT, archived_by INTEGER, archived_previous_status TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (parent_id) REFERENCES organizational_units(id), CHECK ((type = 'CONVENCAO' AND parent_id IS NULL) OR (type IN ('MATRIZ', 'FILIAL') AND parent_id IS NOT NULL)))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS auth_users (id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT NOT NULL, username TEXT NOT NULL COLLATE NOCASE CHECK (username = lower(username)), email TEXT NOT NULL COLLATE NOCASE CHECK (email = lower(email)), cpf TEXT NOT NULL CHECK (length(cpf) = 11 AND cpf NOT GLOB '*[^0-9]*'), password_hash TEXT NOT NULL, role_name TEXT NOT NULL, scope TEXT NOT NULL CHECK (scope IN ('CONVENCAO', 'MATRIZ', 'FILIAL')), status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')), must_change_password INTEGER NOT NULL DEFAULT 0, failed_attempts INTEGER NOT NULL DEFAULT 0, blocked_until TEXT, archived_at TEXT, archived_by INTEGER, archived_previous_status TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (tenant_id) REFERENCES tenants(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS user_unit_links (user_id INTEGER NOT NULL, unit_id INTEGER NOT NULL, is_primary INTEGER NOT NULL DEFAULT 1 CHECK (is_primary IN (0, 1)), created_at TEXT NOT NULL, PRIMARY KEY (user_id, unit_id), FOREIGN KEY (user_id) REFERENCES auth_users(id), FOREIGN KEY (unit_id) REFERENCES organizational_units(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS organizational_functions (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, name TEXT NOT NULL, normalized_name TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (tenant_id) REFERENCES tenants(id), UNIQUE(tenant_id, normalized_name))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS tenant_memberships (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, tenant_id INTEGER NOT NULL, display_name TEXT NOT NULL, role_name TEXT NOT NULL, function_id INTEGER, scope TEXT NOT NULL CHECK (scope IN ('CONVENCAO', 'MATRIZ', 'FILIAL')), scope_unit_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO', 'PENDENTE')), invited_by_membership_id INTEGER, accepted_at TEXT, archived_at TEXT, archived_by_membership_id INTEGER, archived_previous_status TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES auth_users(id), FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (function_id) REFERENCES organizational_functions(id), FOREIGN KEY (scope_unit_id) REFERENCES organizational_units(id), UNIQUE(user_id, tenant_id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL, tenant_id INTEGER, membership_id INTEGER, organization_selection_required INTEGER NOT NULL DEFAULT 0 CHECK (organization_selection_required IN (0, 1)), platform_context_active INTEGER NOT NULL DEFAULT 0 CHECK (platform_context_active IN (0, 1)), selected_unit_id INTEGER, previous_login_at TEXT, previous_identifier_type TEXT CHECK (previous_identifier_type IS NULL OR previous_identifier_type IN ('CPF', 'USUARIO', 'EMAIL')), previous_device_summary TEXT, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES auth_users(id), FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (membership_id) REFERENCES tenant_memberships(id), FOREIGN KEY (selected_unit_id) REFERENCES organizational_units(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS tenant_access_contexts (token_hash TEXT PRIMARY KEY, tenant_id INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, last_used_at TEXT NOT NULL, FOREIGN KEY (tenant_id) REFERENCES tenants(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS institution_lookup_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, code_fingerprint TEXT NOT NULL, success INTEGER NOT NULL CHECK (success IN (0, 1)), ip_address TEXT, created_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS login_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, tenant_id INTEGER, identifier_type TEXT NOT NULL CHECK (identifier_type IN ('CPF', 'USUARIO', 'EMAIL')), identifier_fingerprint TEXT NOT NULL, success INTEGER NOT NULL CHECK (success IN (0, 1)), failure_reason TEXT, ip_address TEXT, user_agent TEXT, device_summary TEXT, created_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES auth_users(id), FOREIGN KEY (tenant_id) REFERENCES tenants(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS user_permissions (user_id INTEGER NOT NULL, permission TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (user_id, permission), FOREIGN KEY (user_id) REFERENCES auth_users(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS membership_permissions (membership_id INTEGER NOT NULL, permission TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (membership_id, permission), FOREIGN KEY (membership_id) REFERENCES tenant_memberships(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS administration_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_user_id INTEGER NOT NULL, actor_membership_id INTEGER, tenant_id INTEGER NOT NULL, convention_id INTEGER NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL, unit_id INTEGER, ip_address TEXT, user_agent TEXT, device_summary TEXT, details TEXT, created_at TEXT NOT NULL, FOREIGN KEY (actor_user_id) REFERENCES auth_users(id), FOREIGN KEY (actor_membership_id) REFERENCES tenant_memberships(id), FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (convention_id) REFERENCES organizational_units(id), FOREIGN KEY (unit_id) REFERENCES organizational_units(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS unit_logos (unit_id INTEGER PRIMARY KEY NOT NULL, image_data BLOB NOT NULL, mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (unit_id) REFERENCES organizational_units(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS user_profile_photos (user_id INTEGER PRIMARY KEY NOT NULL, image_data BLOB NOT NULL, mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES auth_users(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS platform_owners (singleton_id INTEGER PRIMARY KEY DEFAULT 1 NOT NULL CHECK (singleton_id = 1), user_id INTEGER NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES auth_users(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS platform_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_user_id INTEGER NOT NULL, tenant_id INTEGER, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL, convention_id INTEGER, unit_id INTEGER, ip_address TEXT, user_agent TEXT, device_summary TEXT, details TEXT, created_at TEXT NOT NULL, FOREIGN KEY (actor_user_id) REFERENCES auth_users(id), FOREIGN KEY (tenant_id) REFERENCES tenants(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS commercial_profiles (tenant_id INTEGER PRIMARY KEY, person_type TEXT NOT NULL CHECK (person_type IN ('PESSOA_FISICA','PESSOA_JURIDICA')), legal_name TEXT NOT NULL, document TEXT, responsible_name TEXT, phone TEXT, billing_email TEXT, notes TEXT, customer_since TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (tenant_id) REFERENCES tenants(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS saas_plans (id INTEGER PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE, description TEXT, price_cents INTEGER NOT NULL CHECK (price_cents >= 0), billing_period TEXT NOT NULL CHECK (billing_period IN ('MENSAL','TRIMESTRAL','SEMESTRAL','ANUAL')), default_grace_days INTEGER NOT NULL DEFAULT 5, default_trial_days INTEGER NOT NULL DEFAULT 15, status TEXT NOT NULL DEFAULT 'ATIVO', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS billing_settings (singleton_id INTEGER PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1), warning_days INTEGER NOT NULL DEFAULT 7, pix_key TEXT, pix_key_type TEXT, payee_name TEXT, bank_name TEXT, bank_agency TEXT, bank_account TEXT, instructions TEXT, support_contact TEXT, updated_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS tenant_subscriptions (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL UNIQUE, plan_id INTEGER, contracted_price_cents INTEGER NOT NULL DEFAULT 0, custom_price_cents INTEGER, billing_period TEXT NOT NULL, status TEXT NOT NULL, start_date TEXT NOT NULL, next_due_date TEXT, due_day INTEGER, grace_days INTEGER NOT NULL DEFAULT 5, trial_start_date TEXT, trial_end_date TEXT, access_until TEXT, auto_renew INTEGER NOT NULL DEFAULT 1, notes TEXT, suspended_reason TEXT, payment_provider TEXT NOT NULL DEFAULT 'MANUAL', provider_customer_id TEXT, provider_subscription_id TEXT, external_reference TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (plan_id) REFERENCES saas_plans(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS saas_charges (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, subscription_id INTEGER NOT NULL, competence TEXT NOT NULL, description TEXT NOT NULL, amount_cents INTEGER NOT NULL, issued_date TEXT NOT NULL, due_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDENTE', paid_at TEXT, payment_method TEXT, notes TEXT, payment_provider TEXT NOT NULL DEFAULT 'MANUAL', provider_charge_id TEXT, external_reference TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (subscription_id) REFERENCES tenant_subscriptions(id), UNIQUE(subscription_id,due_date))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS saas_payments (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, subscription_id INTEGER NOT NULL, charge_id INTEGER NOT NULL UNIQUE, amount_cents INTEGER NOT NULL, paid_date TEXT NOT NULL, payment_method TEXT NOT NULL, notes TEXT, payment_provider TEXT NOT NULL DEFAULT 'MANUAL', provider_payment_id TEXT, external_reference TEXT UNIQUE, created_by INTEGER NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (subscription_id) REFERENCES tenant_subscriptions(id), FOREIGN KEY (charge_id) REFERENCES saas_charges(id), FOREIGN KEY (created_by) REFERENCES auth_users(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS commercial_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_user_id INTEGER NOT NULL, tenant_id INTEGER NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL, previous_values TEXT, new_values TEXT, reason TEXT, created_at TEXT NOT NULL, FOREIGN KEY (actor_user_id) REFERENCES auth_users(id), FOREIGN KEY (tenant_id) REFERENCES tenants(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS member_sequences (tenant_id INTEGER PRIMARY KEY, last_number INTEGER NOT NULL DEFAULT 0 CHECK(last_number>=0), updated_at TEXT NOT NULL, FOREIGN KEY(tenant_id) REFERENCES tenants(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS people (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, member_number INTEGER NOT NULL CHECK(member_number>0), full_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'MEMBRO_ATIVO', birth_date TEXT, sex TEXT, cpf TEXT, rg TEXT, birth_city TEXT, birth_state TEXT, phone TEXT, whatsapp TEXT, email TEXT, mother_name TEXT, father_name TEXT, marital_status TEXT, spouse_name TEXT, spouse_person_id INTEGER, children_count INTEGER NOT NULL DEFAULT 0, postal_code TEXT, street TEXT, address_number TEXT, complement TEXT, district TEXT, city TEXT, state TEXT, profession TEXT, workplace TEXT, education_level TEXT, theological_education TEXT, primary_function_id INTEGER, matrix_id INTEGER NOT NULL, branch_id INTEGER, church_entry_date TEXT, origin_church TEXT, conversion_date TEXT, baptism_date TEXT, consecration_date TEXT, notes TEXT, linked_auth_user_id INTEGER, created_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(tenant_id) REFERENCES tenants(id), FOREIGN KEY(spouse_person_id,tenant_id) REFERENCES people(id,tenant_id), FOREIGN KEY(primary_function_id,tenant_id) REFERENCES organizational_functions(id,tenant_id), FOREIGN KEY(matrix_id,tenant_id) REFERENCES organizational_units(id,tenant_id), FOREIGN KEY(branch_id,matrix_id,tenant_id) REFERENCES organizational_units(id,parent_id,tenant_id), FOREIGN KEY(linked_auth_user_id) REFERENCES auth_users(id), FOREIGN KEY(created_by_user_id) REFERENCES auth_users(id), UNIQUE(tenant_id,member_number), UNIQUE(id,tenant_id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS person_functions (person_id INTEGER NOT NULL, tenant_id INTEGER NOT NULL, function_id INTEGER NOT NULL, is_primary INTEGER NOT NULL DEFAULT 0, started_at TEXT, ended_at TEXT, created_at TEXT NOT NULL, PRIMARY KEY(person_id,function_id), FOREIGN KEY(person_id,tenant_id) REFERENCES people(id,tenant_id), FOREIGN KEY(function_id,tenant_id) REFERENCES organizational_functions(id,tenant_id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS person_history (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, person_id INTEGER NOT NULL, event_type TEXT NOT NULL, description TEXT NOT NULL, event_date TEXT, previous_values TEXT, new_values TEXT, actor_user_id INTEGER NOT NULL, actor_membership_id INTEGER, created_at TEXT NOT NULL, FOREIGN KEY(tenant_id) REFERENCES tenants(id), FOREIGN KEY(person_id,tenant_id) REFERENCES people(id,tenant_id), FOREIGN KEY(actor_user_id) REFERENCES auth_users(id), FOREIGN KEY(actor_membership_id) REFERENCES tenant_memberships(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS person_relationships (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, person_id INTEGER NOT NULL, related_person_id INTEGER NOT NULL, relationship_type TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(tenant_id) REFERENCES tenants(id), FOREIGN KEY(person_id,tenant_id) REFERENCES people(id,tenant_id), FOREIGN KEY(related_person_id,tenant_id) REFERENCES people(id,tenant_id), UNIQUE(person_id,related_person_id,relationship_type))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS member_photos (person_id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, image_data BLOB NOT NULL, mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(person_id,tenant_id) REFERENCES people(id,tenant_id), FOREIGN KEY(tenant_id) REFERENCES tenants(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS member_custom_fields (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, name TEXT NOT NULL, normalized_name TEXT NOT NULL, field_type TEXT NOT NULL, help_text TEXT, required INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'ATIVO', display_order INTEGER NOT NULL DEFAULT 0, section_name TEXT NOT NULL DEFAULT 'Informações adicionais', show_admin INTEGER NOT NULL DEFAULT 1, show_public INTEGER NOT NULL DEFAULT 0, show_print INTEGER NOT NULL DEFAULT 0, options_json TEXT, created_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(tenant_id) REFERENCES tenants(id), FOREIGN KEY(created_by_user_id) REFERENCES auth_users(id), UNIQUE(tenant_id,normalized_name), UNIQUE(id,tenant_id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS member_custom_values (person_id INTEGER NOT NULL, tenant_id INTEGER NOT NULL, field_id INTEGER NOT NULL, value_text TEXT NOT NULL, updated_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(person_id,field_id), FOREIGN KEY(person_id,tenant_id) REFERENCES people(id,tenant_id), FOREIGN KEY(field_id,tenant_id) REFERENCES member_custom_fields(id,tenant_id), FOREIGN KEY(updated_by_user_id) REFERENCES auth_users(id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS member_pre_registration_forms (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, token_prefix TEXT NOT NULL, unit_id INTEGER, status TEXT NOT NULL DEFAULT 'ATIVO', expires_at TEXT, created_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(tenant_id) REFERENCES tenants(id), FOREIGN KEY(unit_id,tenant_id) REFERENCES organizational_units(id,tenant_id), FOREIGN KEY(created_by_user_id) REFERENCES auth_users(id), UNIQUE(id,tenant_id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS member_pre_registrations (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, form_id INTEGER NOT NULL, full_name TEXT NOT NULL, birth_date TEXT, cpf TEXT, phone TEXT, whatsapp TEXT, email TEXT, voter_title TEXT, matrix_id INTEGER, branch_id INTEGER, status TEXT NOT NULL DEFAULT 'PENDENTE', payload_json TEXT NOT NULL, consent_at TEXT NOT NULL, consent_version TEXT NOT NULL, source_hash TEXT NOT NULL, review_reason TEXT, reviewed_by_user_id INTEGER, reviewed_at TEXT, approved_member_id INTEGER, correction_token_hash TEXT, correction_expires_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(tenant_id) REFERENCES tenants(id), FOREIGN KEY(form_id,tenant_id) REFERENCES member_pre_registration_forms(id,tenant_id), FOREIGN KEY(matrix_id,tenant_id) REFERENCES organizational_units(id,tenant_id), FOREIGN KEY(branch_id,matrix_id,tenant_id) REFERENCES organizational_units(id,parent_id,tenant_id), FOREIGN KEY(reviewed_by_user_id) REFERENCES auth_users(id), FOREIGN KEY(approved_member_id,tenant_id) REFERENCES people(id,tenant_id), UNIQUE(id,tenant_id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS member_pre_registration_photos (pre_registration_id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, image_data BLOB NOT NULL, mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(pre_registration_id,tenant_id) REFERENCES member_pre_registrations(id,tenant_id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS member_pre_registration_custom_values (pre_registration_id INTEGER NOT NULL, tenant_id INTEGER NOT NULL, field_id INTEGER NOT NULL, value_text TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(pre_registration_id,field_id), FOREIGN KEY(pre_registration_id,tenant_id) REFERENCES member_pre_registrations(id,tenant_id), FOREIGN KEY(field_id,tenant_id) REFERENCES member_custom_fields(id,tenant_id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS member_pre_registration_rate_limits (rate_key TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, window_started_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, tenant_id INTEGER, event TEXT NOT NULL, identifier_type TEXT, reason TEXT NOT NULL, matrix_id INTEGER, branch_id INTEGER, created_at TEXT NOT NULL, FOREIGN KEY (tenant_id) REFERENCES tenants(id))",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS user_unit_primary_unique ON user_unit_links(user_id) WHERE is_primary = 1",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS organizational_units_parent_idx ON organizational_units(parent_id, type, status)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS organizational_units_tenant_idx ON organizational_units(tenant_id, type, status)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS organizational_units_id_tenant_unique ON organizational_units(id,tenant_id)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS organizational_units_hierarchy_scope_unique ON organizational_units(id,parent_id,tenant_id)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS organizational_functions_id_tenant_unique ON organizational_functions(id,tenant_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS auth_users_tenant_idx ON auth_users(tenant_id, status)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS auth_users_tenant_username_unique ON auth_users(tenant_id, username) WHERE tenant_id IS NOT NULL",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS auth_users_tenant_email_unique ON auth_users(tenant_id, email) WHERE tenant_id IS NOT NULL",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS auth_users_tenant_cpf_unique ON auth_users(tenant_id, cpf) WHERE tenant_id IS NOT NULL",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS auth_users_platform_username_unique ON auth_users(username) WHERE tenant_id IS NULL",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS auth_users_platform_email_unique ON auth_users(email) WHERE tenant_id IS NULL",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS auth_users_platform_cpf_unique ON auth_users(cpf) WHERE tenant_id IS NULL",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS auth_sessions_tenant_idx ON auth_sessions(tenant_id, user_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS auth_sessions_membership_idx ON auth_sessions(membership_id, expires_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS tenant_memberships_tenant_status_idx ON tenant_memberships(tenant_id, status)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS tenant_memberships_user_status_idx ON tenant_memberships(user_id, status)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS audit_logs_tenant_idx ON audit_logs(tenant_id, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS login_history_user_created_idx ON login_history(user_id, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS login_history_fingerprint_created_idx ON login_history(identifier_fingerprint, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS login_history_ip_created_idx ON login_history(ip_address, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS tenant_access_contexts_expiry_idx ON tenant_access_contexts(expires_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS institution_lookup_attempts_ip_created_idx ON institution_lookup_attempts(ip_address, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS institution_lookup_attempts_code_created_idx ON institution_lookup_attempts(code_fingerprint, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS user_permissions_user_idx ON user_permissions(user_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS auth_users_archived_idx ON auth_users(archived_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS administration_audit_scope_idx ON administration_audit(convention_id, created_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS administration_audit_actor_idx ON administration_audit(actor_user_id, created_at)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS organizational_units_tenant_own_cnpj_unique ON organizational_units(tenant_id, cnpj) WHERE cnpj IS NOT NULL AND uses_parent_cnpj = 0",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS tenant_subscriptions_status_due_idx ON tenant_subscriptions(status,next_due_date)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS saas_charges_tenant_status_due_idx ON saas_charges(tenant_id,status,due_date)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS saas_payments_tenant_paid_idx ON saas_payments(tenant_id,paid_date)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS commercial_audit_tenant_created_idx ON commercial_audit(tenant_id,created_at)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS people_tenant_cpf_unique ON people(tenant_id,cpf) WHERE cpf IS NOT NULL",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS people_tenant_name_idx ON people(tenant_id,full_name COLLATE NOCASE)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS people_tenant_status_idx ON people(tenant_id,status)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS people_tenant_units_idx ON people(tenant_id,matrix_id,branch_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS people_tenant_function_idx ON people(tenant_id,primary_function_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS people_tenant_birth_idx ON people(tenant_id,birth_date)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS person_history_person_created_idx ON person_history(tenant_id,person_id,created_at)",
    ),
    db.prepare("CREATE INDEX IF NOT EXISTS member_custom_fields_tenant_status_order_idx ON member_custom_fields(tenant_id,status,display_order)"),
    db.prepare("CREATE INDEX IF NOT EXISTS member_pre_registration_forms_tenant_status_idx ON member_pre_registration_forms(tenant_id,status,created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS member_pre_registrations_tenant_status_created_idx ON member_pre_registrations(tenant_id,status,created_at)"),
  ]);

  const peopleColumns = await db.prepare("PRAGMA table_info(people)").all<{ name: string }>();
  if (!peopleColumns.results.some((column) => column.name === "voter_title"))
    await db.prepare("ALTER TABLE people ADD COLUMN voter_title TEXT").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS people_tenant_voter_title_idx ON people(tenant_id,voter_title)").run();

  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO tenants (id, name, slug, access_code, status, created_at, updated_at) VALUES (1, 'Organização inicial NexIgreja', 'organizacao-inicial', '4837261', 'ATIVO', ?, ?)",
      )
      .bind(now, now),
    db
      .prepare(
        "INSERT OR IGNORE INTO organizational_units (id, tenant_id, type, name, code, parent_id, status, created_at, updated_at) VALUES (1, 1, 'CONVENCAO', 'Convenção Amazônica', 'CONV-AMAZONICA', NULL, 'ATIVO', ?, ?)",
      )
      .bind(now, now),
    db
      .prepare(
        "INSERT OR IGNORE INTO organizational_units (id, tenant_id, type, name, code, parent_id, status, created_at, updated_at) VALUES (2, 1, 'MATRIZ', 'Matriz — Breu Branco', 'MATRIZ-BREU-BRANCO', 1, 'ATIVO', ?, ?)",
      )
      .bind(now, now),
    db
      .prepare(
        "INSERT OR IGNORE INTO organizational_units (id, tenant_id, type, name, code, parent_id, status, created_at, updated_at) VALUES (3, 1, 'MATRIZ', 'Matriz — Tucuruí', 'MATRIZ-TUCURUI', 1, 'ATIVO', ?, ?)",
      )
      .bind(now, now),
    db
      .prepare(
        "INSERT OR IGNORE INTO organizational_units (id, tenant_id, type, name, code, parent_id, status, created_at, updated_at) VALUES (4, 1, 'FILIAL', 'IPAD Sede Breu Branco', 'FILIAL-SEDE-BREU-BRANCO', 2, 'ATIVO', ?, ?)",
      )
      .bind(now, now),
    db
      .prepare(
        "INSERT OR IGNORE INTO organizational_units (id, tenant_id, type, name, code, parent_id, status, created_at, updated_at) VALUES (5, 1, 'FILIAL', 'Congregação Fonte de Luz', 'FILIAL-FONTE-DE-LUZ', 2, 'ATIVO', ?, ?)",
      )
      .bind(now, now),
    db
      .prepare(
        "INSERT OR IGNORE INTO organizational_units (id, tenant_id, type, name, code, parent_id, status, created_at, updated_at) VALUES (6, 1, 'FILIAL', 'Congregação Nova Jerusalém', 'FILIAL-NOVA-JERUSALEM', 2, 'ATIVO', ?, ?)",
      )
      .bind(now, now),
    db
      .prepare(
        "INSERT OR IGNORE INTO organizational_units (id, tenant_id, type, name, code, parent_id, status, created_at, updated_at) VALUES (7, 1, 'FILIAL', 'Congregação Central', 'FILIAL-CENTRAL-TUCURUI', 3, 'ATIVO', ?, ?)",
      )
      .bind(now, now),
    db
      .prepare(
        "INSERT OR IGNORE INTO billing_settings (singleton_id, warning_days, updated_at) VALUES (1, 7, ?)",
      )
      .bind(now),
    db
      .prepare(
        "INSERT OR IGNORE INTO saas_plans (id,name,description,price_cents,billing_period,default_grace_days,default_trial_days,status,created_at,updated_at) VALUES (1,'Acesso legado','Plano interno para preservar o acesso existente.',0,'MENSAL',0,0,'INATIVO',?,?)",
      )
      .bind(now, now),
    db
      .prepare(
        "INSERT OR IGNORE INTO commercial_profiles (tenant_id,person_type,legal_name,customer_since,created_at,updated_at) SELECT id,'PESSOA_JURIDICA',name,substr(created_at,1,10),?,? FROM tenants",
      )
      .bind(now, now),
    db
      .prepare(
        "INSERT OR IGNORE INTO tenant_subscriptions (id,tenant_id,plan_id,contracted_price_cents,billing_period,status,start_date,grace_days,auto_renew,notes,created_at,updated_at) SELECT id,id,1,0,'MENSAL','ISENTA',substr(created_at,1,10),0,0,'Cortesia de preservação do acesso existente.',?,? FROM tenants",
      )
      .bind(now, now),
    db
      .prepare(
        "INSERT OR IGNORE INTO member_sequences (tenant_id,last_number,updated_at) SELECT id,0,? FROM tenants",
      )
      .bind(now),
  ]);

  for (const user of TEST_USERS) {
    const exists = await db
      .prepare("SELECT id FROM auth_users WHERE id = ? LIMIT 1")
      .bind(user.id)
      .first<{ id: number }>();
    if (exists) continue;
    await db.batch([
      db
        .prepare(
          "INSERT INTO auth_users (id, tenant_id, name, username, email, cpf, password_hash, role_name, scope, status, must_change_password, failed_attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ATIVO', 0, 0, ?, ?)",
        )
        .bind(
          user.id,
          user.tenantId,
          user.name,
          user.username,
          user.email,
          user.cpf,
          user.passwordHash,
          user.roleName,
          user.scope,
          now,
          now,
        ),
      ...(user.tenantId === null
        ? []
        : [
            db
              .prepare(
                "INSERT INTO user_unit_links (user_id, unit_id, is_primary, created_at) VALUES (?, ?, 1, ?)",
              )
              .bind(user.id, user.unitId, now),
          ]),
      ...(user.tenantId === null
        ? []
        : [
            db
              .prepare(
                "INSERT OR IGNORE INTO organizational_functions (id, tenant_id, name, normalized_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'ATIVO', ?, ?)",
              )
              .bind(
                user.id,
                user.tenantId,
                user.roleName,
                user.roleName.toLocaleLowerCase("pt-BR"),
                now,
                now,
              ),
          ]),
      ...(user.tenantId === null
        ? []
        : [
            db
              .prepare(
                "INSERT INTO tenant_memberships (id, user_id, tenant_id, display_name, role_name, function_id, scope, scope_unit_id, status, accepted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ATIVO', ?, ?, ?)",
              )
              .bind(
                user.id,
                user.id,
                user.tenantId,
                user.name,
                user.roleName,
                user.id,
                user.scope,
                user.unitId,
                now,
                now,
                now,
              ),
          ]),
      ...TEST_ADMIN_PERMISSIONS.map((permission) =>
        db
          .prepare(
            "INSERT INTO user_permissions (user_id, permission, created_at) VALUES (?, ?, ?)",
          )
          .bind(user.id, permission, now),
      ),
      ...(user.tenantId === null
        ? []
        : TEST_ADMIN_PERMISSIONS.map((permission) =>
            db
              .prepare(
                "INSERT INTO membership_permissions (membership_id, permission, created_at) VALUES (?, ?, ?)",
              )
              .bind(user.id, permission, now),
          )),
    ]);
  }
  await db
    .prepare(
      "INSERT OR IGNORE INTO platform_owners (singleton_id, user_id, created_at, updated_at) SELECT 1, id, ?, ? FROM auth_users WHERE id = 1",
    )
    .bind(now, now)
    .run();

  // Concede o novo módulo aos administradores máximos já existentes sem
  // transformar as permissões de outros perfis durante o upgrade.
  const memberPermissions = TEST_ADMIN_PERMISSIONS.filter((permission) =>
    permission.startsWith("MEMBROS_") || permission.startsWith("PRECADASTROS_") || permission === "CAMPOS_MEMBROS_CONFIGURAR" || permission === "FORMULARIOS_PRECADASTRO_GERENCIAR",
  );
  const conventionMemberships = await db
    .prepare(
      "SELECT id FROM tenant_memberships WHERE scope = 'CONVENCAO' AND status = 'ATIVO' AND archived_at IS NULL",
    )
    .all<{ id: number }>();
  const platformOwners = await db
    .prepare("SELECT user_id FROM platform_owners")
    .all<{ user_id: number }>();
  await db.batch([
    ...conventionMemberships.results.flatMap(({ id }) =>
      memberPermissions.map((permission) =>
        db
          .prepare(
            "INSERT OR IGNORE INTO membership_permissions (membership_id, permission, created_at) VALUES (?, ?, ?)",
          )
          .bind(id, permission, now),
      ),
    ),
    ...platformOwners.results.flatMap(({ user_id }) =>
      memberPermissions.map((permission) =>
        db
          .prepare(
            "INSERT OR IGNORE INTO user_permissions (user_id, permission, created_at) VALUES (?, ?, ?)",
          )
          .bind(user_id, permission, now),
      ),
    ),
  ]);
}

export async function ensureDatabase(): Promise<void> {
  if (!databaseInitialization) {
    databaseInitialization = initializeDatabase().catch((error) => {
      databaseInitialization = null;
      throw error;
    });
  }
  return databaseInitialization;
}

export function requestMetadata(request: Request): RequestMetadata {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const ipAddress =
    (
      request.headers.get("cf-connecting-ip") ||
      forwarded ||
      request.headers.get("x-real-ip")
    )?.slice(0, 64) || null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 512) || null;
  if (!userAgent) return { ipAddress, userAgent: null, deviceSummary: null };

  const browser = /edg\//i.test(userAgent)
    ? "Microsoft Edge"
    : /firefox\//i.test(userAgent)
      ? "Firefox"
      : /chrome\//i.test(userAgent)
        ? "Google Chrome"
        : /safari\//i.test(userAgent)
          ? "Safari"
          : "Navegador";
  const device = /iphone|ipad/i.test(userAgent)
    ? "iPhone ou iPad"
    : /android/i.test(userAgent)
      ? "Android"
      : /windows/i.test(userAgent)
        ? "Windows"
        : /macintosh|mac os/i.test(userAgent)
          ? "macOS"
          : /linux/i.test(userAgent)
            ? "Linux"
            : "dispositivo não identificado";

  return { ipAddress, userAgent, deviceSummary: `${browser} em ${device}` };
}

async function institutionContextRow(
  request: Request,
): Promise<{
  tenant_id: number;
  name: string;
  status: SessionRow["tenant_status"];
} | null> {
  await ensureDatabase();
  const token = namedCookieValue(request, INSTITUTION_COOKIE_NAME);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const row = await database()
    .prepare(
      "SELECT context.tenant_id, tenant.name, tenant.status FROM tenant_access_contexts context JOIN tenants tenant ON tenant.id = context.tenant_id WHERE context.token_hash = ? AND context.expires_at > ? LIMIT 1",
    )
    .bind(tokenHash, now)
    .first<{
      tenant_id: number;
      name: string;
      status: SessionRow["tenant_status"];
    }>();
  if (!row) return null;
  await database()
    .prepare(
      "UPDATE tenant_access_contexts SET last_used_at = ? WHERE token_hash = ?",
    )
    .bind(now, tokenHash)
    .run();
  return row;
}

export async function currentInstitution(
  request: Request,
): Promise<InstitutionContext | null> {
  const row = await institutionContextRow(request);
  return isInstitutionAvailable(row?.status)
    ? { id: row!.tenant_id, name: row!.name }
    : null;
}

export async function identifyInstitution(
  request: Request,
  codeInput: string,
): Promise<{ institution: InstitutionContext; cookie: string }> {
  await ensureDatabase();
  const metadata = requestMetadata(request);
  const code = codeInput.trim();
  const fingerprint = await sha256(code);
  const cutoff = new Date(
    Date.now() - RATE_WINDOW_MINUTES * 60_000,
  ).toISOString();
  const failures = await database()
    .prepare(
      "SELECT COUNT(*) AS total FROM institution_lookup_attempts WHERE success = 0 AND created_at >= ? AND (ip_address = ? OR code_fingerprint = ?)",
    )
    .bind(cutoff, metadata.ipAddress, fingerprint)
    .first<{ total: number }>();
  if (Number(failures?.total ?? 0) >= 10) {
    throw new ApiError(
      429,
      "MUITAS_TENTATIVAS",
      "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    );
  }
  const tenant = isInstitutionCode(code)
    ? await database()
        .prepare(
          "SELECT id, name, status FROM tenants WHERE access_code = ? LIMIT 1",
        )
        .bind(code)
        .first<{
          id: number;
          name: string;
          status: SessionRow["tenant_status"];
        }>()
    : null;
  const success = isInstitutionAvailable(tenant?.status);
  const now = new Date();
  await database().batch([
    database()
      .prepare(
        "INSERT INTO institution_lookup_attempts (code_fingerprint, success, ip_address, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind(
        fingerprint,
        success ? 1 : 0,
        metadata.ipAddress,
        now.toISOString(),
      ),
    database()
      .prepare("DELETE FROM institution_lookup_attempts WHERE created_at < ?")
      .bind(
        new Date(
          now.getTime() - HISTORY_RETENTION_DAYS * 86400_000,
        ).toISOString(),
      ),
    database()
      .prepare("DELETE FROM tenant_access_contexts WHERE expires_at <= ?")
      .bind(now.toISOString()),
  ]);
  if (!tenant)
    throw new ApiError(
      400,
      "INSTITUICAO_INVALIDA",
      "Não foi possível identificar a instituição. Confira o código informado.",
    );
  if (!isInstitutionAvailable(tenant.status))
    throw new ApiError(
      403,
      "INSTITUICAO_INDISPONIVEL",
      "O acesso desta instituição está temporariamente indisponível. Entre em contato com o responsável pelo sistema.",
    );
  const token = randomToken();
  const expiresAt = new Date(
    now.getTime() + INSTITUTION_CONTEXT_DAYS * 86400_000,
  ).toISOString();
  await database()
    .prepare(
      "INSERT INTO tenant_access_contexts (token_hash, tenant_id, expires_at, created_at, last_used_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(
      await sha256(token),
      tenant.id,
      expiresAt,
      now.toISOString(),
      now.toISOString(),
    )
    .run();
  return {
    institution: { id: tenant.id, name: tenant.name },
    cookie: institutionCookie(request, token),
  };
}

function namedCookieValue(request: Request, cookieName: string): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === cookieName) return decodeURIComponent(value.join("="));
  }
  return null;
}

function cookieValue(request: Request): string | null {
  return namedCookieValue(request, COOKIE_NAME);
}

function sessionCookie(
  request: Request,
  token: string,
  maxAge = SESSION_HOURS * 3600,
): string {
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const secure =
    new URL(request.url).protocol === "https:" || forwardedProtocol === "https"
      ? "; Secure"
      : "";
  const expires = new Date(
    Date.now() + Math.max(0, maxAge) * 1000,
  ).toUTCString();
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Expires=${expires}${secure}`;
}

export function clearSessionCookie(request: Request): string {
  return sessionCookie(request, "", 0);
}

function institutionCookie(
  request: Request,
  token: string,
  maxAge = INSTITUTION_CONTEXT_DAYS * 86400,
): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const expires = new Date(Date.now() + maxAge * 1000).toUTCString();
  return `${INSTITUTION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Expires=${expires}${secure}`;
}

export function clearInstitutionCookie(request: Request): string {
  return institutionCookie(request, "", 0);
}

export function assertTrustedOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (
    (origin && origin !== new URL(request.url).origin) ||
    fetchSite === "cross-site"
  ) {
    throw new ApiError(
      403,
      "ORIGEM_NAO_AUTORIZADA",
      "Solicitação não autorizada.",
    );
  }
}

async function securityAudit(
  event: string,
  reason: string,
  userId: number | null,
  tenantId: number | null,
  matrixId: number | null = null,
  branchId: number | null = null,
): Promise<void> {
  await database()
    .prepare(
      "INSERT INTO audit_logs (user_id, tenant_id, event, reason, matrix_id, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      userId,
      tenantId,
      event,
      reason,
      matrixId,
      branchId,
      new Date().toISOString(),
    )
    .run();
}

async function recordLogin(
  userId: number | null,
  tenantId: number | null,
  identifierType: IdentifierType,
  identifierFingerprint: string,
  success: boolean,
  failureReason: string | null,
  metadata: RequestMetadata,
): Promise<void> {
  await database()
    .prepare(
      "INSERT INTO login_history (user_id, tenant_id, identifier_type, identifier_fingerprint, success, failure_reason, ip_address, user_agent, device_summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      userId,
      tenantId,
      identifierType,
      identifierFingerprint,
      success ? 1 : 0,
      failureReason,
      metadata.ipAddress,
      metadata.userAgent,
      metadata.deviceSummary,
      new Date().toISOString(),
    )
    .run();
}

async function recentFailureCount(
  identifierFingerprint: string,
  ipAddress: string | null,
  tenantId: number | null,
): Promise<number> {
  const cutoff = new Date(
    Date.now() - RATE_WINDOW_MINUTES * 60_000,
  ).toISOString();
  const row = await database()
    .prepare(
      "SELECT COUNT(*) AS total FROM login_history WHERE success = 0 AND created_at >= ? AND tenant_id IS ? AND (identifier_fingerprint = ? OR (? IS NOT NULL AND ip_address = ?))",
    )
    .bind(cutoff, tenantId, identifierFingerprint, ipAddress, ipAddress)
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

async function unitPath(unitId: number | null): Promise<UnitPath | null> {
  if (unitId === null) return null;
  return database()
    .prepare(
      "SELECT target.id, target.tenant_id, target.name, target.type, target.status, target.parent_id, target.archived_at, parent.name AS parent_name, parent.type AS parent_type, parent.status AS parent_status, parent.archived_at AS parent_archived_at, parent.parent_id AS grandparent_id, grandparent.name AS grandparent_name, grandparent.status AS grandparent_status, grandparent.archived_at AS grandparent_archived_at FROM organizational_units target LEFT JOIN organizational_units parent ON parent.id = target.parent_id AND parent.tenant_id = target.tenant_id LEFT JOIN organizational_units grandparent ON grandparent.id = parent.parent_id AND grandparent.tenant_id = target.tenant_id WHERE target.id = ?",
    )
    .bind(unitId)
    .first<UnitPath>();
}

async function conventionIdForUnit(unitId: number): Promise<number> {
  const path = await unitPath(unitId);
  const conventionId =
    path?.type === "CONVENCAO"
      ? path.id
      : path?.type === "MATRIZ"
        ? path.parent_id
        : (path?.grandparent_id ?? null);
  if (!path || !conventionId)
    throw new ApiError(
      403,
      "VINCULO_INVALIDO",
      "O vínculo organizacional precisa ser revisado.",
    );
  return conventionId;
}

async function activeContext(
  unitId: number | null,
): Promise<ActiveContext | null> {
  const unit = await unitPath(unitId);
  if (!unit || unit.status !== "ATIVO" || unit.archived_at) return null;
  if (unit.type === "CONVENCAO") {
    return { unitId: unit.id, matrixId: unit.id, branchId: null, unitName: unit.name, unitType: "CONVENCAO" };
  }
  if (
    unit.type === "MATRIZ" &&
    unit.parent_status === "ATIVO" &&
    !unit.parent_archived_at
  ) {
    return {
      unitId: unit.id,
      matrixId: unit.id,
      branchId: null,
      unitName: unit.name,
      unitType: "MATRIZ",
    };
  }
  if (
    unit.type === "FILIAL" &&
    unit.parent_id &&
    unit.parent_status === "ATIVO" &&
    unit.grandparent_status === "ATIVO" &&
    !unit.parent_archived_at &&
    !unit.grandparent_archived_at
  ) {
    return {
      unitId: unit.id,
      matrixId: unit.parent_id,
      branchId: unit.id,
      unitName: unit.name,
      unitType: "FILIAL",
    };
  }
  return null;
}

function isOperationalUnitPath(unit: UnitPath | null): boolean {
  if (!unit || unit.status !== "ATIVO" || unit.archived_at) return false;
  if (unit.type === "MATRIZ")
    return unit.parent_status === "ATIVO" && !unit.parent_archived_at;
  if (unit.type === "FILIAL") {
    return (
      unit.parent_status === "ATIVO" &&
      unit.grandparent_status === "ATIVO" &&
      !unit.parent_archived_at &&
      !unit.grandparent_archived_at
    );
  }
  return true;
}

async function bindingFor(
  row: DbUser,
): Promise<{ matrixId: number | null; branchId: number | null }> {
  if (row.scope === "MATRIZ")
    return { matrixId: row.scope_unit_id, branchId: null };
  if (row.scope === "FILIAL") {
    const unit = await unitPath(row.scope_unit_id);
    return { matrixId: unit?.parent_id ?? null, branchId: row.scope_unit_id };
  }
  return { matrixId: null, branchId: null };
}

type LicenseRow = {
  id: number;
  status: SubscriptionStatus;
  next_due_date: string | null;
  grace_days: number;
  trial_end_date: string | null;
  access_until: string | null;
  custom_price_cents: number | null;
  contracted_price_cents: number;
  billing_period: string;
};

async function publicBillingSettings(): Promise<BillingSettingsPublic> {
  const row = await database()
    .prepare(
      "SELECT warning_days, pix_key, pix_key_type, payee_name, bank_name, bank_agency, bank_account, instructions, support_contact FROM billing_settings WHERE singleton_id = 1",
    )
    .first<{
      warning_days: number;
      pix_key: string | null;
      pix_key_type: string | null;
      payee_name: string | null;
      bank_name: string | null;
      bank_agency: string | null;
      bank_account: string | null;
      instructions: string | null;
      support_contact: string | null;
    }>();
  return {
    warningDays: Number(row?.warning_days ?? 7),
    pixKey: row?.pix_key ?? null,
    pixKeyType: row?.pix_key_type ?? null,
    payeeName: row?.payee_name ?? null,
    bankName: row?.bank_name ?? null,
    bankAgency: row?.bank_agency ?? null,
    bankAccount: row?.bank_account ?? null,
    instructions: row?.instructions ?? null,
    supportContact: row?.support_contact ?? null,
  };
}

export async function refreshTenantLicense(
  tenantId: number,
  membershipId: number | null = null,
  scope: OrganizationalScope = "FILIAL",
): Promise<LicenseSummary> {
  const [subscription, payment, permission] = await Promise.all([
    database()
      .prepare(
        "SELECT id,status,next_due_date,grace_days,trial_end_date,access_until,custom_price_cents,contracted_price_cents,billing_period FROM tenant_subscriptions WHERE tenant_id = ? LIMIT 1",
      )
      .bind(tenantId)
      .first<LicenseRow>(),
    publicBillingSettings(),
    membershipId
      ? database()
          .prepare(
            "SELECT 1 AS allowed FROM membership_permissions WHERE membership_id = ? AND permission = 'ASSINATURA_VISUALIZAR' LIMIT 1",
          )
          .bind(membershipId)
          .first<{ allowed: number }>()
      : null,
  ]);
  const canViewDetails = scope === "CONVENCAO" || Boolean(permission);
  if (!subscription)
    return {
      status: "SUSPENSA",
      canAccess: false,
      canViewDetails,
      title: "Assinatura não configurada",
      message:
        "Entre em contato com o suporte do NexIgreja para regularizar o acesso.",
      daysRemaining: null,
      nextDueDate: null,
      trialEndDate: null,
      graceEndDate: null,
      payment,
    };
  const today = todayInBrazil();
  const result = evaluateLicense({
    status: subscription.status,
    today,
    nextDueDate: subscription.next_due_date,
    graceDays: subscription.grace_days,
    trialEndDate: subscription.trial_end_date,
    accessUntil: subscription.access_until,
    warningDays: payment.warningDays,
  });
  const statements: D1PreparedStatement[] = [];
  if (result.nextStatus !== subscription.status) {
    const timestamp = new Date().toISOString();
    statements.push(
      database()
        .prepare(
          "UPDATE tenant_subscriptions SET status = ?, suspended_reason = CASE WHEN ? = 'SUSPENSA' THEN 'Prazo comercial encerrado automaticamente' ELSE suspended_reason END, updated_at = ? WHERE id = ? AND status = ?",
        )
        .bind(
          result.nextStatus,
          result.nextStatus,
          timestamp,
          subscription.id,
          subscription.status,
        ),
    );
    statements.push(
      database()
        .prepare(
          "INSERT INTO commercial_audit (actor_user_id,tenant_id,action,entity_type,entity_id,previous_values,new_values,reason,created_at) SELECT user_id,?,'STATUS_AUTOMATICO','ASSINATURA',?,?,?,'Verificação automática de datas',? FROM platform_owners WHERE singleton_id = 1",
        )
        .bind(
          tenantId,
          subscription.id,
          JSON.stringify({ status: subscription.status }),
          JSON.stringify({ status: result.nextStatus }),
          timestamp,
        ),
    );
  }
  statements.push(
    database()
      .prepare(
        "UPDATE saas_charges SET status = 'VENCIDA', updated_at = ? WHERE tenant_id = ? AND status = 'PENDENTE' AND due_date < ?",
      )
      .bind(new Date().toISOString(), tenantId, today),
  );
  if (
    !["TESTE", "ISENTA", "CANCELADA", "ENCERRADA"].includes(
      result.nextStatus,
    ) &&
    subscription.next_due_date
  ) {
    const amount =
      subscription.custom_price_cents ?? subscription.contracted_price_cents;
    const timestamp = new Date().toISOString();
    statements.push(
      database()
        .prepare(
          "INSERT OR IGNORE INTO saas_charges (tenant_id,subscription_id,competence,description,amount_cents,issued_date,due_date,status,payment_provider,created_at,updated_at) VALUES (?,?,?,'Mensalidade NexIgreja',?,?,?,'PENDENTE','MANUAL',?,?)",
        )
        .bind(
          tenantId,
          subscription.id,
          subscription.next_due_date.slice(0, 7),
          amount,
          today,
          subscription.next_due_date,
          timestamp,
          timestamp,
        ),
    );
  }
  if (statements.length) await database().batch(statements);
  return { ...result, status: result.nextStatus, canViewDetails, payment };
}

async function safePayload(row: SessionRow): Promise<SafeSessionPayload> {
  const profile = await database()
    .prepare(
      "SELECT updated_at FROM user_profile_photos WHERE user_id = ? LIMIT 1",
    )
    .bind(row.user_id)
    .first<{ updated_at: string }>();
  if (row.is_platform_owner && !row.platform_context_active) {
    return {
      user: {
        id: row.user_id,
        membershipId: null,
        name: row.name,
        username: row.username,
        roleName: row.role_name,
        status: "ATIVO",
        organizationalScope: row.scope,
        mustChangePassword: Boolean(row.must_change_password),
        profilePhotoUrl: userPhotoUrl(row.user_id, profile?.updated_at ?? null),
        isPlatformOwner: true,
        platformTenantContextActive: false,
      },
      binding: { matrixId: null, branchId: null },
      activeContext: null,
      activeConvention: null,
      activeTenant: null,
      unitLogoUrl: null,
      lastPreviousAccess:
        row.previous_login_at && row.previous_identifier_type
          ? {
              dateTime: row.previous_login_at,
              identifierType: row.previous_identifier_type,
              originSummary: row.previous_device_summary,
            }
          : null,
      license: null,
    };
  }
  const [binding, context, selectedTarget, scopeTarget] = await Promise.all([
    bindingFor(row),
    activeContext(row.selected_unit_id),
    unitPath(row.selected_unit_id),
    unitPath(row.scope_unit_id),
  ]);
  const selectedInTenant =
    selectedTarget?.tenant_id === row.session_tenant_id &&
    isOperationalUnitPath(selectedTarget);
  const scopeInTenant =
    scopeTarget?.tenant_id === row.session_tenant_id &&
    isOperationalUnitPath(scopeTarget);
  const target = selectedInTenant
    ? selectedTarget
    : scopeInTenant
      ? scopeTarget
      : null;
  const conventionId =
    target?.type === "CONVENCAO"
      ? target.id
      : target?.type === "MATRIZ"
        ? target.parent_id
        : (target?.grandparent_id ?? null);
  const conventionName =
    target?.type === "CONVENCAO"
      ? target.name
      : target?.type === "MATRIZ"
        ? target.parent_name
        : (target?.grandparent_name ?? null);
  if (!conventionId || !conventionName)
    throw new ApiError(
      403,
      "VINCULO_INVALIDO",
      "A convenção selecionada não está disponível.",
    );
  const matrixId =
    target?.type === "MATRIZ"
      ? target.id
      : target?.type === "FILIAL"
        ? target.parent_id
        : null;
  const branchId = target?.type === "FILIAL" ? target.id : null;
  const logoIds = [conventionId, matrixId, branchId].filter(
    (id): id is number => id !== null,
  );
  const logoRows = logoIds.length
    ? await database()
        .prepare(
          `SELECT unit_id, updated_at FROM unit_logos WHERE unit_id IN (${logoIds.map(() => "?").join(",")})`,
        )
        .bind(...logoIds)
        .all<{ unit_id: number; updated_at: string }>()
    : { results: [] as Array<{ unit_id: number; updated_at: string }> };
  const logos = new Map(
    logoRows.results.map((logo) => [logo.unit_id, logo.updated_at]),
  );
  const license = await refreshTenantLicense(
    row.session_tenant_id!,
    row.membership_id,
    row.scope,
  );
  return {
    user: {
      id: row.user_id,
      membershipId: row.membership_id,
      name: row.name,
      username: row.username,
      roleName: row.role_name,
      status: "ATIVO",
      organizationalScope: row.scope,
      mustChangePassword: Boolean(row.must_change_password),
      profilePhotoUrl: userPhotoUrl(row.user_id, profile?.updated_at ?? null),
      isPlatformOwner: Boolean(row.is_platform_owner),
      platformTenantContextActive: Boolean(row.platform_context_active),
    },
    binding,
    activeContext: context,
    activeConvention: { id: conventionId, name: conventionName },
    activeTenant: {
      id: row.session_tenant_id!,
      name: row.tenant_name!,
      slug: row.tenant_slug!,
      status: row.tenant_status!,
    },
    unitLogoUrl: resolveEffectiveLogoUrl({
      branch: branchId
        ? unitLogoUrl(branchId, logos.get(branchId) ?? null)
        : null,
      matrix: matrixId
        ? unitLogoUrl(matrixId, logos.get(matrixId) ?? null)
        : null,
      convention: conventionId
        ? unitLogoUrl(conventionId, logos.get(conventionId) ?? null)
        : null,
    }),
    lastPreviousAccess:
      row.previous_login_at && row.previous_identifier_type
        ? {
            dateTime: row.previous_login_at,
            identifierType: row.previous_identifier_type,
            originSummary: row.previous_device_summary,
          }
        : null,
    license,
  };
}

const SESSION_QUERY =
  "SELECT s.id AS session_id, s.tenant_id AS session_tenant_id, s.membership_id, s.organization_selection_required, s.platform_context_active, s.selected_unit_id, s.previous_login_at, s.previous_identifier_type, s.previous_device_summary, s.expires_at, s.last_seen_at, tenant.name AS tenant_name, tenant.slug AS tenant_slug, tenant.status AS tenant_status, u.id AS user_id, membership.tenant_id, COALESCE(membership.display_name, u.name) AS name, u.username, u.email, u.cpf, u.password_hash, COALESCE(org_function.name, membership.role_name, u.role_name) AS role_name, COALESCE(membership.scope, u.scope) AS scope, u.status, u.must_change_password, u.failed_attempts, u.blocked_until, membership.status AS membership_status, membership.scope_unit_id, scope_unit.type AS scope_unit_type, EXISTS(SELECT 1 FROM platform_owners owner WHERE owner.user_id = u.id) AS is_platform_owner FROM auth_sessions s LEFT JOIN tenants tenant ON tenant.id = s.tenant_id JOIN auth_users u ON u.id = s.user_id AND u.archived_at IS NULL LEFT JOIN tenant_memberships membership ON membership.id = s.membership_id AND membership.user_id = u.id AND membership.tenant_id = s.tenant_id AND membership.archived_at IS NULL LEFT JOIN organizational_functions org_function ON org_function.id = membership.function_id AND org_function.tenant_id = membership.tenant_id LEFT JOIN organizational_units scope_unit ON scope_unit.id = membership.scope_unit_id AND scope_unit.tenant_id = membership.tenant_id WHERE s.token_hash = ? LIMIT 1";

async function sessionRow(
  request: Request,
  allowPendingMembership = false,
): Promise<SessionRow> {
  await ensureDatabase();
  const token = cookieValue(request);
  if (!token)
    throw new ApiError(401, "SESSAO_AUSENTE", "Entre para continuar.");

  const tokenHash = await sha256(token);
  const row = await database()
    .prepare(SESSION_QUERY)
    .bind(tokenHash)
    .first<SessionRow>();
  const now = Date.now();
  const expired = row
    ? new Date(row.expires_at).getTime() <= now ||
      new Date(row.last_seen_at).getTime() + IDLE_MINUTES * 60_000 <= now
    : true;

  const [scopePath, selectedPath] = row
    ? await Promise.all([
        unitPath(row.scope_unit_id),
        unitPath(row.selected_unit_id),
      ])
    : [null, null];
  const tenantOperational = row?.tenant_status === "ATIVO";
  const scopeOperational = Boolean(
    row &&
    scopePath &&
    scopePath.tenant_id === row.session_tenant_id &&
    row.tenant_id === row.session_tenant_id &&
    isOperationalUnitPath(scopePath),
  );
  const ownerContextOperational = Boolean(
    row &&
    selectedPath &&
    selectedPath.tenant_id === row.session_tenant_id &&
    isOperationalUnitPath(selectedPath),
  );
  const membershipOperational =
    row?.membership_status === "ATIVO" && scopeOperational;
  const pendingAllowed =
    (allowPendingMembership || Boolean(row?.organization_selection_required)) &&
    row?.membership_status === "PENDENTE" &&
    Boolean(
      scopePath &&
      scopePath.tenant_id === row.session_tenant_id &&
      isOperationalUnitPath(scopePath),
    );
  const ownerSessionOperational = Boolean(
    row?.is_platform_owner &&
    (!row.platform_context_active ||
      (tenantOperational && ownerContextOperational)),
  );
  if (
    !row ||
    row.status !== "ATIVO" ||
    expired ||
    (row.is_platform_owner
      ? !ownerSessionOperational
      : !tenantOperational || !(membershipOperational || pendingAllowed))
  ) {
    if (row)
      await database()
        .prepare("DELETE FROM auth_sessions WHERE id = ?")
        .bind(row.session_id)
        .run();
    throw new ApiError(
      401,
      "SESSAO_INVALIDA",
      "Sua sessão expirou. Entre novamente.",
    );
  }
  if (row.organization_selection_required && !allowPendingMembership) {
    throw new ApiError(
      409,
      "ORGANIZACAO_NAO_SELECIONADA",
      "Escolha uma organização para continuar.",
    );
  }

  row.last_seen_at = new Date().toISOString();
  await database()
    .prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?")
    .bind(row.last_seen_at, row.session_id)
    .run();
  return row;
}

async function loginMemberships(userId: number): Promise<MembershipLoginRow[]> {
  const result = await database()
    .prepare(
      "SELECT membership.id AS membership_id, membership.tenant_id, tenant.name AS tenant_name, tenant.slug AS tenant_slug, tenant.status AS tenant_status, membership.display_name, COALESCE(org_function.name, membership.role_name) AS role_name, membership.scope, membership.scope_unit_id, scope_unit.type AS scope_unit_type, membership.status AS membership_status FROM tenant_memberships membership JOIN tenants tenant ON tenant.id = membership.tenant_id LEFT JOIN organizational_functions org_function ON org_function.id = membership.function_id AND org_function.tenant_id = membership.tenant_id JOIN organizational_units scope_unit ON scope_unit.id = membership.scope_unit_id AND scope_unit.tenant_id = membership.tenant_id WHERE membership.user_id = ? AND membership.status IN ('ATIVO', 'PENDENTE') AND membership.archived_at IS NULL AND tenant.status = 'ATIVO' AND scope_unit.status = 'ATIVO' AND scope_unit.archived_at IS NULL ORDER BY tenant.name, membership.id",
    )
    .bind(userId)
    .all<MembershipLoginRow>();

  const operational: MembershipLoginRow[] = [];
  for (const membership of result.results) {
    const path = await unitPath(membership.scope_unit_id);
    if (path?.tenant_id === membership.tenant_id && isOperationalUnitPath(path))
      operational.push(membership);
  }
  return operational;
}

function organizationOption(
  membership: MembershipLoginRow,
): OrganizationOption {
  if (membership.membership_status === "INATIVO") {
    throw new ApiError(
      403,
      "VINCULO_INATIVO",
      "O vínculo organizacional não está ativo.",
    );
  }
  return {
    id: membership.tenant_id,
    name: membership.tenant_name,
    slug: membership.tenant_slug,
    status: membership.tenant_status,
    membershipId: membership.membership_id,
    membershipStatus: membership.membership_status,
    roleName: membership.role_name,
  };
}

export async function login(
  request: Request,
  identifierInput: string,
  password: string,
  mode: "ORGANIZATIONAL" | "PLATFORM" = "ORGANIZATIONAL",
): Promise<LoginResult> {
  await ensureDatabase();
  const institution =
    mode === "ORGANIZATIONAL" ? await institutionContextRow(request) : null;
  if (
    mode === "ORGANIZATIONAL" &&
    (!institution || institution.status !== "ATIVO")
  ) {
    throw new ApiError(
      401,
      "INSTITUICAO_NAO_IDENTIFICADA",
      "Informe o código da instituição para continuar.",
    );
  }
  const identifier = normalizeLoginIdentifier(identifierInput);
  const metadata = requestMetadata(request);
  const identifierFingerprint = await sha256(
    `${loginIsolationNamespace(mode, institution?.tenant_id ?? null)}:${identifier.type}:${identifier.normalized}`,
  );
  const rateTenantId = mode === "PLATFORM" ? null : institution!.tenant_id;

  if (
    (await recentFailureCount(
      identifierFingerprint,
      metadata.ipAddress,
      rateTenantId,
    )) >= MAX_FAILURES
  ) {
    await recordLogin(
      null,
      null,
      identifier.type,
      identifierFingerprint,
      false,
      "LIMITE_DE_TENTATIVAS",
      metadata,
    );
    throw new ApiError(
      429,
      "MUITAS_TENTATIVAS",
      "Muitas tentativas. Aguarde 15 minutos e tente novamente.",
    );
  }

  const column =
    identifier.type === "CPF"
      ? "cpf"
      : identifier.type === "EMAIL"
        ? "email"
        : "username";
  const query = `SELECT u.id AS user_id, u.tenant_id, u.name, u.username, u.email, u.cpf, u.password_hash, u.status, u.must_change_password, u.failed_attempts, u.blocked_until, EXISTS(SELECT 1 FROM platform_owners owner WHERE owner.user_id = u.id) AS is_platform_owner FROM auth_users u WHERE u.${column} = ? AND u.archived_at IS NULL ${mode === "PLATFORM" ? "AND u.tenant_id IS NULL AND EXISTS(SELECT 1 FROM platform_owners owner WHERE owner.user_id = u.id)" : "AND u.tenant_id = ?"} LIMIT 1`;
  const user = identifier.valid
    ? await database()
        .prepare(query)
        .bind(
          identifier.normalized,
          ...(mode === "ORGANIZATIONAL" ? [institution!.tenant_id] : []),
        )
        .first<IdentityRow>()
    : null;
  const passwordMatches = await bcrypt.compare(
    password || "\u0000",
    user?.password_hash ?? DUMMY_PASSWORD_HASH,
  );
  const userBlocked = Boolean(
    user?.blocked_until && new Date(user.blocked_until) > new Date(),
  );
  const memberships =
    user && mode === "ORGANIZATIONAL"
      ? await loginMemberships(user.user_id)
      : [];
  const initialMembership =
    memberships.find(
      (membership) =>
        membership.tenant_id === institution?.tenant_id &&
        membership.membership_status === "ATIVO",
    ) ?? null;
  const validAccount = Boolean(
    user &&
    passwordMatches &&
    user.status === "ATIVO" &&
    !userBlocked &&
    (mode === "PLATFORM"
      ? user.is_platform_owner
      : !user.is_platform_owner && initialMembership),
  );
  if (!validAccount || !user) {
    const reason = userBlocked
      ? "BLOQUEIO_ATIVO"
      : !identifier.valid
        ? "IDENTIFICADOR_INVALIDO"
        : !user
          ? "CONTA_NAO_ENCONTRADA"
          : "SENHA_INCORRETA";
    await recordLogin(
      user?.user_id ?? null,
      institution?.tenant_id ?? null,
      identifier.type,
      identifierFingerprint,
      false,
      reason,
      metadata,
    );
    const failures = await recentFailureCount(
      identifierFingerprint,
      metadata.ipAddress,
      rateTenantId,
    );
    const shouldBlock =
      userBlocked ||
      failures >= MAX_FAILURES ||
      Boolean(user && user.failed_attempts + 1 >= MAX_FAILURES);

    if (user) {
      const blockedUntil = shouldBlock
        ? new Date(Date.now() + RATE_WINDOW_MINUTES * 60_000).toISOString()
        : null;
      await database()
        .prepare(
          "UPDATE auth_users SET failed_attempts = ?, blocked_until = ?, updated_at = ? WHERE id = ?",
        )
        .bind(
          shouldBlock ? 0 : user.failed_attempts + 1,
          blockedUntil,
          new Date().toISOString(),
          user.user_id,
        )
        .run();
    }

    if (shouldBlock) {
      throw new ApiError(
        429,
        "MUITAS_TENTATIVAS",
        "Muitas tentativas. Aguarde 15 minutos e tente novamente.",
      );
    }
    throw new ApiError(401, "LOGIN_RECUSADO", GENERIC_LOGIN_MESSAGE);
  }

  const now = new Date();
  const previous = await database()
    .prepare(
      "SELECT created_at, identifier_type, device_summary FROM login_history WHERE user_id = ? AND success = 1 ORDER BY created_at DESC, id DESC LIMIT 1",
    )
    .bind(user.user_id)
    .first<{
      created_at: string;
      identifier_type: IdentifierType;
      device_summary: string | null;
    }>();
  const token = randomToken();
  const tokenHash = await sha256(token);
  const sessionId = crypto.randomUUID();
  const selectedUnitId =
    mode === "PLATFORM"
      ? null
      : initialMembership?.scope === "CONVENCAO"
        ? null
        : (initialMembership?.scope_unit_id ?? null);
  const sessionTenantId =
    mode === "PLATFORM" ? null : (initialMembership?.tenant_id ?? null);
  if (mode === "ORGANIZATIONAL" && !sessionTenantId)
    throw new ApiError(
      403,
      "TENANT_INDISPONIVEL",
      "Nenhuma organização ativa está disponível para iniciar a sessão.",
    );
  const expiresAt = new Date(
    now.getTime() + SESSION_HOURS * 3600_000,
  ).toISOString();
  const historyCutoff = new Date(
    now.getTime() - HISTORY_RETENTION_DAYS * 24 * 3600_000,
  ).toISOString();

  await database().batch([
    database()
      .prepare(
        "UPDATE auth_users SET failed_attempts = 0, blocked_until = NULL, updated_at = ? WHERE id = ?",
      )
      .bind(now.toISOString(), user.user_id),
    database()
      .prepare("DELETE FROM auth_sessions WHERE expires_at <= ?")
      .bind(now.toISOString()),
    database()
      .prepare("DELETE FROM login_history WHERE created_at < ?")
      .bind(historyCutoff),
    database()
      .prepare(
        "INSERT INTO auth_sessions (id, token_hash, user_id, tenant_id, membership_id, organization_selection_required, platform_context_active, selected_unit_id, previous_login_at, previous_identifier_type, previous_device_summary, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        sessionId,
        tokenHash,
        user.user_id,
        sessionTenantId,
        initialMembership?.membership_id ?? null,
        selectedUnitId,
        previous?.created_at ?? null,
        previous?.identifier_type ?? null,
        previous?.device_summary ?? null,
        expiresAt,
        now.toISOString(),
        now.toISOString(),
      ),
    database()
      .prepare(
        "INSERT INTO login_history (user_id, tenant_id, identifier_type, identifier_fingerprint, success, failure_reason, ip_address, user_agent, device_summary, created_at) VALUES (?, ?, ?, ?, 1, NULL, ?, ?, ?, ?)",
      )
      .bind(
        user.user_id,
        sessionTenantId,
        identifier.type,
        identifierFingerprint,
        metadata.ipAddress,
        metadata.userAgent,
        metadata.deviceSummary,
        now.toISOString(),
      ),
  ]);

  const row = await database()
    .prepare(SESSION_QUERY)
    .bind(tokenHash)
    .first<SessionRow>();
  if (!row)
    throw new ApiError(
      500,
      "ERRO_INTERNO",
      "Não foi possível iniciar a sessão.",
    );
  return {
    payload: await safePayload(row),
    organizations: [],
    requiresOrganizationSelection: false,
    cookie: sessionCookie(request, token),
  };
}

export async function me(request: Request): Promise<SafeSessionPayload> {
  return safePayload(await sessionRow(request));
}

export async function organizationOptions(
  request: Request,
): Promise<OrganizationOption[]> {
  const row = await sessionRow(request, true);
  if (row.is_platform_owner) return [];
  return (await loginMemberships(row.user_id)).map(organizationOption);
}

export async function switchOrganization(
  request: Request,
  membershipId: number,
): Promise<SafeSessionPayload> {
  const row = await sessionRow(request, true);
  if (row.is_platform_owner) {
    throw new ApiError(
      403,
      "ACESSO_NEGADO",
      "Use o seletor de contexto da plataforma para acessar uma Convenção.",
    );
  }
  const memberships = await loginMemberships(row.user_id);
  const target = memberships.find(
    (item) =>
      item.membership_id === membershipId && item.membership_status === "ATIVO",
  );
  if (!target) {
    await securityAudit(
      "TROCA_ORGANIZACAO_NEGADA",
      "VINCULO_NAO_AUTORIZADO",
      row.user_id,
      row.session_tenant_id,
    );
    throw new ApiError(
      403,
      "ACESSO_NEGADO",
      "Essa organização não está disponível para sua conta.",
    );
  }

  const selectedUnitId =
    target.scope === "CONVENCAO" ? null : target.scope_unit_id;
  const now = new Date().toISOString();
  await database()
    .prepare(
      "UPDATE auth_sessions SET tenant_id = ?, membership_id = ?, organization_selection_required = 0, selected_unit_id = ?, last_seen_at = ? WHERE id = ? AND user_id = ?",
    )
    .bind(
      target.tenant_id,
      target.membership_id,
      selectedUnitId,
      now,
      row.session_id,
      row.user_id,
    )
    .run();
  await securityAudit(
    "TROCA_ORGANIZACAO",
    "VINCULO_ATIVADO",
    row.user_id,
    target.tenant_id,
  );

  const refreshed = await database()
    .prepare(SESSION_QUERY)
    .bind(await sha256(cookieValue(request) ?? ""))
    .first<SessionRow>();
  if (!refreshed)
    throw new ApiError(
      401,
      "SESSAO_INVALIDA",
      "Sua sessão expirou. Entre novamente.",
    );
  return safePayload(refreshed);
}

export async function acceptOrganizationInvite(
  request: Request,
  membershipId: number,
): Promise<SafeSessionPayload> {
  const row = await sessionRow(request, true);
  if (row.is_platform_owner)
    throw new ApiError(
      403,
      "ACESSO_NEGADO",
      "Convite organizacional inválido.",
    );
  const memberships = await loginMemberships(row.user_id);
  const target = memberships.find(
    (item) =>
      item.membership_id === membershipId &&
      item.membership_status === "PENDENTE",
  );
  if (!target)
    throw new ApiError(
      403,
      "ACESSO_NEGADO",
      "Esse convite não está disponível para sua conta.",
    );

  const now = new Date().toISOString();
  const selectedUnitId =
    target.scope === "CONVENCAO" ? null : target.scope_unit_id;
  await database().batch([
    database()
      .prepare(
        "UPDATE tenant_memberships SET status = 'ATIVO', accepted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status = 'PENDENTE' AND archived_at IS NULL",
      )
      .bind(now, now, target.membership_id, row.user_id),
    database()
      .prepare(
        "UPDATE auth_sessions SET tenant_id = ?, membership_id = ?, organization_selection_required = 0, selected_unit_id = ?, last_seen_at = ? WHERE id = ? AND user_id = ?",
      )
      .bind(
        target.tenant_id,
        target.membership_id,
        selectedUnitId,
        now,
        row.session_id,
        row.user_id,
      ),
    database()
      .prepare(
        "INSERT INTO administration_audit (actor_user_id, actor_membership_id, tenant_id, convention_id, action, entity_type, entity_id, unit_id, details, created_at) VALUES (?, ?, ?, ?, 'CONVITE_ACEITO', 'MEMBERSHIP', ?, ?, ?, ?)",
      )
      .bind(
        row.user_id,
        target.membership_id,
        target.tenant_id,
        await conventionIdForUnit(target.scope_unit_id),
        target.membership_id,
        target.scope_unit_id,
        JSON.stringify({ roleName: target.role_name }),
        now,
      ),
  ]);
  const refreshed = await database()
    .prepare(SESSION_QUERY)
    .bind(await sha256(cookieValue(request) ?? ""))
    .first<SessionRow>();
  if (!refreshed)
    throw new ApiError(
      401,
      "SESSAO_INVALIDA",
      "Sua sessão expirou. Entre novamente.",
    );
  return safePayload(refreshed);
}

export async function administrativeSession(
  request: Request,
  allowSuspended = false,
): Promise<AdministrativeSession> {
  const row = await sessionRow(request);
  if (row.is_platform_owner && !row.platform_context_active) {
    throw new ApiError(
      403,
      "CONTEXTO_TENANT_NECESSARIO",
      "Selecione um cliente em Administração do NexIgreja antes de acessar dados organizacionais.",
    );
  }
  const scopeUnit = await unitPath(row.scope_unit_id);
  const selectedUnit = Boolean(row.is_platform_owner)
    ? await unitPath(row.selected_unit_id)
    : null;
  if (
    !row.is_platform_owner &&
    (!scopeUnit || scopeUnit.tenant_id !== row.session_tenant_id)
  ) {
    throw new ApiError(
      403,
      "VINCULO_INVALIDO",
      "Seu vínculo organizacional precisa ser revisado.",
    );
  }

  const effectiveUnit = row.is_platform_owner ? selectedUnit : scopeUnit;
  if (
    !effectiveUnit ||
    effectiveUnit.tenant_id !== row.session_tenant_id ||
    !isOperationalUnitPath(effectiveUnit)
  ) {
    throw new ApiError(
      403,
      "TENANT_INDISPONIVEL",
      "A organização selecionada não está disponível.",
    );
  }
  const conventionId =
    effectiveUnit.type === "CONVENCAO"
      ? effectiveUnit.id
      : effectiveUnit.type === "MATRIZ"
        ? effectiveUnit.parent_id
        : effectiveUnit.grandparent_id;
  if (!conventionId) {
    throw new ApiError(
      403,
      "VINCULO_INVALIDO",
      "Seu vínculo organizacional precisa ser revisado.",
    );
  }

  const session: AdministrativeSession = {
    sessionId: row.session_id,
    user: {
      id: row.user_id,
      membershipId: row.membership_id,
      name: row.name,
      conventionId,
      tenantId: row.session_tenant_id,
      tenantStatus: row.tenant_status!,
      scope: row.scope,
      boundMatrixId: row.scope === "MATRIZ" ? (scopeUnit?.id ?? null) : null,
      boundBranchId: row.scope === "FILIAL" ? (scopeUnit?.id ?? null) : null,
      mustChangePassword: Boolean(row.must_change_password),
      isPlatformOwner: Boolean(row.is_platform_owner),
      platformTenantContextActive: Boolean(row.platform_context_active),
    },
    activeContext: await activeContext(row.selected_unit_id),
  };
  if (!allowSuspended && !canBypassLicense(Boolean(row.is_platform_owner))) {
    const license = await refreshTenantLicense(
      row.session_tenant_id!,
      row.membership_id,
      row.scope,
    );
    if (!license.canAccess)
      throw new ApiError(
        402,
        "LICENCA_SUSPENSA",
        "A assinatura do NexIgreja precisa ser regularizada.",
      );
  }
  return session;
}

export async function platformOwnerSession(
  request: Request,
): Promise<PlatformOwnerSession> {
  const row = await sessionRow(request);
  return {
    sessionId: row.session_id,
    user: {
      id: row.user_id,
      name: row.name,
      mustChangePassword: Boolean(row.must_change_password),
      isPlatformOwner: Boolean(row.is_platform_owner),
    },
  };
}

export async function availableContexts(
  request: Request,
): Promise<AvailableContexts> {
  const row = await sessionRow(request);
  const db = database();

  if (row.is_platform_owner) {
    const selected = await unitPath(row.selected_unit_id);
    const conventionId =
      selected?.type === "CONVENCAO"
        ? selected.id
        : selected?.type === "MATRIZ"
          ? selected.parent_id
          : (selected?.grandparent_id ?? null);
    const [tenants, conventions, matrices, branches] = await Promise.all([
      db
        .prepare(
          "SELECT id, name, slug, status FROM tenants WHERE status = 'ATIVO' ORDER BY name",
        )
        .all<{ id: number; name: string; slug: string; status: "ATIVO" }>(),
      db
        .prepare(
          "SELECT unit.id, unit.name, tenant.id AS tenantId, tenant.name AS tenantName FROM organizational_units unit JOIN tenants tenant ON tenant.id = unit.tenant_id WHERE unit.type = 'CONVENCAO' AND unit.status = 'ATIVO' AND unit.archived_at IS NULL AND tenant.status = 'ATIVO' ORDER BY tenant.name, unit.name",
        )
        .all<{
          id: number;
          name: string;
          tenantId: number;
          tenantName: string;
        }>(),
      db
        .prepare(
          "SELECT id, name FROM organizational_units WHERE tenant_id = ? AND parent_id = ? AND type = 'MATRIZ' AND status = 'ATIVO' AND archived_at IS NULL ORDER BY name",
        )
        .bind(row.session_tenant_id, conventionId)
        .all<{ id: number; name: string }>(),
      db
        .prepare(
          "SELECT branch.id, branch.parent_id AS matrix_id, branch.name FROM organizational_units branch JOIN organizational_units matrix ON matrix.id = branch.parent_id AND matrix.tenant_id = branch.tenant_id WHERE branch.tenant_id = ? AND branch.type = 'FILIAL' AND branch.status = 'ATIVO' AND branch.archived_at IS NULL AND matrix.type = 'MATRIZ' AND matrix.status = 'ATIVO' AND matrix.archived_at IS NULL AND matrix.parent_id = ? ORDER BY branch.name",
        )
        .bind(row.session_tenant_id, conventionId)
        .all<{ id: number; matrix_id: number; name: string }>(),
    ]);
    return {
      tenants: tenants.results,
      conventions: conventions.results,
      fixedMatrixId: null,
      matrices: matrices.results,
      branches: branches.results.map((item) => ({
        id: item.id,
        matrixId: item.matrix_id,
        name: item.name,
      })),
      canChangeConvention: true,
      canChangeMatrix: true,
      canChangeBranch: true,
    };
  }

  const activeTenant = {
    id: row.session_tenant_id!,
    name: row.tenant_name!,
    slug: row.tenant_slug!,
    status: row.tenant_status!,
  };

  if (row.scope === "CONVENCAO" && row.scope_unit_type === "CONVENCAO") {
    const matrices = await db
      .prepare(
        "SELECT id, name FROM organizational_units WHERE tenant_id = ? AND parent_id = ? AND type = 'MATRIZ' AND status = 'ATIVO' AND archived_at IS NULL ORDER BY name",
      )
      .bind(row.session_tenant_id, row.scope_unit_id)
      .all<{ id: number; name: string }>();
    const branches = await db
      .prepare(
        "SELECT branch.id, branch.parent_id AS matrix_id, branch.name FROM organizational_units branch JOIN organizational_units matrix ON matrix.id = branch.parent_id AND matrix.tenant_id = branch.tenant_id WHERE branch.tenant_id = ? AND branch.type = 'FILIAL' AND branch.status = 'ATIVO' AND branch.archived_at IS NULL AND matrix.type = 'MATRIZ' AND matrix.status = 'ATIVO' AND matrix.archived_at IS NULL AND matrix.parent_id = ? ORDER BY branch.name",
      )
      .bind(row.session_tenant_id, row.scope_unit_id)
      .all<{ id: number; matrix_id: number; name: string }>();
    return {
      tenants: [activeTenant],
      conventions: [],
      fixedMatrixId: null,
      matrices: matrices.results,
      branches: branches.results.map((item) => ({
        id: item.id,
        matrixId: item.matrix_id,
        name: item.name,
      })),
      canChangeMatrix: true,
      canChangeBranch: true,
      canChangeConvention: false,
    };
  }

  if (row.scope === "MATRIZ" && row.scope_unit_type === "MATRIZ") {
    const matrix = await db
      .prepare(
        "SELECT id, name FROM organizational_units WHERE tenant_id = ? AND id = ? AND type = 'MATRIZ' AND status = 'ATIVO' AND archived_at IS NULL",
      )
      .bind(row.session_tenant_id, row.scope_unit_id)
      .first<{ id: number; name: string }>();
    const branches = await db
      .prepare(
        "SELECT id, parent_id AS matrix_id, name FROM organizational_units WHERE tenant_id = ? AND parent_id = ? AND type = 'FILIAL' AND status = 'ATIVO' AND archived_at IS NULL ORDER BY name",
      )
      .bind(row.session_tenant_id, row.scope_unit_id)
      .all<{ id: number; matrix_id: number; name: string }>();
    return {
      tenants: [activeTenant],
      conventions: [],
      fixedMatrixId: row.scope_unit_id,
      matrices: matrix ? [matrix] : [],
      branches: branches.results.map((item) => ({
        id: item.id,
        matrixId: item.matrix_id,
        name: item.name,
      })),
      canChangeMatrix: false,
      canChangeBranch: true,
      canChangeConvention: false,
    };
  }

  if (row.scope === "FILIAL" && row.scope_unit_type === "FILIAL") {
    const branch = await db
      .prepare(
        "SELECT branch.id, branch.parent_id AS matrix_id, branch.name, matrix.name AS matrix_name FROM organizational_units branch JOIN organizational_units matrix ON matrix.id = branch.parent_id AND matrix.tenant_id = branch.tenant_id WHERE branch.tenant_id = ? AND branch.id = ? AND branch.type = 'FILIAL' AND branch.status = 'ATIVO' AND branch.archived_at IS NULL AND matrix.type = 'MATRIZ' AND matrix.status = 'ATIVO' AND matrix.archived_at IS NULL",
      )
      .bind(row.session_tenant_id, row.scope_unit_id)
      .first<{
        id: number;
        matrix_id: number;
        name: string;
        matrix_name: string;
      }>();
    return {
      tenants: [activeTenant],
      conventions: [],
      fixedMatrixId: branch?.matrix_id ?? null,
      matrices: branch
        ? [{ id: branch.matrix_id, name: branch.matrix_name }]
        : [],
      branches: branch
        ? [{ id: branch.id, matrixId: branch.matrix_id, name: branch.name }]
        : [],
      canChangeMatrix: false,
      canChangeBranch: false,
      canChangeConvention: false,
    };
  }

  throw new ApiError(
    403,
    "VINCULO_INVALIDO",
    "Seu vínculo organizacional precisa ser revisado.",
  );
}

export async function changeContext(
  request: Request,
  matrixId: number | null,
  branchId: number | null,
  conventionId: number | null = null,
): Promise<SafeSessionPayload> {
  const row = await sessionRow(request);
  if (row.must_change_password) {
    throw new ApiError(
      403,
      "TROCA_SENHA_OBRIGATORIA",
      "Troque a senha temporária antes de alterar a unidade.",
    );
  }
  const targetId = conventionId ?? branchId ?? matrixId;
  const target = await unitPath(targetId);
  const requestShapeIsValid = Boolean(
    target &&
    ((conventionId !== null &&
      matrixId === null &&
      branchId === null &&
      target.type === "CONVENCAO" &&
      target.id === conventionId) ||
      (conventionId === null &&
        branchId === null &&
        target.type === "MATRIZ" &&
        target.id === matrixId) ||
      (conventionId === null &&
        branchId !== null &&
        target.type === "FILIAL" &&
        target.parent_id === matrixId)),
  );

  const allowed =
    target &&
    isOperationalUnitPath(target) &&
    (row.is_platform_owner
      ? true
      : target.tenant_id === row.session_tenant_id &&
        row.tenant_id === row.session_tenant_id &&
        row.scope_unit_id !== null &&
        row.scope_unit_type !== null &&
        conventionId === null &&
        isUnitWithinScope({
          scope: row.scope,
          scopeUnitId: row.scope_unit_id,
          scopeUnitType: row.scope_unit_type,
          target: {
            id: target.id,
            type: target.type,
            status: target.status,
            parentId: target.parent_id,
            parentStatus: target.parent_status,
            grandparentId: target.grandparent_id,
            grandparentStatus: target.grandparent_status,
          },
        }));

  if (!target || !requestShapeIsValid || !allowed) {
    await securityAudit(
      "ACESSO_FORA_ESCOPO",
      "UNIDADE_NAO_AUTORIZADA",
      row.user_id,
      row.session_tenant_id,
      matrixId,
      branchId,
    );
    throw new ApiError(
      403,
      "ACESSO_NEGADO",
      "A unidade informada não está disponível.",
    );
  }

  const targetTenant = await database()
    .prepare("SELECT name, slug, status FROM tenants WHERE id = ? LIMIT 1")
    .bind(target.tenant_id)
    .first<{
      name: string;
      slug: string;
      status: SessionRow["tenant_status"];
    }>();
  if (targetTenant?.status !== "ATIVO") {
    throw new ApiError(
      403,
      "TENANT_INDISPONIVEL",
      "A organização selecionada não está disponível.",
    );
  }
  const now = new Date().toISOString();
  await database()
    .prepare(
      `UPDATE auth_sessions SET tenant_id = ?, selected_unit_id = ?, ${row.is_platform_owner ? "platform_context_active = 1," : ""} last_seen_at = ? WHERE id = ?`,
    )
    .bind(target.tenant_id, target.id, now, row.session_id)
    .run();
  if (row.is_platform_owner && target.tenant_id !== row.session_tenant_id) {
    const metadata = requestMetadata(request);
    const targetConventionId =
      target.type === "CONVENCAO"
        ? target.id
        : target.type === "MATRIZ"
          ? target.parent_id
          : target.grandparent_id;
    await database()
      .prepare(
        "INSERT INTO platform_audit (actor_user_id, tenant_id, action, entity_type, entity_id, convention_id, unit_id, ip_address, user_agent, device_summary, details, created_at) VALUES (?, ?, 'PLATFORM_TENANT_CONTEXT_CHANGED', 'TENANT', ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        row.user_id,
        target.tenant_id,
        target.tenant_id,
        targetConventionId,
        target.id,
        metadata.ipAddress,
        metadata.userAgent,
        metadata.deviceSummary,
        JSON.stringify({ previousTenantId: row.session_tenant_id }),
        now,
      )
      .run();
  }
  await securityAudit(
    "TROCA_CONTEXTO",
    "CONTEXTO_ATUALIZADO",
    row.user_id,
    target.tenant_id,
    matrixId,
    branchId,
  );
  row.selected_unit_id = target.id;
  row.session_tenant_id = target.tenant_id;
  row.tenant_name = targetTenant.name;
  row.tenant_slug = targetTenant.slug;
  row.tenant_status = targetTenant.status;
  return safePayload(row);
}

export async function logout(request: Request): Promise<void> {
  try {
    const row = await sessionRow(request);
    await database()
      .prepare("DELETE FROM auth_sessions WHERE id = ?")
      .bind(row.session_id)
      .run();
    await securityAudit(
      "LOGOUT",
      "ENCERRADO_PELO_USUARIO",
      row.user_id,
      row.session_tenant_id,
    );
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }
}

export async function changePassword(
  request: Request,
  currentPassword: string,
  newPassword: string,
): Promise<{ payload: SafeSessionPayload; cookie: string }> {
  const row = await sessionRow(request);
  if (!(await bcrypt.compare(currentPassword, row.password_hash))) {
    throw new ApiError(
      400,
      "SENHA_ATUAL_INVALIDA",
      "A senha atual está incorreta.",
    );
  }
  if (!isPasswordValid(newPassword)) {
    throw new ApiError(400, "NOVA_SENHA_CURTA", PASSWORD_POLICY_MESSAGE);
  }
  if (await bcrypt.compare(newPassword, row.password_hash)) {
    throw new ApiError(
      400,
      "SENHA_REPETIDA",
      "A nova senha deve ser diferente da atual.",
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const token = randomToken();
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + SESSION_HOURS * 3600_000,
  ).toISOString();
  await database().batch([
    database()
      .prepare(
        "UPDATE auth_users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?",
      )
      .bind(passwordHash, now, row.user_id),
    database()
      .prepare("DELETE FROM auth_sessions WHERE user_id = ? AND id <> ?")
      .bind(row.user_id, row.session_id),
    database()
      .prepare(
        "UPDATE auth_sessions SET token_hash = ?, expires_at = ?, last_seen_at = ? WHERE id = ?",
      )
      .bind(tokenHash, expiresAt, now, row.session_id),
    database()
      .prepare(
        "INSERT INTO audit_logs (user_id, tenant_id, event, reason, created_at) VALUES (?, ?, 'TROCA_SENHA', 'ALTERADA_PELO_USUARIO', ?)",
      )
      .bind(row.user_id, row.session_tenant_id, now),
  ]);
  const refreshed = await database()
    .prepare(SESSION_QUERY)
    .bind(tokenHash)
    .first<SessionRow>();
  if (!refreshed)
    throw new ApiError(
      500,
      "ERRO_INTERNO",
      "Não foi possível renovar a sessão.",
    );
  return {
    payload: await safePayload(refreshed),
    cookie: sessionCookie(request, token),
  };
}

export async function verifyUserPassword(
  userId: number,
  password: string,
): Promise<void> {
  const row = await database()
    .prepare("SELECT password_hash FROM auth_users WHERE id = ? LIMIT 1")
    .bind(userId)
    .first<{ password_hash: string }>();
  if (
    !row ||
    !(await bcrypt.compare(password || "\u0000", row.password_hash))
  ) {
    throw new ApiError(
      403,
      "SENHA_INVALIDA",
      "A senha informada está incorreta.",
    );
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.publicMessage } },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const classified = classifyUnexpectedError(error);
  console.error("[NexIgreja API]", error);
  return Response.json(
    { error: { code: classified.code, message: classified.message } },
    { status: classified.status, headers: { "Cache-Control": "no-store" } },
  );
}
