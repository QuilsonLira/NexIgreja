import {
  blob,
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const matrices = sqliteTable("matrices", {
  id: integer("id").primaryKey(),
  conventionId: integer("convention_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("ATIVO"),
});

export const branches = sqliteTable("branches", {
  id: integer("id").primaryKey(),
  matrixId: integer("matrix_id")
    .notNull()
    .references(() => matrices.id),
  name: text("name").notNull(),
  status: text("status").notNull().default("ATIVO"),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  conventionId: integer("convention_id").notNull(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  cpf: text("cpf").notNull().unique(),
  passwordSalt: text("password_salt").notNull(),
  passwordHash: text("password_hash").notNull(),
  roleName: text("role_name").notNull(),
  scope: text("scope").notNull(),
  boundMatrixId: integer("bound_matrix_id"),
  boundBranchId: integer("bound_branch_id"),
  status: text("status").notNull().default("ATIVO"),
  mustChangePassword: integer("must_change_password", { mode: "boolean" })
    .notNull()
    .default(false),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  blockedUntil: text("blocked_until"),
  lastLoginAt: text("last_login_at"),
  lastIdentifierType: text("last_identifier_type"),
  lastOriginSummary: text("last_origin_summary"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  activeMatrixId: integer("active_matrix_id"),
  activeBranchId: integer("active_branch_id"),
  previousLoginAt: text("previous_login_at"),
  previousIdentifierType: text("previous_identifier_type"),
  previousOriginSummary: text("previous_origin_summary"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),
  tenantId: integer("tenant_id"),
  event: text("event").notNull(),
  identifierType: text("identifier_type"),
  reason: text("reason").notNull(),
  matrixId: integer("matrix_id"),
  branchId: integer("branch_id"),
  createdAt: text("created_at").notNull(),
});

export const tenants = sqliteTable("tenants", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  accessCode: text("access_code").notNull().unique(),
  status: text("status").notNull().default("ATIVO"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Auth foundation v2. The legacy tables above are intentionally retained so
// existing Site databases can receive this migration without destructive
// renames or data loss.
export const organizationalUnits = sqliteTable(
  "organizational_units",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    type: text("type").notNull(),
    name: text("name").notNull(),
    fantasyName: text("fantasy_name"),
    legalName: text("legal_name"),
    cnpj: text("cnpj"),
    usesParentCnpj: integer("uses_parent_cnpj", { mode: "boolean" })
      .notNull()
      .default(false),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    postalCode: text("postal_code"),
    street: text("street"),
    number: text("number"),
    complement: text("complement"),
    district: text("district"),
    city: text("city"),
    state: text("state"),
    responsibleName: text("responsible_name"),
    foundationDate: text("foundation_date"),
    notes: text("notes"),
    code: text("code").notNull().unique(),
    parentId: integer("parent_id").references(
      (): AnySQLiteColumn => organizationalUnits.id,
    ),
    status: text("status").notNull().default("ATIVO"),
    archivedAt: text("archived_at"),
    archivedBy: integer("archived_by"),
    archivedPreviousStatus: text("archived_previous_status"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("organizational_units_tenant_own_cnpj_unique")
      .on(table.tenantId, table.cnpj)
      .where(sql`${table.cnpj} IS NOT NULL AND ${table.usesParentCnpj} = 0`),
    uniqueIndex("organizational_units_id_tenant_unique").on(
      table.id,
      table.tenantId,
    ),
    uniqueIndex("organizational_units_hierarchy_scope_unique").on(
      table.id,
      table.parentId,
      table.tenantId,
    ),
  ],
);

export const organizationalFunctions = sqliteTable(
  "organizational_functions",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("ATIVO"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("organizational_functions_tenant_name_unique").on(
      table.tenantId,
      table.normalizedName,
    ),
    uniqueIndex("organizational_functions_id_tenant_unique").on(
      table.id,
      table.tenantId,
    ),
  ],
);

export const authUsers = sqliteTable(
  "auth_users",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").references(() => tenants.id),
    name: text("name").notNull(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    cpf: text("cpf").notNull(),
    passwordHash: text("password_hash").notNull(),
    roleName: text("role_name").notNull(),
    scope: text("scope").notNull(),
    status: text("status").notNull().default("ATIVO"),
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(false),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    blockedUntil: text("blocked_until"),
    archivedAt: text("archived_at"),
    archivedBy: integer("archived_by"),
    archivedPreviousStatus: text("archived_previous_status"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("auth_users_tenant_username_unique")
      .on(table.tenantId, table.username)
      .where(sql`${table.tenantId} IS NOT NULL`),
    uniqueIndex("auth_users_tenant_email_unique")
      .on(table.tenantId, table.email)
      .where(sql`${table.tenantId} IS NOT NULL`),
    uniqueIndex("auth_users_tenant_cpf_unique")
      .on(table.tenantId, table.cpf)
      .where(sql`${table.tenantId} IS NOT NULL`),
    uniqueIndex("auth_users_platform_username_unique")
      .on(table.username)
      .where(sql`${table.tenantId} IS NULL`),
    uniqueIndex("auth_users_platform_email_unique")
      .on(table.email)
      .where(sql`${table.tenantId} IS NULL`),
    uniqueIndex("auth_users_platform_cpf_unique")
      .on(table.cpf)
      .where(sql`${table.tenantId} IS NULL`),
  ],
);

export const userUnitLinks = sqliteTable(
  "user_unit_links",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => authUsers.id),
    unitId: integer("unit_id")
      .notNull()
      .references(() => organizationalUnits.id),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.unitId] })],
);

// Organizational identities and credentials are tenant-owned. The nullable
// tenant is reserved exclusively for the singleton Platform Owner identity.
export const tenantMemberships = sqliteTable(
  "tenant_memberships",
  {
    id: integer("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => authUsers.id),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    displayName: text("display_name").notNull(),
    roleName: text("role_name").notNull(),
    functionId: integer("function_id").references(
      () => organizationalFunctions.id,
    ),
    scope: text("scope").notNull(),
    scopeUnitId: integer("scope_unit_id")
      .notNull()
      .references(() => organizationalUnits.id),
    status: text("status").notNull().default("ATIVO"),
    invitedByMembershipId: integer("invited_by_membership_id"),
    acceptedAt: text("accepted_at"),
    archivedAt: text("archived_at"),
    archivedByMembershipId: integer("archived_by_membership_id"),
    archivedPreviousStatus: text("archived_previous_status"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("tenant_memberships_user_tenant_unique").on(
      table.userId,
      table.tenantId,
    ),
  ],
);

export const membershipPermissions = sqliteTable(
  "membership_permissions",
  {
    membershipId: integer("membership_id")
      .notNull()
      .references(() => tenantMemberships.id),
    permission: text("permission").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.membershipId, table.permission] })],
);

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => authUsers.id),
  tenantId: integer("tenant_id").references(() => tenants.id),
  membershipId: integer("membership_id").references(() => tenantMemberships.id),
  organizationSelectionRequired: integer("organization_selection_required", {
    mode: "boolean",
  })
    .notNull()
    .default(false),
  platformContextActive: integer("platform_context_active", { mode: "boolean" })
    .notNull()
    .default(false),
  selectedUnitId: integer("selected_unit_id").references(
    () => organizationalUnits.id,
  ),
  previousLoginAt: text("previous_login_at"),
  previousIdentifierType: text("previous_identifier_type"),
  previousDeviceSummary: text("previous_device_summary"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
});

