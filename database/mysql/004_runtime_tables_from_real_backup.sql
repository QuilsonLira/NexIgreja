-- NexIgreja MySQL 8
-- Supplemental runtime tables discovered in the real D1 backup.
-- These tables are created empty. No application data is imported by this migration.
-- SQLite INTEGER is mapped to BIGINT to preserve the original 64-bit range.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `commercial_features` (
  `id` BIGINT NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` LONGTEXT,
  `module` VARCHAR(80) NOT NULL,
  `category` VARCHAR(80) NOT NULL,
  `feature_type` VARCHAR(80) NOT NULL DEFAULT 'RECURSO',
  `show_when_locked` BIGINT NOT NULL DEFAULT 0,
  `status` VARCHAR(80) NOT NULL DEFAULT 'ATIVO',
  `display_order` BIGINT NOT NULL DEFAULT 0,
  `created_at` VARCHAR(40) NOT NULL,
  `updated_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_commercial_features_code` (`code`),
  KEY `commercial_features_catalog_idx` (`module`, `category`, `status`, `display_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `feature_dependencies` (
  `feature_id` BIGINT NOT NULL,
  `required_feature_id` BIGINT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`feature_id`, `required_feature_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_accounts` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `unit_id` BIGINT NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `account_type` VARCHAR(80) NOT NULL,
  `institution` VARCHAR(255),
  `initial_balance_cents` BIGINT NOT NULL DEFAULT 0,
  `initial_balance_date` VARCHAR(40) NOT NULL,
  `status` VARCHAR(80) NOT NULL DEFAULT 'ATIVA',
  `created_by_user_id` BIGINT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  `updated_at` VARCHAR(40) NOT NULL,
  `description` LONGTEXT,
  `agency` VARCHAR(255),
  `account_number` VARCHAR(255),
  `pix_key` VARCHAR(255),
  `notes` LONGTEXT,
  `archived_at` VARCHAR(40),
  `archived_by_user_id` BIGINT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_accounts_id_tenant_id` (`id`, `tenant_id`),
  UNIQUE KEY `uq_finance_accounts_tenant_unit_name` (`tenant_id`, `unit_id`, `name`),
  KEY `finance_accounts_scope_idx` (`tenant_id`, `unit_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_allocation_config_versions` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `unit_id` BIGINT NOT NULL,
  `config_id` BIGINT NOT NULL,
  `version` BIGINT NOT NULL,
  `rules_snapshot_json` LONGTEXT NOT NULL,
  `created_by_user_id` BIGINT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_facv_id_tenant` (`id`, `tenant_id`),
  UNIQUE KEY `uq_facv_tenant_config_version` (`tenant_id`, `config_id`, `version`),
  KEY `finance_allocation_config_versions_scope_idx` (`tenant_id`, `unit_id`, `config_id`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_allocation_rule_drafts` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `category_id` BIGINT NOT NULL,
  `rule_type` VARCHAR(80) NOT NULL,
  `status` VARCHAR(80) NOT NULL DEFAULT 'RASCUNHO',
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fard_id_tenant` (`id`, `tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_attachments` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `movement_id` BIGINT NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(80) NOT NULL,
  `size_bytes` BIGINT NOT NULL,
  `content` LONGBLOB NOT NULL,
  `uploaded_by_user_id` BIGINT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_attachments_id_tenant` (`id`, `tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_audit` (
  `id` BIGINT AUTO_INCREMENT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `unit_id` BIGINT,
  `actor_user_id` BIGINT NOT NULL,
  `actor_membership_id` BIGINT,
  `action` VARCHAR(80) NOT NULL,
  `entity_type` VARCHAR(80) NOT NULL,
  `entity_id` BIGINT NOT NULL,
  `previous_values` LONGTEXT,
  `new_values` LONGTEXT,
  `reason` LONGTEXT,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `finance_audit_scope_idx` (`tenant_id`, `unit_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_campaign_pledge_installments` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `pledge_id` BIGINT NOT NULL,
  `installment_number` BIGINT NOT NULL,
  `due_on` VARCHAR(40) NOT NULL,
  `amount_cents` BIGINT NOT NULL,
  `movement_id` BIGINT,
  `status` VARCHAR(80) NOT NULL DEFAULT 'ABERTA',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fcpi_id_tenant` (`id`, `tenant_id`),
  UNIQUE KEY `uq_fcpi_tenant_pledge_number` (`tenant_id`, `pledge_id`, `installment_number`),
  UNIQUE KEY `uq_fcpi_tenant_movement` (`tenant_id`, `movement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_campaign_pledges` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `campaign_id` BIGINT NOT NULL,
  `person_id` BIGINT,
  `supporter_name` VARCHAR(255),
  `total_cents` BIGINT NOT NULL,
  `status` VARCHAR(80) NOT NULL DEFAULT 'ATIVO',
  `created_at` VARCHAR(40) NOT NULL,
  `updated_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fcp_id_tenant` (`id`, `tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_campaigns` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `unit_id` BIGINT NOT NULL,
  `fund_id` BIGINT,
  `name` VARCHAR(255) NOT NULL,
  `description` LONGTEXT,
  `target_cents` BIGINT,
  `starts_on` VARCHAR(40) NOT NULL,
  `ends_on` VARCHAR(40),
  `status` VARCHAR(80) NOT NULL DEFAULT 'PLANEJADA',
  `created_by_user_id` BIGINT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  `updated_at` VARCHAR(40) NOT NULL,
  `archived_at` VARCHAR(40),
  `archived_by_user_id` BIGINT,
  `archive_reason` LONGTEXT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_campaigns_id_tenant` (`id`, `tenant_id`),
  KEY `finance_campaigns_scope_idx` (`tenant_id`, `unit_id`, `status`),
  KEY `finance_campaigns_scope_archive_idx` (`tenant_id`, `unit_id`, `archived_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_categories` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(80) NOT NULL,
  `participates_allocation` BIGINT NOT NULL DEFAULT 0,
  `requires_fund` BIGINT NOT NULL DEFAULT 0,
  `status` VARCHAR(80) NOT NULL DEFAULT 'ATIVA',
  `created_at` VARCHAR(40) NOT NULL,
  `updated_at` VARCHAR(40) NOT NULL,
  `description` LONGTEXT,
  `archived_at` VARCHAR(40),
  `archived_by_user_id` BIGINT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_categories_id_tenant` (`id`, `tenant_id`),
  UNIQUE KEY `uq_finance_categories_tenant_kind_name` (`tenant_id`, `kind`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_closure_versions` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `period_id` BIGINT NOT NULL,
  `version` BIGINT NOT NULL,
  `total_entries_cents` BIGINT NOT NULL,
  `total_expenses_cents` BIGINT NOT NULL,
  `restricted_resources_cents` BIGINT NOT NULL,
  `balance_cents` BIGINT NOT NULL,
  `movement_count` BIGINT NOT NULL,
  `rules_snapshot_json` LONGTEXT NOT NULL,
  `totals_snapshot_json` LONGTEXT NOT NULL,
  `closed_by_user_id` BIGINT NOT NULL,
  `closed_at` VARCHAR(40) NOT NULL,
  `eligible_base_cents` BIGINT NOT NULL DEFAULT 0,
  `excluded_resources_cents` BIGINT NOT NULL DEFAULT 0,
  `allocated_cents` BIGINT NOT NULL DEFAULT 0,
  `unallocated_cents` BIGINT NOT NULL DEFAULT 0,
  `allocation_results_json` LONGTEXT NOT NULL DEFAULT ('[]'),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fcv_id_tenant` (`id`, `tenant_id`),
  UNIQUE KEY `uq_fcv_tenant_period_version` (`tenant_id`, `period_id`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_contributions` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `movement_id` BIGINT NOT NULL,
  `contribution_type` VARCHAR(80) NOT NULL,
  `person_id` BIGINT,
  `privacy` VARCHAR(80) NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_contributions_id_tenant` (`id`, `tenant_id`),
  UNIQUE KEY `uq_finance_contributions_tenant_movement` (`tenant_id`, `movement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_cost_centers` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `unit_id` BIGINT NOT NULL,
  `department_id` BIGINT,
  `name` VARCHAR(191) NOT NULL,
  `center_type` VARCHAR(80) NOT NULL,
  `status` VARCHAR(80) NOT NULL DEFAULT 'ATIVO',
  `created_at` VARCHAR(40) NOT NULL,
  `updated_at` VARCHAR(40) NOT NULL,
  `description` LONGTEXT,
  `archived_at` VARCHAR(40),
  `archived_by_user_id` BIGINT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_cost_centers_id_tenant` (`id`, `tenant_id`),
  UNIQUE KEY `uq_finance_cost_centers_tenant_unit_name` (`tenant_id`, `unit_id`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_funds` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `unit_id` BIGINT NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `restricted` BIGINT NOT NULL DEFAULT 1,
  `status` VARCHAR(80) NOT NULL DEFAULT 'ATIVO',
  `created_at` VARCHAR(40) NOT NULL,
  `updated_at` VARCHAR(40) NOT NULL,
  `description` LONGTEXT,
  `purpose` LONGTEXT,
  `archived_at` VARCHAR(40),
  `archived_by_user_id` BIGINT,
  `archive_reason` LONGTEXT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_funds_id_tenant` (`id`, `tenant_id`),
  UNIQUE KEY `uq_finance_funds_tenant_unit_name` (`tenant_id`, `unit_id`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_installments` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `obligation_id` BIGINT NOT NULL,
  `installment_number` BIGINT NOT NULL,
  `installment_count` BIGINT NOT NULL,
  `due_on` VARCHAR(40) NOT NULL,
  `amount_cents` BIGINT NOT NULL,
  `status` VARCHAR(80) NOT NULL DEFAULT 'ABERTA',
  `movement_id` BIGINT,
  `settled_at` VARCHAR(40),
  `created_at` VARCHAR(40) NOT NULL,
  `settled_amount_cents` BIGINT,
  `interest_cents` BIGINT NOT NULL DEFAULT 0,
  `penalty_cents` BIGINT NOT NULL DEFAULT 0,
  `discount_cents` BIGINT NOT NULL DEFAULT 0,
  `adjustment_cents` BIGINT NOT NULL DEFAULT 0,
  `difference_reason` LONGTEXT,
  `settled_account_id` BIGINT,
  `payment_method_id` BIGINT,
  `settled_on` VARCHAR(40),
  `reversal_movement_id` BIGINT,
  `version` BIGINT NOT NULL DEFAULT 1,
  `updated_at` VARCHAR(40),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_installments_id_tenant` (`id`, `tenant_id`),
  UNIQUE KEY `uq_finance_installments_tenant_obligation_number` (`tenant_id`, `obligation_id`, `installment_number`),
  UNIQUE KEY `uq_finance_installments_tenant_movement` (`tenant_id`, `movement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_movements` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `unit_id` BIGINT NOT NULL,
  `account_id` BIGINT NOT NULL,
  `direction` VARCHAR(80) NOT NULL,
  `amount_cents` BIGINT NOT NULL,
  `occurred_on` VARCHAR(40) NOT NULL,
  `competency` VARCHAR(255) NOT NULL,
  `description` LONGTEXT NOT NULL,
  `category_id` BIGINT,
  `payment_method_id` BIGINT,
  `person_id` BIGINT,
  `cost_center_id` BIGINT,
  `department_id` BIGINT,
  `campaign_id` BIGINT,
  `fund_id` BIGINT,
  `source` VARCHAR(80) NOT NULL DEFAULT 'MANUAL',
  `source_entity` VARCHAR(255),
  `source_entity_id` BIGINT,
  `privacy` VARCHAR(80) NOT NULL DEFAULT 'IDENTIFICADA_PRIVADA',
  `status` VARCHAR(80) NOT NULL DEFAULT 'CONFIRMADO',
  `original_movement_id` BIGINT,
  `transfer_id` BIGINT,
  `idempotency_key` VARCHAR(191),
  `created_by_user_id` BIGINT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  `period_id` BIGINT,
  `quick_session_id` BIGINT,
  `reversal_direction` VARCHAR(80),
  `created_during_reopening` BIGINT NOT NULL DEFAULT 0,
  `version` BIGINT NOT NULL DEFAULT 1,
  `updated_at` VARCHAR(40),
  `adjustment_direction` VARCHAR(80),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_movements_id_tenant` (`id`, `tenant_id`),
  UNIQUE KEY `uq_finance_movements_tenant_idempotency` (`tenant_id`, `idempotency_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_obligations` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `unit_id` BIGINT NOT NULL,
  `kind` VARCHAR(80) NOT NULL,
  `description` LONGTEXT NOT NULL,
  `beneficiary_name` VARCHAR(255),
  `person_id` BIGINT,
  `category_id` BIGINT,
  `cost_center_id` BIGINT,
  `campaign_id` BIGINT,
  `fund_id` BIGINT,
  `total_cents` BIGINT NOT NULL,
  `competency` VARCHAR(255) NOT NULL,
  `status` VARCHAR(80) NOT NULL DEFAULT 'ABERTA',
  `created_by_user_id` BIGINT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  `updated_at` VARCHAR(40) NOT NULL,
  `notes` LONGTEXT,
  `document_reference` VARCHAR(255),
  `suggested_account_id` BIGINT,
  `payment_method_id` BIGINT,
  `version` BIGINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_obligations_id_tenant` (`id`, `tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_payment_methods` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `status` VARCHAR(80) NOT NULL DEFAULT 'ATIVO',
  `created_at` VARCHAR(40) NOT NULL,
  `updated_at` VARCHAR(40) NOT NULL,
  `description` LONGTEXT,
  `archived_at` VARCHAR(40),
  `archived_by_user_id` BIGINT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_payment_methods_id_tenant` (`id`, `tenant_id`),
  UNIQUE KEY `uq_finance_payment_methods_tenant_name` (`tenant_id`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_period_allocation_results` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `period_id` BIGINT NOT NULL,
  `closure_version` BIGINT NOT NULL DEFAULT 0,
  `snapshot_version` BIGINT NOT NULL,
  `source_rule_id` BIGINT,
  `recipient_name` VARCHAR(255) NOT NULL,
  `rule_type` VARCHAR(80) NOT NULL,
  `percentage_basis_points` BIGINT,
  `fixed_amount_cents` BIGINT,
  `eligible_base_cents` BIGINT NOT NULL,
  `calculated_amount_cents` BIGINT NOT NULL,
  `transferred_amount_cents` BIGINT NOT NULL DEFAULT 0,
  `remaining_transfer_cents` BIGINT NOT NULL,
  `display_order` BIGINT NOT NULL,
  `calculated_at` VARCHAR(40) NOT NULL,
  `financial_destination` VARCHAR(80) NOT NULL DEFAULT 'REPASSAR',
  `destination_unit_id` BIGINT,
  `destination_department_id` BIGINT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fpar_id_tenant` (`id`, `tenant_id`),
  UNIQUE KEY `uq_fpar_period_closure_order` (`tenant_id`, `period_id`, `closure_version`, `display_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_period_allocation_rule_versions` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `period_id` BIGINT NOT NULL,
  `snapshot_version` BIGINT NOT NULL,
  `rules_snapshot_json` LONGTEXT NOT NULL,
  `change_reason` LONGTEXT,
  `created_by_user_id` BIGINT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fparv_id_tenant` (`id`, `tenant_id`),
  UNIQUE KEY `uq_fparv_period_snapshot` (`tenant_id`, `period_id`, `snapshot_version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_period_reopenings` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `period_id` BIGINT NOT NULL,
  `reopen_number` BIGINT NOT NULL,
  `previous_status` VARCHAR(80) NOT NULL,
  `reason` LONGTEXT NOT NULL,
  `reopened_by_user_id` BIGINT NOT NULL,
  `actor_scope` VARCHAR(80) NOT NULL,
  `actor_matrix_id` BIGINT NOT NULL,
  `reopened_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fpr_id_tenant` (`id`, `tenant_id`),
  UNIQUE KEY `uq_fpr_period_number` (`tenant_id`, `period_id`, `reopen_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_report_model_versions` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `model_id` BIGINT NOT NULL,
  `version` BIGINT NOT NULL,
  `config_snapshot_json` LONGTEXT NOT NULL,
  `created_by_user_id` BIGINT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_frmv_id_tenant` (`id`, `tenant_id`),
  UNIQUE KEY `uq_frmv_model_version` (`tenant_id`, `model_id`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_report_models` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `unit_id` BIGINT,
  `name` VARCHAR(255) NOT NULL,
  `description` LONGTEXT,
  `status` VARCHAR(80) NOT NULL DEFAULT 'ATIVO',
  `is_default` BIGINT NOT NULL DEFAULT 0,
  `current_version` BIGINT NOT NULL DEFAULT 1,
  `created_by_user_id` BIGINT NOT NULL,
  `updated_by_user_id` BIGINT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  `updated_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_report_models_id_tenant` (`id`, `tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_reports` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `unit_id` BIGINT NOT NULL,
  `period_id` BIGINT NOT NULL,
  `closure_id` BIGINT,
  `closure_version` BIGINT,
  `report_type` VARCHAR(80) NOT NULL,
  `version` BIGINT NOT NULL,
  `status` VARCHAR(80) NOT NULL,
  `model_id` BIGINT,
  `model_version` BIGINT NOT NULL,
  `model_snapshot_json` LONGTEXT NOT NULL,
  `report_snapshot_json` LONGTEXT NOT NULL,
  `generated_by_user_id` BIGINT NOT NULL,
  `generated_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_reports_id_tenant` (`id`, `tenant_id`),
  UNIQUE KEY `uq_finance_reports_period_type_version` (`tenant_id`, `period_id`, `report_type`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_transfers` (
  `id` BIGINT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `unit_id` BIGINT NOT NULL,
  `origin_account_id` BIGINT NOT NULL,
  `destination_account_id` BIGINT NOT NULL,
  `amount_cents` BIGINT NOT NULL,
  `occurred_on` VARCHAR(40) NOT NULL,
  `out_movement_id` BIGINT NOT NULL,
  `in_movement_id` BIGINT NOT NULL,
  `description` LONGTEXT,
  `created_by_user_id` BIGINT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  `notes` LONGTEXT,
  `status` VARCHAR(80) NOT NULL DEFAULT 'CONFIRMADA',
  `reversal_of_transfer_id` BIGINT,
  `reversed_by_transfer_id` BIGINT,
  `version` BIGINT NOT NULL DEFAULT 1,
  `updated_at` VARCHAR(40),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_transfers_id_tenant` (`id`, `tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `person_financial_preferences` (
  `tenant_id` BIGINT NOT NULL,
  `person_id` BIGINT NOT NULL,
  `default_privacy` VARCHAR(80) NOT NULL DEFAULT 'IDENTIFICADA_PRIVADA',
  `updated_by_user_id` BIGINT NOT NULL,
  `updated_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`tenant_id`, `person_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `plan_features` (
  `plan_id` BIGINT NOT NULL,
  `feature_id` BIGINT NOT NULL,
  `created_by_user_id` BIGINT,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`plan_id`, `feature_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `secretary_audit` (
  `id` BIGINT AUTO_INCREMENT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `unit_id` BIGINT,
  `actor_user_id` BIGINT NOT NULL,
  `actor_membership_id` BIGINT,
  `action` VARCHAR(80) NOT NULL,
  `entity_type` VARCHAR(80) NOT NULL,
  `entity_id` BIGINT NOT NULL,
  `previous_values` LONGTEXT,
  `new_values` LONGTEXT,
  `reason` LONGTEXT,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `secretary_document_sequences` (
  `tenant_id` BIGINT NOT NULL,
  `year` BIGINT NOT NULL,
  `last_number` BIGINT NOT NULL DEFAULT 0,
  `updated_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`tenant_id`, `year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_feature_overrides` (
  `id` BIGINT AUTO_INCREMENT NOT NULL,
  `tenant_id` BIGINT NOT NULL,
  `feature_id` BIGINT NOT NULL,
  `action` VARCHAR(80) NOT NULL,
  `reason` LONGTEXT NOT NULL,
  `starts_at` VARCHAR(40) NOT NULL,
  `ends_at` VARCHAR(40),
  `created_by_user_id` BIGINT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  `revoked_at` VARCHAR(40),
  `revoked_by_user_id` BIGINT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `feature_dependencies` ADD CONSTRAINT `fk_feature_dependencies_feature_id_commercial_features` FOREIGN KEY (`feature_id`) REFERENCES `commercial_features` (`id`);
ALTER TABLE `feature_dependencies` ADD CONSTRAINT `fk_feature_dependencies_required_feature_id_commercial_features` FOREIGN KEY (`required_feature_id`) REFERENCES `commercial_features` (`id`);
ALTER TABLE `finance_accounts` ADD CONSTRAINT `fk_finance_accounts_created_by_user_id_auth_users` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `finance_accounts` ADD CONSTRAINT `fk_finance_accounts_unit_tenant` FOREIGN KEY (`unit_id`, `tenant_id`) REFERENCES `organizational_units` (`id`, `tenant_id`);
ALTER TABLE `finance_allocation_config_versions` ADD CONSTRAINT `fk_facv_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `finance_allocation_config_versions` ADD CONSTRAINT `fk_facv_config_tenant` FOREIGN KEY (`config_id`, `tenant_id`) REFERENCES `finance_allocation_configs` (`id`, `tenant_id`);
ALTER TABLE `finance_allocation_config_versions` ADD CONSTRAINT `fk_facv_unit_tenant` FOREIGN KEY (`unit_id`, `tenant_id`) REFERENCES `organizational_units` (`id`, `tenant_id`);
ALTER TABLE `finance_allocation_rule_drafts` ADD CONSTRAINT `fk_fard_category_tenant` FOREIGN KEY (`category_id`, `tenant_id`) REFERENCES `finance_categories` (`id`, `tenant_id`);
ALTER TABLE `finance_attachments` ADD CONSTRAINT `fk_finance_attachments_uploaded_by` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `finance_attachments` ADD CONSTRAINT `fk_finance_attachments_movement_tenant` FOREIGN KEY (`movement_id`, `tenant_id`) REFERENCES `finance_movements` (`id`, `tenant_id`);
ALTER TABLE `finance_audit` ADD CONSTRAINT `fk_finance_audit_actor_membership` FOREIGN KEY (`actor_membership_id`) REFERENCES `tenant_memberships` (`id`);
ALTER TABLE `finance_audit` ADD CONSTRAINT `fk_finance_audit_actor_user` FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `finance_audit` ADD CONSTRAINT `fk_finance_audit_unit_tenant` FOREIGN KEY (`unit_id`, `tenant_id`) REFERENCES `organizational_units` (`id`, `tenant_id`);
ALTER TABLE `finance_campaign_pledge_installments` ADD CONSTRAINT `fk_fcpi_movement_tenant` FOREIGN KEY (`movement_id`, `tenant_id`) REFERENCES `finance_movements` (`id`, `tenant_id`);
ALTER TABLE `finance_campaign_pledge_installments` ADD CONSTRAINT `fk_fcpi_pledge_tenant` FOREIGN KEY (`pledge_id`, `tenant_id`) REFERENCES `finance_campaign_pledges` (`id`, `tenant_id`);
ALTER TABLE `finance_campaign_pledges` ADD CONSTRAINT `fk_fcp_person_tenant` FOREIGN KEY (`person_id`, `tenant_id`) REFERENCES `people` (`id`, `tenant_id`);
ALTER TABLE `finance_campaign_pledges` ADD CONSTRAINT `fk_fcp_campaign_tenant` FOREIGN KEY (`campaign_id`, `tenant_id`) REFERENCES `finance_campaigns` (`id`, `tenant_id`);
ALTER TABLE `finance_campaigns` ADD CONSTRAINT `fk_finance_campaigns_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `finance_campaigns` ADD CONSTRAINT `fk_finance_campaigns_fund_tenant` FOREIGN KEY (`fund_id`, `tenant_id`) REFERENCES `finance_funds` (`id`, `tenant_id`);
ALTER TABLE `finance_campaigns` ADD CONSTRAINT `fk_finance_campaigns_unit_tenant` FOREIGN KEY (`unit_id`, `tenant_id`) REFERENCES `organizational_units` (`id`, `tenant_id`);
ALTER TABLE `finance_categories` ADD CONSTRAINT `fk_finance_categories_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);
ALTER TABLE `finance_closure_versions` ADD CONSTRAINT `fk_fcv_closed_by` FOREIGN KEY (`closed_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `finance_closure_versions` ADD CONSTRAINT `fk_fcv_period_tenant` FOREIGN KEY (`period_id`, `tenant_id`) REFERENCES `finance_periods` (`id`, `tenant_id`);
ALTER TABLE `finance_contributions` ADD CONSTRAINT `fk_finance_contributions_person_tenant` FOREIGN KEY (`person_id`, `tenant_id`) REFERENCES `people` (`id`, `tenant_id`);
ALTER TABLE `finance_contributions` ADD CONSTRAINT `fk_finance_contributions_movement_tenant` FOREIGN KEY (`movement_id`, `tenant_id`) REFERENCES `finance_movements` (`id`, `tenant_id`);
ALTER TABLE `finance_cost_centers` ADD CONSTRAINT `fk_finance_cost_centers_department_tenant` FOREIGN KEY (`department_id`, `tenant_id`) REFERENCES `departments` (`id`, `tenant_id`);
ALTER TABLE `finance_cost_centers` ADD CONSTRAINT `fk_finance_cost_centers_unit_tenant` FOREIGN KEY (`unit_id`, `tenant_id`) REFERENCES `organizational_units` (`id`, `tenant_id`);
ALTER TABLE `finance_funds` ADD CONSTRAINT `fk_finance_funds_unit_tenant` FOREIGN KEY (`unit_id`, `tenant_id`) REFERENCES `organizational_units` (`id`, `tenant_id`);
ALTER TABLE `finance_installments` ADD CONSTRAINT `fk_finance_installments_movement_tenant` FOREIGN KEY (`movement_id`, `tenant_id`) REFERENCES `finance_movements` (`id`, `tenant_id`);
ALTER TABLE `finance_installments` ADD CONSTRAINT `fk_finance_installments_obligation_tenant` FOREIGN KEY (`obligation_id`, `tenant_id`) REFERENCES `finance_obligations` (`id`, `tenant_id`);
ALTER TABLE `finance_movements` ADD CONSTRAINT `fk_finance_movements_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `finance_movements` ADD CONSTRAINT `fk_finance_movements_original_tenant` FOREIGN KEY (`original_movement_id`, `tenant_id`) REFERENCES `finance_movements` (`id`, `tenant_id`);
ALTER TABLE `finance_movements` ADD CONSTRAINT `fk_finance_movements_fund_tenant` FOREIGN KEY (`fund_id`, `tenant_id`) REFERENCES `finance_funds` (`id`, `tenant_id`);
ALTER TABLE `finance_movements` ADD CONSTRAINT `fk_finance_movements_campaign_tenant` FOREIGN KEY (`campaign_id`, `tenant_id`) REFERENCES `finance_campaigns` (`id`, `tenant_id`);
ALTER TABLE `finance_movements` ADD CONSTRAINT `fk_finance_movements_department_tenant` FOREIGN KEY (`department_id`, `tenant_id`) REFERENCES `departments` (`id`, `tenant_id`);
ALTER TABLE `finance_movements` ADD CONSTRAINT `fk_finance_movements_cost_center_tenant` FOREIGN KEY (`cost_center_id`, `tenant_id`) REFERENCES `finance_cost_centers` (`id`, `tenant_id`);
ALTER TABLE `finance_movements` ADD CONSTRAINT `fk_finance_movements_person_tenant` FOREIGN KEY (`person_id`, `tenant_id`) REFERENCES `people` (`id`, `tenant_id`);
ALTER TABLE `finance_movements` ADD CONSTRAINT `fk_finance_movements_payment_method_tenant` FOREIGN KEY (`payment_method_id`, `tenant_id`) REFERENCES `finance_payment_methods` (`id`, `tenant_id`);
ALTER TABLE `finance_movements` ADD CONSTRAINT `fk_finance_movements_category_tenant` FOREIGN KEY (`category_id`, `tenant_id`) REFERENCES `finance_categories` (`id`, `tenant_id`);
ALTER TABLE `finance_movements` ADD CONSTRAINT `fk_finance_movements_account_tenant` FOREIGN KEY (`account_id`, `tenant_id`) REFERENCES `finance_accounts` (`id`, `tenant_id`);
ALTER TABLE `finance_movements` ADD CONSTRAINT `fk_finance_movements_unit_tenant` FOREIGN KEY (`unit_id`, `tenant_id`) REFERENCES `organizational_units` (`id`, `tenant_id`);
ALTER TABLE `finance_obligations` ADD CONSTRAINT `fk_finance_obligations_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `finance_obligations` ADD CONSTRAINT `fk_finance_obligations_fund_tenant` FOREIGN KEY (`fund_id`, `tenant_id`) REFERENCES `finance_funds` (`id`, `tenant_id`);
ALTER TABLE `finance_obligations` ADD CONSTRAINT `fk_finance_obligations_campaign_tenant` FOREIGN KEY (`campaign_id`, `tenant_id`) REFERENCES `finance_campaigns` (`id`, `tenant_id`);
ALTER TABLE `finance_obligations` ADD CONSTRAINT `fk_finance_obligations_cost_center_tenant` FOREIGN KEY (`cost_center_id`, `tenant_id`) REFERENCES `finance_cost_centers` (`id`, `tenant_id`);
ALTER TABLE `finance_obligations` ADD CONSTRAINT `fk_finance_obligations_category_tenant` FOREIGN KEY (`category_id`, `tenant_id`) REFERENCES `finance_categories` (`id`, `tenant_id`);
ALTER TABLE `finance_obligations` ADD CONSTRAINT `fk_finance_obligations_person_tenant` FOREIGN KEY (`person_id`, `tenant_id`) REFERENCES `people` (`id`, `tenant_id`);
ALTER TABLE `finance_obligations` ADD CONSTRAINT `fk_finance_obligations_unit_tenant` FOREIGN KEY (`unit_id`, `tenant_id`) REFERENCES `organizational_units` (`id`, `tenant_id`);
ALTER TABLE `finance_payment_methods` ADD CONSTRAINT `fk_finance_payment_methods_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);
ALTER TABLE `finance_period_allocation_results` ADD CONSTRAINT `fk_fpar_period_tenant` FOREIGN KEY (`period_id`, `tenant_id`) REFERENCES `finance_periods` (`id`, `tenant_id`);
ALTER TABLE `finance_period_allocation_rule_versions` ADD CONSTRAINT `fk_fparv_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `finance_period_allocation_rule_versions` ADD CONSTRAINT `fk_fparv_period_tenant` FOREIGN KEY (`period_id`, `tenant_id`) REFERENCES `finance_periods` (`id`, `tenant_id`);
ALTER TABLE `finance_period_reopenings` ADD CONSTRAINT `fk_fpr_reopened_by` FOREIGN KEY (`reopened_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `finance_period_reopenings` ADD CONSTRAINT `fk_fpr_period_tenant` FOREIGN KEY (`period_id`, `tenant_id`) REFERENCES `finance_periods` (`id`, `tenant_id`);
ALTER TABLE `finance_report_model_versions` ADD CONSTRAINT `fk_frmv_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `finance_report_model_versions` ADD CONSTRAINT `fk_frmv_model_tenant` FOREIGN KEY (`model_id`, `tenant_id`) REFERENCES `finance_report_models` (`id`, `tenant_id`);
ALTER TABLE `finance_report_models` ADD CONSTRAINT `fk_finance_report_models_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `finance_report_models` ADD CONSTRAINT `fk_finance_report_models_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `finance_report_models` ADD CONSTRAINT `fk_finance_report_models_unit_tenant` FOREIGN KEY (`unit_id`, `tenant_id`) REFERENCES `organizational_units` (`id`, `tenant_id`);
ALTER TABLE `finance_report_models` ADD CONSTRAINT `fk_finance_report_models_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);
ALTER TABLE `finance_reports` ADD CONSTRAINT `fk_finance_reports_generated_by` FOREIGN KEY (`generated_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `finance_reports` ADD CONSTRAINT `fk_finance_reports_model_tenant` FOREIGN KEY (`model_id`, `tenant_id`) REFERENCES `finance_report_models` (`id`, `tenant_id`);
ALTER TABLE `finance_reports` ADD CONSTRAINT `fk_finance_reports_closure_tenant` FOREIGN KEY (`closure_id`, `tenant_id`) REFERENCES `finance_closure_versions` (`id`, `tenant_id`);
ALTER TABLE `finance_reports` ADD CONSTRAINT `fk_finance_reports_period_tenant` FOREIGN KEY (`period_id`, `tenant_id`) REFERENCES `finance_periods` (`id`, `tenant_id`);
ALTER TABLE `finance_reports` ADD CONSTRAINT `fk_finance_reports_unit_tenant` FOREIGN KEY (`unit_id`, `tenant_id`) REFERENCES `organizational_units` (`id`, `tenant_id`);
ALTER TABLE `finance_transfers` ADD CONSTRAINT `fk_finance_transfers_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `finance_transfers` ADD CONSTRAINT `fk_finance_transfers_in_movement_tenant` FOREIGN KEY (`in_movement_id`, `tenant_id`) REFERENCES `finance_movements` (`id`, `tenant_id`);
ALTER TABLE `finance_transfers` ADD CONSTRAINT `fk_finance_transfers_out_movement_tenant` FOREIGN KEY (`out_movement_id`, `tenant_id`) REFERENCES `finance_movements` (`id`, `tenant_id`);
ALTER TABLE `finance_transfers` ADD CONSTRAINT `fk_finance_transfers_destination_account_tenant` FOREIGN KEY (`destination_account_id`, `tenant_id`) REFERENCES `finance_accounts` (`id`, `tenant_id`);
ALTER TABLE `finance_transfers` ADD CONSTRAINT `fk_finance_transfers_origin_account_tenant` FOREIGN KEY (`origin_account_id`, `tenant_id`) REFERENCES `finance_accounts` (`id`, `tenant_id`);
ALTER TABLE `person_financial_preferences` ADD CONSTRAINT `fk_person_financial_preferences_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `person_financial_preferences` ADD CONSTRAINT `fk_person_financial_preferences_person_tenant` FOREIGN KEY (`person_id`, `tenant_id`) REFERENCES `people` (`id`, `tenant_id`);
ALTER TABLE `plan_features` ADD CONSTRAINT `fk_plan_features_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `plan_features` ADD CONSTRAINT `fk_plan_features_feature` FOREIGN KEY (`feature_id`) REFERENCES `commercial_features` (`id`);
ALTER TABLE `plan_features` ADD CONSTRAINT `fk_plan_features_plan` FOREIGN KEY (`plan_id`) REFERENCES `saas_plans` (`id`);
ALTER TABLE `secretary_audit` ADD CONSTRAINT `fk_secretary_audit_actor_membership` FOREIGN KEY (`actor_membership_id`) REFERENCES `tenant_memberships` (`id`);
ALTER TABLE `secretary_audit` ADD CONSTRAINT `fk_secretary_audit_actor_user` FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `secretary_audit` ADD CONSTRAINT `fk_secretary_audit_unit_tenant` FOREIGN KEY (`unit_id`, `tenant_id`) REFERENCES `organizational_units` (`id`, `tenant_id`);
ALTER TABLE `secretary_audit` ADD CONSTRAINT `fk_secretary_audit_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);
ALTER TABLE `secretary_document_sequences` ADD CONSTRAINT `fk_secretary_document_sequences_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);
ALTER TABLE `tenant_feature_overrides` ADD CONSTRAINT `fk_tenant_feature_overrides_revoked_by` FOREIGN KEY (`revoked_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `tenant_feature_overrides` ADD CONSTRAINT `fk_tenant_feature_overrides_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users` (`id`);
ALTER TABLE `tenant_feature_overrides` ADD CONSTRAINT `fk_tenant_feature_overrides_feature` FOREIGN KEY (`feature_id`) REFERENCES `commercial_features` (`id`);
ALTER TABLE `tenant_feature_overrides` ADD CONSTRAINT `fk_tenant_feature_overrides_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`);
