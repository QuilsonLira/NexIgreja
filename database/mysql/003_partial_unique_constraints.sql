-- NexIgreja — MySQL 8
-- Recria regras de unicidade que no SQLite eram partial unique indexes.
-- Execute depois do DDL principal gerado por Drizzle.

ALTER TABLE auth_users
  ADD COLUMN platform_username_key VARCHAR(100)
    GENERATED ALWAYS AS (CASE WHEN tenant_id IS NULL THEN username ELSE NULL END) STORED,
  ADD COLUMN platform_email_key VARCHAR(254)
    GENERATED ALWAYS AS (CASE WHEN tenant_id IS NULL THEN email ELSE NULL END) STORED,
  ADD COLUMN platform_cpf_key VARCHAR(32)
    GENERATED ALWAYS AS (CASE WHEN tenant_id IS NULL THEN cpf ELSE NULL END) STORED,
  ADD CONSTRAINT auth_users_platform_username_unique UNIQUE (platform_username_key),
  ADD CONSTRAINT auth_users_platform_email_unique UNIQUE (platform_email_key),
  ADD CONSTRAINT auth_users_platform_cpf_unique UNIQUE (platform_cpf_key);

ALTER TABLE organizational_units
  ADD COLUMN own_cnpj_key VARCHAR(32)
    GENERATED ALWAYS AS (
      CASE
        WHEN cnpj IS NOT NULL AND uses_parent_cnpj = 0 THEN cnpj
        ELSE NULL
      END
    ) STORED,
  ADD CONSTRAINT organizational_units_tenant_own_cnpj_unique
    UNIQUE (tenant_id, own_cnpj_key);