export const tenantAccessContexts = sqliteTable("tenant_access_contexts", {
  tokenHash: text("token_hash").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at").notNull(),
});

export const institutionLookupAttempts = sqliteTable(
  "institution_lookup_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    codeFingerprint: text("code_fingerprint").notNull(),
    success: integer("success", { mode: "boolean" }).notNull(),
    ipAddress: text("ip_address"),
    createdAt: text("created_at").notNull(),
  },
);

export const loginHistory = sqliteTable("login_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => authUsers.id),
  tenantId: integer("tenant_id").references(() => tenants.id),
  identifierType: text("identifier_type").notNull(),
  identifierFingerprint: text("identifier_fingerprint").notNull(),
  success: integer("success", { mode: "boolean" }).notNull(),
  failureReason: text("failure_reason"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceSummary: text("device_summary"),
  createdAt: text("created_at").notNull(),
});

export const userPermissions = sqliteTable(
  "user_permissions",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => authUsers.id),
    permission: text("permission").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.permission] })],
);

export const administrationAudit = sqliteTable("administration_audit", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorUserId: integer("actor_user_id")
    .notNull()
    .references(() => authUsers.id),
  actorMembershipId: integer("actor_membership_id").references(
    () => tenantMemberships.id,
  ),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id),
  conventionId: integer("convention_id")
    .notNull()
    .references(() => organizationalUnits.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  unitId: integer("unit_id").references(() => organizationalUnits.id),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceSummary: text("device_summary"),
  details: text("details"),
  createdAt: text("created_at").notNull(),
});

export const unitLogos = sqliteTable("unit_logos", {
  unitId: integer("unit_id")
    .primaryKey()
    .references(() => organizationalUnits.id),
  imageData: blob("image_data", { mode: "buffer" }).notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const userProfilePhotos = sqliteTable("user_profile_photos", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => authUsers.id),
  imageData: blob("image_data", { mode: "buffer" }).notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Platform ownership is deliberately isolated from user_permissions. The
// singleton constraint prevents a normal administrative flow from delegating
// or multiplying this platform-level authority.
export const platformOwners = sqliteTable(
  "platform_owners",
  {
    singletonId: integer("singleton_id").primaryKey().default(1),
    userId: integer("user_id")
      .notNull()
      .references(() => authUsers.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check("platform_owners_singleton_check", sql`${table.singletonId} = 1`),
    uniqueIndex("platform_owners_user_unique").on(table.userId),
  ],
);

// Unit references intentionally have no foreign keys so the audit trail
// survives the exceptional physical deletion of an empty/test unit.
export const platformAudit = sqliteTable("platform_audit", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorUserId: integer("actor_user_id")
    .notNull()
    .references(() => authUsers.id),
  tenantId: integer("tenant_id").references(() => tenants.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  conventionId: integer("convention_id"),
  unitId: integer("unit_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceSummary: text("device_summary"),
  details: text("details"),
  createdAt: text("created_at").notNull(),
});

// Commercial SaaS domain. These tables are deliberately separate from every
// future church cash-flow, tithe, offering, income or expense table.
export const commercialProfiles = sqliteTable("commercial_profiles", {
  tenantId: integer("tenant_id")
    .primaryKey()
    .references(() => tenants.id),
  personType: text("person_type").notNull(),
  legalName: text("legal_name").notNull(),
  document: text("document"),
  responsibleName: text("responsible_name"),
  phone: text("phone"),
  billingEmail: text("billing_email"),
  notes: text("notes"),
  customerSince: text("customer_since").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const saasPlans = sqliteTable(
  "saas_plans",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    billingPeriod: text("billing_period").notNull(),
    defaultGraceDays: integer("default_grace_days").notNull().default(5),
    defaultTrialDays: integer("default_trial_days").notNull().default(15),
    status: text("status").notNull().default("ATIVO"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("saas_plans_name_unique").on(table.name)],
);

export const billingSettings = sqliteTable("billing_settings", {
  singletonId: integer("singleton_id").primaryKey().default(1),
  warningDays: integer("warning_days").notNull().default(7),
  pixKey: text("pix_key"),
  pixKeyType: text("pix_key_type"),
  payeeName: text("payee_name"),
  bankName: text("bank_name"),
  bankAgency: text("bank_agency"),
  bankAccount: text("bank_account"),
  instructions: text("instructions"),
  supportContact: text("support_contact"),
  updatedAt: text("updated_at").notNull(),
});

export const tenantSubscriptions = sqliteTable("tenant_subscriptions", {
  id: integer("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .unique()
    .references(() => tenants.id),
  planId: integer("plan_id").references(() => saasPlans.id),
  contractedPriceCents: integer("contracted_price_cents").notNull().default(0),
  customPriceCents: integer("custom_price_cents"),
  billingPeriod: text("billing_period").notNull(),
  status: text("status").notNull(),
  startDate: text("start_date").notNull(),
  nextDueDate: text("next_due_date"),
  dueDay: integer("due_day"),
  graceDays: integer("grace_days").notNull().default(5),
  trialStartDate: text("trial_start_date"),
  trialEndDate: text("trial_end_date"),
  accessUntil: text("access_until"),
  autoRenew: integer("auto_renew", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  suspendedReason: text("suspended_reason"),
  paymentProvider: text("payment_provider").notNull().default("MANUAL"),
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"),
  externalReference: text("external_reference"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const saasCharges = sqliteTable(
  "saas_charges",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => tenantSubscriptions.id),
    competence: text("competence").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    issuedDate: text("issued_date").notNull(),
    dueDate: text("due_date").notNull(),
    status: text("status").notNull().default("PENDENTE"),
    paidAt: text("paid_at"),
    paymentMethod: text("payment_method"),
    notes: text("notes"),
    paymentProvider: text("payment_provider").notNull().default("MANUAL"),
    providerChargeId: text("provider_charge_id"),
    externalReference: text("external_reference"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("saas_charges_subscription_due_unique").on(
      table.subscriptionId,
      table.dueDate,
    ),
  ],
);

export const saasPayments = sqliteTable("saas_payments", {
  id: integer("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id),
  subscriptionId: integer("subscription_id")
    .notNull()
    .references(() => tenantSubscriptions.id),
  chargeId: integer("charge_id")
    .notNull()
    .unique()
    .references(() => saasCharges.id),
  amountCents: integer("amount_cents").notNull(),
  paidDate: text("paid_date").notNull(),
  paymentMethod: text("payment_method").notNull(),
  notes: text("notes"),
  paymentProvider: text("payment_provider").notNull().default("MANUAL"),
  providerPaymentId: text("provider_payment_id"),
  externalReference: text("external_reference").unique(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => authUsers.id),
  createdAt: text("created_at").notNull(),
});

export const commercialAudit = sqliteTable("commercial_audit", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorUserId: integer("actor_user_id")
    .notNull()
    .references(() => authUsers.id),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  previousValues: text("previous_values"),
  newValues: text("new_values"),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
});

// Church people are intentionally independent from authentication identities.
export const memberSequences = sqliteTable("member_sequences", {
  tenantId: integer("tenant_id")
    .primaryKey()
    .references(() => tenants.id),
  lastNumber: integer("last_number").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const people = sqliteTable(
  "people",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    memberNumber: integer("member_number").notNull(),
    fullName: text("full_name").notNull(),
    status: text("status").notNull().default("MEMBRO_ATIVO"),
    birthDate: text("birth_date"),
    sex: text("sex"),
    cpf: text("cpf"),
    rg: text("rg"),
    voterTitle: text("voter_title"),
    birthCity: text("birth_city"),
    birthState: text("birth_state"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    motherName: text("mother_name"),
    fatherName: text("father_name"),
    maritalStatus: text("marital_status"),
    spouseName: text("spouse_name"),
    spousePersonId: integer("spouse_person_id"),
    childrenCount: integer("children_count").notNull().default(0),
    postalCode: text("postal_code"),
    street: text("street"),
    addressNumber: text("address_number"),
    complement: text("complement"),
    district: text("district"),
    city: text("city"),
    state: text("state"),
    profession: text("profession"),
    workplace: text("workplace"),
    educationLevel: text("education_level"),
    theologicalEducation: text("theological_education"),
    primaryFunctionId: integer("primary_function_id"),
    matrixId: integer("matrix_id").notNull(),
    branchId: integer("branch_id"),
    churchEntryDate: text("church_entry_date"),
    originChurch: text("origin_church"),
    conversionDate: text("conversion_date"),
    baptismDate: text("baptism_date"),
    consecrationDate: text("consecration_date"),
    notes: text("notes"),
    linkedAuthUserId: integer("linked_auth_user_id").references(
      () => authUsers.id,
    ),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => authUsers.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("people_tenant_member_number_unique").on(
      table.tenantId,
      table.memberNumber,
    ),
    uniqueIndex("people_tenant_cpf_unique")
      .on(table.tenantId, table.cpf)
      .where(sql`${table.cpf} IS NOT NULL`),
    index("people_tenant_voter_title_idx").on(table.tenantId, table.voterTitle),
    uniqueIndex("people_id_tenant_unique").on(table.id, table.tenantId),
    foreignKey({
      columns: [table.spousePersonId, table.tenantId],
      foreignColumns: [table.id, table.tenantId],
      name: "people_spouse_tenant_fk",
    }),
    foreignKey({
      columns: [table.primaryFunctionId, table.tenantId],
      foreignColumns: [
        organizationalFunctions.id,
        organizationalFunctions.tenantId,
      ],
      name: "people_function_tenant_fk",
    }),
    foreignKey({
      columns: [table.matrixId, table.tenantId],
      foreignColumns: [organizationalUnits.id, organizationalUnits.tenantId],
      name: "people_matrix_tenant_fk",
    }),
    foreignKey({
      columns: [table.branchId, table.matrixId, table.tenantId],
      foreignColumns: [
        organizationalUnits.id,
        organizationalUnits.parentId,
        organizationalUnits.tenantId,
      ],
      name: "people_branch_matrix_tenant_fk",
    }),
  ],
);

export const personFunctions = sqliteTable(
  "person_functions",
  {
    personId: integer("person_id").notNull(),
    tenantId: integer("tenant_id").notNull(),
    functionId: integer("function_id").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    startedAt: text("started_at"),
    endedAt: text("ended_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.personId, table.functionId] }),
    foreignKey({
      columns: [table.personId, table.tenantId],
      foreignColumns: [people.id, people.tenantId],
      name: "person_functions_person_tenant_fk",
    }),
    foreignKey({
      columns: [table.functionId, table.tenantId],
      foreignColumns: [
        organizationalFunctions.id,
        organizationalFunctions.tenantId,
      ],
      name: "person_functions_function_tenant_fk",
    }),
  ],
);

export const personHistory = sqliteTable(
  "person_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    personId: integer("person_id").notNull(),
    eventType: text("event_type").notNull(),
    description: text("description").notNull(),
    eventDate: text("event_date"),
    previousValues: text("previous_values"),
    newValues: text("new_values"),
    actorUserId: integer("actor_user_id")
      .notNull()
      .references(() => authUsers.id),
    actorMembershipId: integer("actor_membership_id").references(
      () => tenantMemberships.id,
    ),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.personId, table.tenantId],
      foreignColumns: [people.id, people.tenantId],
      name: "person_history_person_tenant_fk",
    }),
  ],
);

export const personRelationships = sqliteTable(
  "person_relationships",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    personId: integer("person_id").notNull(),
    relatedPersonId: integer("related_person_id").notNull(),
    relationshipType: text("relationship_type").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("person_relationships_unique").on(
      table.personId,
      table.relatedPersonId,
      table.relationshipType,
    ),
    foreignKey({
      columns: [table.personId, table.tenantId],
      foreignColumns: [people.id, people.tenantId],
      name: "person_relationships_person_tenant_fk",
    }),
    foreignKey({
      columns: [table.relatedPersonId, table.tenantId],
      foreignColumns: [people.id, people.tenantId],
      name: "person_relationships_related_tenant_fk",
    }),
  ],
);

export const memberPhotos = sqliteTable(
  "member_photos",
  {
    personId: integer("person_id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    imageData: blob("image_data", { mode: "buffer" }).notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.personId, table.tenantId],
      foreignColumns: [people.id, people.tenantId],
      name: "member_photos_person_tenant_fk",
    }),
  ],
);

export const memberCustomFields = sqliteTable(
  "member_custom_fields",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    fieldType: text("field_type").notNull(),
    helpText: text("help_text"),
    required: integer("required", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("ATIVO"),
    displayOrder: integer("display_order").notNull().default(0),
    sectionName: text("section_name")
      .notNull()
      .default("Informações adicionais"),
    showAdmin: integer("show_admin", { mode: "boolean" })
      .notNull()
      .default(true),
    showPublic: integer("show_public", { mode: "boolean" })
      .notNull()
      .default(false),
    showPrint: integer("show_print", { mode: "boolean" })
      .notNull()
      .default(false),
    optionsJson: text("options_json"),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => authUsers.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("member_custom_fields_tenant_name_unique").on(
      table.tenantId,
      table.normalizedName,
    ),
    uniqueIndex("member_custom_fields_id_tenant_unique").on(
      table.id,
      table.tenantId,
    ),
    index("member_custom_fields_tenant_status_order_idx").on(
      table.tenantId,
      table.status,
      table.displayOrder,
    ),
  ],
);

export const memberCustomValues = sqliteTable(
  "member_custom_values",
  {
    personId: integer("person_id").notNull(),
    tenantId: integer("tenant_id").notNull(),
    fieldId: integer("field_id").notNull(),
    valueText: text("value_text").notNull(),
    updatedByUserId: integer("updated_by_user_id")
      .notNull()
      .references(() => authUsers.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.personId, table.fieldId] }),
    foreignKey({
      columns: [table.personId, table.tenantId],
      foreignColumns: [people.id, people.tenantId],
      name: "member_custom_values_person_tenant_fk",
    }),
    foreignKey({
      columns: [table.fieldId, table.tenantId],
      foreignColumns: [memberCustomFields.id, memberCustomFields.tenantId],
      name: "member_custom_values_field_tenant_fk",
    }),
  ],
);

export const memberPreRegistrationForms = sqliteTable(
  "member_pre_registration_forms",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    tokenPrefix: text("token_prefix").notNull(),
    unitId: integer("unit_id"),
    status: text("status").notNull().default("ATIVO"),
    expiresAt: text("expires_at"),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => authUsers.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("member_pre_registration_forms_id_tenant_unique").on(
      table.id,
      table.tenantId,
    ),
    index("member_pre_registration_forms_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.unitId, table.tenantId],
      foreignColumns: [organizationalUnits.id, organizationalUnits.tenantId],
      name: "pre_registration_forms_unit_tenant_fk",
    }),
  ],
);

export const memberPreRegistrations = sqliteTable(
  "member_pre_registrations",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    formId: integer("form_id").notNull(),
    fullName: text("full_name").notNull(),
    birthDate: text("birth_date"),
    cpf: text("cpf"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    voterTitle: text("voter_title"),
    matrixId: integer("matrix_id"),
    branchId: integer("branch_id"),
    status: text("status").notNull().default("PENDENTE"),
    payloadJson: text("payload_json").notNull(),
    consentAt: text("consent_at").notNull(),
    consentVersion: text("consent_version").notNull(),
    sourceHash: text("source_hash").notNull(),
    reviewReason: text("review_reason"),
    reviewedByUserId: integer("reviewed_by_user_id").references(
      () => authUsers.id,
    ),
    reviewedAt: text("reviewed_at"),
    approvedMemberId: integer("approved_member_id"),
    correctionTokenHash: text("correction_token_hash"),
    correctionExpiresAt: text("correction_expires_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("member_pre_registrations_id_tenant_unique").on(
      table.id,
      table.tenantId,
    ),
    index("member_pre_registrations_tenant_status_created_idx").on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
    index("member_pre_registrations_tenant_cpf_idx").on(
      table.tenantId,
      table.cpf,
    ),
    foreignKey({
      columns: [table.formId, table.tenantId],
      foreignColumns: [
        memberPreRegistrationForms.id,
        memberPreRegistrationForms.tenantId,
      ],
      name: "pre_registrations_form_tenant_fk",
    }),
    foreignKey({
      columns: [table.matrixId, table.tenantId],
      foreignColumns: [organizationalUnits.id, organizationalUnits.tenantId],
      name: "pre_registrations_matrix_tenant_fk",
    }),
    foreignKey({
      columns: [table.branchId, table.matrixId, table.tenantId],
      foreignColumns: [
        organizationalUnits.id,
        organizationalUnits.parentId,
        organizationalUnits.tenantId,
      ],
      name: "pre_registrations_branch_matrix_tenant_fk",
    }),
    foreignKey({
      columns: [table.approvedMemberId, table.tenantId],
      foreignColumns: [people.id, people.tenantId],
      name: "pre_registrations_member_tenant_fk",
    }),
  ],
);

export const memberPreRegistrationPhotos = sqliteTable(
  "member_pre_registration_photos",
  {
    preRegistrationId: integer("pre_registration_id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    imageData: blob("image_data", { mode: "buffer" }).notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.preRegistrationId, table.tenantId],
      foreignColumns: [
        memberPreRegistrations.id,
        memberPreRegistrations.tenantId,
      ],
      name: "pre_registration_photos_request_tenant_fk",
    }),
  ],
);

export const memberPreRegistrationCustomValues = sqliteTable(
  "member_pre_registration_custom_values",
  {
    preRegistrationId: integer("pre_registration_id").notNull(),
    tenantId: integer("tenant_id").notNull(),
    fieldId: integer("field_id").notNull(),
    valueText: text("value_text").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.preRegistrationId, table.fieldId] }),
    foreignKey({
      columns: [table.preRegistrationId, table.tenantId],
      foreignColumns: [
        memberPreRegistrations.id,
        memberPreRegistrations.tenantId,
      ],
      name: "pre_registration_values_request_tenant_fk",
    }),
    foreignKey({
      columns: [table.fieldId, table.tenantId],
      foreignColumns: [memberCustomFields.id, memberCustomFields.tenantId],
      name: "pre_registration_values_field_tenant_fk",
    }),
  ],
);

export const memberPreRegistrationRateLimits = sqliteTable(
  "member_pre_registration_rate_limits",
  {
    rateKey: text("rate_key").primaryKey(),
    attempts: integer("attempts").notNull().default(0),
    windowStartedAt: text("window_started_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
);

export const helpArticles = sqliteTable(
  "help_articles",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").references(() => tenants.id),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    content: text("content").notNull(),
    category: text("category").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    targetProfiles: text("target_profiles").notNull().default('["TODOS"]'),
    requiredPermission: text("required_permission"),
    relatedRoute: text("related_route"),
    published: integer("published", { mode: "boolean" })
      .notNull()
      .default(true),
    isNewFeature: integer("is_new_feature", { mode: "boolean" })
      .notNull()
      .default(false),
    releasedAt: text("released_at"),
    version: text("version").notNull().default("1.0"),
    createdByUserId: integer("created_by_user_id").references(
      () => authUsers.id,
    ),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("help_articles_visibility_idx").on(
      table.published,
      table.category,
      table.displayOrder,
      table.releasedAt,
    ),
  ],
);

export const helpArticleReads = sqliteTable(
  "help_article_reads",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => authUsers.id),
    articleId: integer("article_id")
      .notNull()
      .references(() => helpArticles.id),
    viewedAt: text("viewed_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.articleId] })],
);

export const dataExportAudit = sqliteTable(
  "data_export_audit",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorUserId: integer("actor_user_id")
      .notNull()
      .references(() => authUsers.id),
    actorMembershipId: integer("actor_membership_id").references(
      () => tenantMemberships.id,
    ),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    exportType: text("export_type").notNull(),
    modules: text("modules").notNull(),
    format: text("format").notNull(),
    recordCount: integer("record_count").notNull().default(0),
    scopeUnitId: integer("scope_unit_id").references(
      () => organizationalUnits.id,
    ),
    status: text("status").notNull(),
    details: text("details"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("data_export_audit_tenant_created_idx").on(
      table.tenantId,
      table.createdAt,
    ),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").references(() => tenants.id),
    audience: text("audience").notNull().default("ORGANIZATIONAL"),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    priority: text("priority").notNull().default("INFO"),
    internalRoute: text("internal_route"),
    sourceEntity: text("source_entity"),
    sourceEntityId: integer("source_entity_id"),
    unitId: integer("unit_id").references(() => organizationalUnits.id),
    groupKey: text("group_key"),
    metadataJson: text("metadata_json"),
    mandatory: integer("mandatory", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("notifications_tenant_type_created_idx").on(
      table.tenantId,
      table.type,
      table.createdAt,
    ),
    index("notifications_group_key_idx").on(table.groupKey, table.createdAt),
  ],
);

export const notificationRecipients = sqliteTable(
  "notification_recipients",
  {
    notificationId: integer("notification_id")
      .notNull()
      .references(() => notifications.id),
    userId: integer("user_id")
      .notNull()
      .references(() => authUsers.id),
    readAt: text("read_at"),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.notificationId, table.userId] }),
    index("notification_recipients_user_unread_idx").on(
      table.userId,
      table.readAt,
      table.notificationId,
    ),
    index("notification_recipients_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const departments = sqliteTable(
  "departments",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    acronym: text("acronym"),
    description: text("description"),
    type: text("type").notNull(),
    unitId: integer("unit_id")
      .notNull()
      .references(() => organizationalUnits.id),
    conventionId: integer("convention_id")
      .notNull()
      .references(() => organizationalUnits.id),
    matrixId: integer("matrix_id").references(() => organizationalUnits.id),
    branchId: integer("branch_id").references(() => organizationalUnits.id),
    status: text("status").notNull().default("ATIVO"),
    enabledFeatures: text("enabled_features").notNull(),
    absenceAlertThreshold: integer("absence_alert_threshold")
      .notNull()
      .default(3),
    version: integer("version").notNull().default(1),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => authUsers.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("departments_id_tenant_unique").on(table.id, table.tenantId),
    uniqueIndex("departments_tenant_unit_name_unique").on(
      table.tenantId,
      table.unitId,
      table.name,
    ),
    index("departments_tenant_scope_status_idx").on(
      table.tenantId,
      table.conventionId,
      table.matrixId,
      table.branchId,
      table.status,
    ),
  ],
);
export const departmentRoles = sqliteTable(
  "department_roles",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id),
    name: text("name").notNull(),
    isLeadership: integer("is_leadership", { mode: "boolean" })
      .notNull()
      .default(false),
    displayOrder: integer("display_order").notNull().default(0),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("department_roles_tenant_department_name_unique").on(
      table.tenantId,
      table.departmentId,
      table.name,
    ),
  ],
);
export const departmentParticipants = sqliteTable(
  "department_participants",
  {
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id),
    tenantId: integer("tenant_id").notNull(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    roleId: integer("role_id").references(() => departmentRoles.id),
    joinedAt: text("joined_at").notNull(),
    status: text("status").notNull(),
    leftAt: text("left_at"),
    exitReason: text("exit_reason"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.departmentId, table.personId] }),
    index("department_participants_tenant_person_idx").on(
      table.tenantId,
      table.personId,
      table.status,
    ),
  ],
);
export const departmentAccess = sqliteTable(
  "department_access",
  {
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id),
    tenantId: integer("tenant_id").notNull(),
    membershipId: integer("membership_id")
      .notNull()
      .references(() => tenantMemberships.id),
    roleId: integer("role_id").references(() => departmentRoles.id),
    permissionsJson: text("permissions_json").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.departmentId, table.membershipId] }),
    index("department_access_membership_idx").on(
      table.tenantId,
      table.membershipId,
      table.status,
    ),
  ],
);
export const departmentEvents = sqliteTable(
  "department_events",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id),
    title: text("title").notNull(),
    description: text("description"),
    eventDate: text("event_date").notNull(),
    startTime: text("start_time"),
    location: text("location"),
    responsiblePersonId: integer("responsible_person_id").references(
      () => people.id,
    ),
    notes: text("notes"),
    status: text("status").notNull(),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => authUsers.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("department_events_department_date_idx").on(
      table.tenantId,
      table.departmentId,
      table.eventDate,
      table.status,
    ),
  ],
);
export const departmentActivities = sqliteTable("department_activities", {
  id: integer("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  departmentId: integer("department_id")
    .notNull()
    .references(() => departments.id),
  activityDate: text("activity_date").notNull(),
  title: text("title").notNull(),
  notes: text("notes"),
  status: text("status").notNull(),
  version: integer("version").notNull(),
  finalizedByUserId: integer("finalized_by_user_id").references(
    () => authUsers.id,
  ),
  finalizedAt: text("finalized_at"),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => authUsers.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const departmentAttendance = sqliteTable(
  "department_attendance",
  {
    activityId: integer("activity_id")
      .notNull()
      .references(() => departmentActivities.id),
    tenantId: integer("tenant_id").notNull(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    attendanceStatus: text("attendance_status").notNull(),
    notes: text("notes"),
    updatedByUserId: integer("updated_by_user_id")
      .notNull()
      .references(() => authUsers.id),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.activityId, table.personId] }),
    index("department_attendance_person_idx").on(
      table.tenantId,
      table.personId,
      table.attendanceStatus,
    ),
  ],
);
export const departmentCommunications = sqliteTable(
  "department_communications",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id),
    message: text("message").notNull(),
    audience: text("audience").notNull(),
    channel: text("channel").notNull(),
    recipientCount: integer("recipient_count").notNull(),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => authUsers.id),
    createdAt: text("created_at").notNull(),
  },
);
export const ebdClasses = sqliteTable(
  "ebd_classes",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id),
    name: text("name").notNull(),
    description: text("description"),
    ageRange: text("age_range"),
    room: text("room"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("ebd_classes_id_tenant_unique").on(table.id, table.tenantId),
    uniqueIndex("ebd_classes_tenant_department_name_unique").on(
      table.tenantId,
      table.departmentId,
      table.name,
    ),
  ],
);
export const ebdClassTeachers = sqliteTable(
  "ebd_class_teachers",
  {
    classId: integer("class_id")
      .notNull()
      .references(() => ebdClasses.id),
    tenantId: integer("tenant_id").notNull(),
    membershipId: integer("membership_id")
      .notNull()
      .references(() => tenantMemberships.id),
    personId: integer("person_id").references(() => people.id),
    teacherRole: text("teacher_role").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.classId, table.membershipId] }),
    index("ebd_class_teachers_membership_idx").on(
      table.tenantId,
      table.membershipId,
      table.status,
    ),
  ],
);
export const ebdEnrollments = sqliteTable(
  "ebd_enrollments",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id),
    classId: integer("class_id")
      .notNull()
      .references(() => ebdClasses.id),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    enrolledAt: text("enrolled_at").notNull(),
    status: text("status").notNull(),
    leftAt: text("left_at"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("ebd_enrollments_class_status_idx").on(
      table.tenantId,
      table.classId,
      table.status,
      table.personId,
    ),
  ],
);
export const ebdStudents = sqliteTable(
  "ebd_students",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id),
    personId: integer("person_id").references(() => people.id),
    fullName: text("full_name").notNull(),
    birthDate: text("birth_date"),
    sex: text("sex"),
    cpf: text("cpf"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    guardianName: text("guardian_name"),
    guardianPhone: text("guardian_phone"),
    notes: text("notes"),
    status: text("status").notNull(),
    createdByUserId: integer("created_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("ebd_students_department_name_idx").on(
      table.tenantId,
      table.departmentId,
      table.status,
      table.fullName,
    ),
  ],
);
export const ebdStudentEnrollments = sqliteTable(
  "ebd_student_enrollments",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id),
    classId: integer("class_id")
      .notNull()
      .references(() => ebdClasses.id),
    studentId: integer("student_id")
      .notNull()
      .references(() => ebdStudents.id),
    enrolledAt: text("enrolled_at").notNull(),
    status: text("status").notNull(),
    leftAt: text("left_at"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("ebd_student_enrollments_class_idx").on(
      table.tenantId,
      table.classId,
      table.status,
      table.studentId,
    ),
  ],
);
export const secretaryRequests = sqliteTable(
  "secretary_requests",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    requestType: text("request_type").notNull(),
    requestDirection: text("request_direction").notNull().default("SAIDA"),
    originUnitId: integer("origin_unit_id"),
    destinationUnitId: integer("destination_unit_id"),
    externalChurch: text("external_church"),
    externalCity: text("external_city"),
    externalState: text("external_state"),
    reason: text("reason"),
    notes: text("notes"),
    status: text("status").notNull(),
    departmentResolution: text("department_resolution"),
    ebdResolution: text("ebd_resolution"),
    version: integer("version").notNull(),
    requestedByUserId: integer("requested_by_user_id").notNull(),
    reviewedByUserId: integer("reviewed_by_user_id"),
    requestedAt: text("requested_at").notNull(),
    reviewedAt: text("reviewed_at"),
    completedAt: text("completed_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("secretary_requests_queue_idx").on(
      table.tenantId,
      table.status,
      table.requestType,
      table.requestedAt,
    ),
    index("secretary_requests_pending_destination_idx").on(
      table.tenantId,
      table.personId,
      table.destinationUnitId,
      table.status,
    ),
  ],
);
export const secretaryTransferSearchLimits = sqliteTable(
  "secretary_transfer_search_limits",
  {
    tenantId: integer("tenant_id").notNull().references(() => tenants.id),
    userId: integer("user_id").notNull().references(() => authUsers.id),
    attempts: integer("attempts").notNull().default(0),
    windowStartedAt: text("window_started_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.userId] }),
    index("secretary_transfer_search_limits_window_idx").on(table.windowStartedAt, table.updatedAt),
  ],
);
export const churchMovements = sqliteTable(
  "church_movements",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    unitId: integer("unit_id").notNull(),
    movementType: text("movement_type").notNull(),
    requestId: integer("request_id"),
    effectiveDate: text("effective_date").notNull(),
    previousStatus: text("previous_status"),
    newStatus: text("new_status"),
    previousUnitId: integer("previous_unit_id"),
    destinationUnitId: integer("destination_unit_id"),
    externalChurch: text("external_church"),
    externalCity: text("external_city"),
    externalState: text("external_state"),
    description: text("description").notNull(),
    metadataJson: text("metadata_json").notNull(),
    status: text("status").notNull(),
    createdByUserId: integer("created_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("church_movements_report_idx").on(
      table.tenantId,
      table.unitId,
      table.movementType,
      table.effectiveDate,
      table.status,
    ),
  ],
);
export const baptismEvents = sqliteTable(
  "baptism_events",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    unitId: integer("unit_id").notNull(),
    title: text("title").notNull(),
    scheduledDate: text("scheduled_date").notNull(),
    location: text("location"),
    responsiblePersonId: integer("responsible_person_id"),
    notes: text("notes"),
    status: text("status").notNull(),
    version: integer("version").notNull(),
    createdByUserId: integer("created_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("baptism_events_date_idx").on(
      table.tenantId,
      table.unitId,
      table.scheduledDate,
      table.status,
    ),
  ],
);
export const baptismCandidates = sqliteTable(
  "baptism_candidates",
  {
    eventId: integer("event_id")
      .notNull()
      .references(() => baptismEvents.id),
    tenantId: integer("tenant_id").notNull(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    status: text("status").notNull(),
    notes: text("notes"),
    completedAt: text("completed_at"),
    updatedByUserId: integer("updated_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.personId] }),
    index("baptism_candidates_status_idx").on(
      table.tenantId,
      table.status,
      table.personId,
    ),
  ],
);
export const consecrations = sqliteTable(
  "consecrations",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    unitId: integer("unit_id").notNull(),
    previousFunctionId: integer("previous_function_id"),
    newFunctionId: integer("new_function_id").notNull(),
    eventDate: text("event_date").notNull(),
    location: text("location"),
    responsiblePersonId: integer("responsible_person_id"),
    notes: text("notes"),
    status: text("status").notNull(),
    version: integer("version").notNull(),
    createdByUserId: integer("created_by_user_id").notNull(),
    completedByUserId: integer("completed_by_user_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("consecrations_status_date_idx").on(
      table.tenantId,
      table.unitId,
      table.status,
      table.eventDate,
    ),
  ],
);
export const secretaryDocumentTemplates = sqliteTable(
  "secretary_document_templates",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    unitId: integer("unit_id"),
    name: text("name").notNull(),
    documentType: text("document_type").notNull(),
    status: text("status").notNull(),
    currentVersion: integer("current_version").notNull(),
    createdByUserId: integer("created_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
);
export const secretaryDocumentTemplateVersions = sqliteTable(
  "secretary_document_template_versions",
  {
    templateId: integer("template_id")
      .notNull()
      .references(() => secretaryDocumentTemplates.id),
    tenantId: integer("tenant_id").notNull(),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    headerText: text("header_text"),
    footerText: text("footer_text"),
    signatureLabelsJson: text("signature_labels_json").notNull(),
    styleJson: text("style_json").notNull(),
    createdByUserId: integer("created_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.templateId, table.version] })],
);
export const secretaryDocuments = sqliteTable(
  "secretary_documents",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    unitId: integer("unit_id").notNull(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    templateId: integer("template_id")
      .notNull()
      .references(() => secretaryDocumentTemplates.id),
    templateVersion: integer("template_version").notNull(),
    documentType: text("document_type").notNull(),
    documentNumber: text("document_number").notNull(),
    titleSnapshot: text("title_snapshot").notNull(),
    bodySnapshot: text("body_snapshot").notNull(),
    headerSnapshot: text("header_snapshot"),
    footerSnapshot: text("footer_snapshot"),
    signaturesSnapshot: text("signatures_snapshot").notNull(),
    issuedByUserId: integer("issued_by_user_id").notNull(),
    issuedAt: text("issued_at").notNull(),
  },
  (table) => [
    index("secretary_documents_report_idx").on(
      table.tenantId,
      table.unitId,
      table.documentType,
      table.issuedAt,
    ),
  ],
);
export const ebdMeetings = sqliteTable(
  "ebd_meetings",
  {
    id: integer("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id),
    meetingDate: text("meeting_date").notNull(),
    theme: text("theme"),
    startTime: text("start_time"),
    status: text("status").notNull(),
    version: integer("version").notNull(),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => authUsers.id),
    finalizedByUserId: integer("finalized_by_user_id").references(
      () => authUsers.id,
    ),
    finalizedAt: text("finalized_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("ebd_meetings_tenant_department_date_unique").on(
      table.tenantId,
      table.departmentId,
      table.meetingDate,
    ),
  ],
);
export const ebdStudentAttendance = sqliteTable(
  "ebd_student_attendance",
  {
    meetingId: integer("meeting_id")
      .notNull()
      .references(() => ebdMeetings.id),
    classId: integer("class_id")
      .notNull()
      .references(() => ebdClasses.id),
    tenantId: integer("tenant_id").notNull(),
    studentId: integer("student_id")
      .notNull()
      .references(() => ebdStudents.id),
    attendanceStatus: text("attendance_status").notNull(),
    updatedByUserId: integer("updated_by_user_id").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.meetingId, table.classId, table.studentId] }),
    index("ebd_student_attendance_history_idx").on(
      table.tenantId,
      table.studentId,
      table.attendanceStatus,
      table.meetingId,
    ),
  ],
);
export const ebdAttendance = sqliteTable(
  "ebd_attendance",
  {
    meetingId: integer("meeting_id")
      .notNull()
      .references(() => ebdMeetings.id),
    classId: integer("class_id")
      .notNull()
      .references(() => ebdClasses.id),
    tenantId: integer("tenant_id").notNull(),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    attendanceStatus: text("attendance_status").notNull(),
    updatedByUserId: integer("updated_by_user_id")
      .notNull()
      .references(() => authUsers.id),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.meetingId, table.classId, table.personId] }),
    index("ebd_attendance_person_history_idx").on(
      table.tenantId,
      table.personId,
      table.attendanceStatus,
      table.meetingId,
    ),
  ],
);
export const ebdVisitors = sqliteTable("ebd_visitors", {
  id: integer("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  departmentId: integer("department_id")
    .notNull()
    .references(() => departments.id),
  meetingId: integer("meeting_id")
    .notNull()
    .references(() => ebdMeetings.id),
  classId: integer("class_id")
    .notNull()
    .references(() => ebdClasses.id),
  personId: integer("person_id").references(() => people.id),
  name: text("name").notNull(),
  phone: text("phone"),
  ageRange: text("age_range"),
  invitedBy: text("invited_by"),
  notes: text("notes"),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => authUsers.id),
  createdAt: text("created_at").notNull(),
});
export const ebdClassSummaries = sqliteTable(
  "ebd_class_summaries",
  {
    meetingId: integer("meeting_id")
      .notNull()
      .references(() => ebdMeetings.id),
    classId: integer("class_id")
      .notNull()
      .references(() => ebdClasses.id),
    tenantId: integer("tenant_id").notNull(),
    enrolledCount: integer("enrolled_count").notNull(),
    presentCount: integer("present_count").notNull(),
    absentCount: integer("absent_count").notNull(),
    justifiedCount: integer("justified_count").notNull(),
    visitorCount: integer("visitor_count").notNull(),
    bibleCount: integer("bible_count").notNull(),
    assistanceCount: integer("assistance_count").notNull(),
    offeringCents: integer("offering_cents").notNull(),
    notes: text("notes"),
    status: text("status").notNull(),
    version: integer("version").notNull(),
    finalizedByUserId: integer("finalized_by_user_id").references(
      () => authUsers.id,
    ),
    finalizedAt: text("finalized_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.meetingId, table.classId] }),
    index("ebd_class_summaries_status_idx").on(
      table.tenantId,
      table.meetingId,
      table.status,
    ),
  ],
);
export const ebdClosures = sqliteTable("ebd_closures", {
  meetingId: integer("meeting_id")
    .primaryKey()
    .references(() => ebdMeetings.id),
  tenantId: integer("tenant_id").notNull(),
  departmentId: integer("department_id")
    .notNull()
    .references(() => departments.id),
  enrolledTotal: integer("enrolled_total").notNull(),
  presentTotal: integer("present_total").notNull(),
  absentTotal: integer("absent_total").notNull(),
  justifiedTotal: integer("justified_total").notNull(),
  visitorTotal: integer("visitor_total").notNull(),
  bibleTotal: integer("bible_total").notNull(),
  assistanceTotal: integer("assistance_total").notNull(),
  offeringTotalCents: integer("offering_total_cents").notNull(),
  exceptionReason: text("exception_reason"),
  finalizedByUserId: integer("finalized_by_user_id")
    .notNull()
    .references(() => authUsers.id),
  finalizedAt: text("finalized_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const departmentAudit = sqliteTable(
  "department_audit",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id").notNull(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id),
    actorUserId: integer("actor_user_id")
      .notNull()
      .references(() => authUsers.id),
    actorMembershipId: integer("actor_membership_id").references(
      () => tenantMemberships.id,
    ),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    previousValues: text("previous_values"),
    newValues: text("new_values"),
    reason: text("reason"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("department_audit_department_created_idx").on(
      table.tenantId,
      table.departmentId,
      table.createdAt,
    ),
  ],
);

export const financeAllocationConfigs = sqliteTable(
  "finance_allocation_configs",
  {
    id: integer("id").primaryKey(), tenantId: integer("tenant_id").notNull(), unitId: integer("unit_id").notNull(),
    version: integer("version").notNull().default(1), status: text("status").notNull().default("ATIVA"),
    createdByUserId: integer("created_by_user_id").notNull(), updatedByUserId: integer("updated_by_user_id").notNull(),
    createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("finance_allocation_configs_unit_unique").on(table.tenantId,table.unitId),index("finance_allocation_configs_scope_idx").on(table.tenantId,table.unitId,table.status)],
);

export const financeAllocationRules = sqliteTable(
  "finance_allocation_rules",
  {
    id: integer("id").primaryKey(), tenantId: integer("tenant_id").notNull(), configId: integer("config_id").notNull(),
    recipientName: text("recipient_name").notNull(), description: text("description"), recipientType: text("recipient_type").notNull(),
    ruleType: text("rule_type").notNull().default("PERCENTUAL"), percentageBasisPoints: integer("percentage_basis_points"), fixedAmountCents: integer("fixed_amount_cents"), financialDestination: text("financial_destination").notNull().default("REPASSAR"), destinationUnitId: integer("destination_unit_id"), destinationDepartmentId: integer("destination_department_id"),
    calculationBase: text("calculation_base").notNull().default("RECEITAS_PARTICIPANTES"), displayOrder: integer("display_order").notNull(), active: integer("active").notNull().default(1),
    createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("finance_allocation_rules_config_idx").on(table.tenantId,table.configId,table.active,table.displayOrder)],
);

export const financePeriods = sqliteTable(
  "finance_periods",
  {
    id: integer("id").primaryKey(), tenantId: integer("tenant_id").notNull(), unitId: integer("unit_id").notNull(), unitType: text("unit_type").notNull(),
    matrixId: integer("matrix_id").notNull(), branchId: integer("branch_id"), competency: text("competency").notNull(), status: text("status").notNull().default("ABERTO"),
    lifecycleState: text("lifecycle_state").notNull().default("ABERTO"), allocationConfigId: integer("allocation_config_id").notNull(), allocationConfigVersion: integer("allocation_config_version").notNull(),
    openedAt: text("opened_at").notNull(), openedByUserId: integer("opened_by_user_id").notNull(), closedAt: text("closed_at"), closedByUserId: integer("closed_by_user_id"),
    reopenedAt: text("reopened_at"), reopenedByUserId: integer("reopened_by_user_id"), reopenReason: text("reopen_reason"), reopenCount: integer("reopen_count").notNull().default(0),
    closureVersion: integer("closure_version").notNull().default(0), notes: text("notes"), version: integer("version").notNull().default(1), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("finance_periods_unit_competency_unique").on(table.tenantId,table.unitId,table.competency),index("finance_periods_scope_competency_idx").on(table.tenantId,table.matrixId,table.branchId,table.competency,table.status)],
);

export const financePeriodReopenRequests = sqliteTable(
  "finance_period_reopen_requests",
  {
    id: integer("id").primaryKey(), tenantId: integer("tenant_id").notNull(), periodId: integer("period_id").notNull(), unitId: integer("unit_id").notNull(), matrixId: integer("matrix_id").notNull(), branchId: integer("branch_id"),
    requesterUserId: integer("requester_user_id").notNull(), requesterMembershipId: integer("requester_membership_id").notNull(), requestedClosureVersion: integer("requested_closure_version").notNull(), reason: text("reason").notNull(), status: text("status").notNull().default("PENDENTE"),
    requestedAt: text("requested_at").notNull(), expiresAt: text("expires_at"), decidedByUserId: integer("decided_by_user_id"), decidedByMembershipId: integer("decided_by_membership_id"), decisionReason: text("decision_reason"), decidedAt: text("decided_at"), usedAt: text("used_at"), reopenedByUserId: integer("reopened_by_user_id"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("finance_reopen_requests_matrix_status_idx").on(table.tenantId, table.matrixId, table.status, table.requestedAt),
    index("finance_reopen_requests_requester_idx").on(table.tenantId, table.requesterUserId, table.periodId, table.requestedClosureVersion),
  ],
);

export const financePeriodAllocationRules = sqliteTable("finance_period_allocation_rules", {
  id: integer("id").primaryKey(), tenantId: integer("tenant_id").notNull(), periodId: integer("period_id").notNull(), sourceRuleId: integer("source_rule_id").notNull(),
  recipientName: text("recipient_name").notNull(), description: text("description"), recipientType: text("recipient_type").notNull(), ruleType: text("rule_type").notNull(),
  percentageBasisPoints: integer("percentage_basis_points"), fixedAmountCents: integer("fixed_amount_cents"), financialDestination: text("financial_destination").notNull().default("REPASSAR"), destinationUnitId: integer("destination_unit_id"), destinationDepartmentId: integer("destination_department_id"), calculationBase: text("calculation_base").notNull(),
  participatingCategoryIdsJson: text("participating_category_ids_json").notNull().default("[]"), displayOrder: integer("display_order").notNull(), snapshotVersion: integer("snapshot_version").notNull(), createdAt: text("created_at").notNull(),
});

export const financeInterunitRepasses = sqliteTable("finance_interunit_repasses", {
  id: integer("id").primaryKey(), tenantId: integer("tenant_id").notNull(), periodId: integer("period_id").notNull(), closureVersion: integer("closure_version").notNull(), ruleDisplayOrder: integer("rule_display_order").notNull(), sourceRuleId: integer("source_rule_id"), sourceUnitId: integer("source_unit_id").notNull(), destinationUnitId: integer("destination_unit_id").notNull(), destinationDepartmentId: integer("destination_department_id"), kind: text("kind").notNull().default("NORMAL"), payerUnitId: integer("payer_unit_id").notNull(), receiverUnitId: integer("receiver_unit_id").notNull(), recipientName: text("recipient_name").notNull(), competency: text("competency").notNull(), expectedCents: integer("expected_cents").notNull(), sentCents: integer("sent_cents").notNull().default(0), receivedCents: integer("received_cents").notNull().default(0), writtenOffCents: integer("written_off_cents").notNull().default(0), status: text("status").notNull().default("PENDENTE"), supersededById: integer("superseded_by_id"), createdByUserId: integer("created_by_user_id").notNull(), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("finance_interunit_repasses_version_unique").on(table.tenantId,table.periodId,table.closureVersion,table.ruleDisplayOrder,table.kind,table.payerUnitId,table.receiverUnitId),index("finance_interunit_repasses_scope_idx").on(table.tenantId,table.payerUnitId,table.receiverUnitId,table.status,table.createdAt)]);

export const financeInterunitRepassEvents = sqliteTable("finance_interunit_repass_events", {
  id: integer("id").primaryKey(), tenantId: integer("tenant_id").notNull(), repassId: integer("repass_id").notNull(), eventType: text("event_type").notNull(), amountCents: integer("amount_cents").notNull(), accountId: integer("account_id"), movementId: integer("movement_id"), occurredOn: text("occurred_on").notNull(), reason: text("reason"), actorUserId: integer("actor_user_id").notNull(), createdAt: text("created_at").notNull(),
}, (table) => [index("finance_interunit_repass_events_idx").on(table.tenantId,table.repassId,table.createdAt),uniqueIndex("finance_interunit_repass_events_movement_unique").on(table.tenantId,table.movementId)]);

export const financeQuickSessions = sqliteTable(
  "finance_quick_sessions",
  {
    id: integer("id").primaryKey(), tenantId: integer("tenant_id").notNull(), periodId: integer("period_id").notNull(), unitId: integer("unit_id").notNull(), userId: integer("user_id").notNull(),
    accountId: integer("account_id").notNull(), defaultDate: text("default_date").notNull(), defaultCompetency: text("default_competency").notNull(), defaultContributionType: text("default_contribution_type").notNull(),
    defaultPaymentMethodId: integer("default_payment_method_id"), status: text("status").notNull().default("EM_ANDAMENTO"), entryCount: integer("entry_count").notNull().default(0), totalCents: integer("total_cents").notNull().default(0),
    startedAt: text("started_at").notNull(), finishedAt: text("finished_at"), updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("finance_quick_sessions_resume_idx").on(table.tenantId,table.userId,table.periodId,table.status,table.updatedAt)],
);

export const financeContributionCategoryDefaults = sqliteTable(
  "finance_contribution_category_defaults",
  {
    tenantId: integer("tenant_id").notNull(),
    contributionType: text("contribution_type").notNull(),
    categoryId: integer("category_id").notNull(),
    createdByUserId: integer("created_by_user_id").notNull(),
    updatedByUserId: integer("updated_by_user_id").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.contributionType] }),
    index("finance_contribution_category_defaults_category_idx").on(
      table.tenantId,
      table.categoryId,
    ),
  ],
);
