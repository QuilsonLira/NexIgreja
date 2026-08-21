ALTER TABLE `people` ADD `voter_title` text;
--> statement-breakpoint
CREATE INDEX `people_tenant_voter_title_idx` ON `people` (`tenant_id`,`voter_title`);
--> statement-breakpoint
CREATE TABLE `member_custom_fields` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `name` text NOT NULL,
  `normalized_name` text NOT NULL,
  `field_type` text NOT NULL CHECK (`field_type` IN ('TEXTO_CURTO','TEXTO_LONGO','NUMERO','DATA','SIM_NAO','LISTA_OPCOES','SELECAO_UNICA','TELEFONE','EMAIL')),
  `help_text` text,
  `required` integer NOT NULL DEFAULT 0 CHECK (`required` IN (0,1)),
  `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','INATIVO')),
  `display_order` integer NOT NULL DEFAULT 0 CHECK (`display_order` >= 0),
  `section_name` text NOT NULL DEFAULT 'Informações adicionais',
  `show_admin` integer NOT NULL DEFAULT 1 CHECK (`show_admin` IN (0,1)),
  `show_public` integer NOT NULL DEFAULT 0 CHECK (`show_public` IN (0,1)),
  `show_print` integer NOT NULL DEFAULT 0 CHECK (`show_print` IN (0,1)),
  `options_json` text,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`tenant_id`,`normalized_name`),
  UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE INDEX `member_custom_fields_tenant_status_order_idx` ON `member_custom_fields` (`tenant_id`,`status`,`display_order`);
--> statement-breakpoint
CREATE TABLE `member_custom_values` (
  `person_id` integer NOT NULL,
  `tenant_id` integer NOT NULL,
  `field_id` integer NOT NULL,
  `value_text` text NOT NULL,
  `updated_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  FOREIGN KEY (`field_id`,`tenant_id`) REFERENCES `member_custom_fields`(`id`,`tenant_id`),
  FOREIGN KEY (`updated_by_user_id`) REFERENCES `auth_users`(`id`),
  PRIMARY KEY (`person_id`,`field_id`)
);
--> statement-breakpoint
CREATE TABLE `member_pre_registration_forms` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `name` text NOT NULL,
  `token_hash` text NOT NULL UNIQUE,
  `token_prefix` text NOT NULL,
  `unit_id` integer,
  `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','INATIVO')),
  `expires_at` text,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE INDEX `member_pre_registration_forms_tenant_status_idx` ON `member_pre_registration_forms` (`tenant_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `member_pre_registrations` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `form_id` integer NOT NULL,
  `full_name` text NOT NULL,
  `birth_date` text,
  `cpf` text,
  `phone` text,
  `whatsapp` text,
  `email` text,
  `voter_title` text,
  `matrix_id` integer,
  `branch_id` integer,
  `status` text NOT NULL DEFAULT 'PENDENTE' CHECK (`status` IN ('PENDENTE','EM_ANALISE','AGUARDANDO_CORRECAO','APROVADO','RECUSADO')),
  `payload_json` text NOT NULL,
  `consent_at` text NOT NULL,
  `consent_version` text NOT NULL,
  `source_hash` text NOT NULL,
  `review_reason` text,
  `reviewed_by_user_id` integer,
  `reviewed_at` text,
  `approved_member_id` integer,
  `correction_token_hash` text,
  `correction_expires_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`form_id`,`tenant_id`) REFERENCES `member_pre_registration_forms`(`id`,`tenant_id`),
  FOREIGN KEY (`matrix_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`branch_id`,`matrix_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`parent_id`,`tenant_id`),
  FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `auth_users`(`id`),
  FOREIGN KEY (`approved_member_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE INDEX `member_pre_registrations_tenant_status_created_idx` ON `member_pre_registrations` (`tenant_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `member_pre_registrations_tenant_cpf_idx` ON `member_pre_registrations` (`tenant_id`,`cpf`);
--> statement-breakpoint
CREATE TABLE `member_pre_registration_photos` (
  `pre_registration_id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `image_data` blob NOT NULL,
  `mime_type` text NOT NULL CHECK (`mime_type` IN ('image/jpeg','image/png','image/webp')),
  `byte_size` integer NOT NULL CHECK (`byte_size` BETWEEN 1 AND 2097152),
  `updated_at` text NOT NULL,
  FOREIGN KEY (`pre_registration_id`,`tenant_id`) REFERENCES `member_pre_registrations`(`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `member_pre_registration_custom_values` (
  `pre_registration_id` integer NOT NULL,
  `tenant_id` integer NOT NULL,
  `field_id` integer NOT NULL,
  `value_text` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`pre_registration_id`,`tenant_id`) REFERENCES `member_pre_registrations`(`id`,`tenant_id`),
  FOREIGN KEY (`field_id`,`tenant_id`) REFERENCES `member_custom_fields`(`id`,`tenant_id`),
  PRIMARY KEY (`pre_registration_id`,`field_id`)
);
--> statement-breakpoint
CREATE TABLE `member_pre_registration_rate_limits` (
  `rate_key` text PRIMARY KEY NOT NULL,
  `attempts` integer NOT NULL DEFAULT 0,
  `window_started_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
WITH `new_permissions`(`permission`) AS (VALUES ('PRECADASTROS_VISUALIZAR'),('PRECADASTROS_ANALISAR'),('PRECADASTROS_APROVAR'),('PRECADASTROS_RECUSAR'),('CAMPOS_MEMBROS_CONFIGURAR'),('FORMULARIOS_PRECADASTRO_GERENCIAR'))
INSERT OR IGNORE INTO `membership_permissions` (`membership_id`,`permission`,`created_at`)
SELECT m.`id`,p.`permission`,CURRENT_TIMESTAMP FROM `tenant_memberships` m CROSS JOIN `new_permissions` p WHERE m.`scope`='CONVENCAO' AND m.`status`='ATIVO' AND m.`archived_at` IS NULL;
--> statement-breakpoint
WITH `new_permissions`(`permission`) AS (VALUES ('PRECADASTROS_VISUALIZAR'),('PRECADASTROS_ANALISAR'),('PRECADASTROS_APROVAR'),('PRECADASTROS_RECUSAR'),('CAMPOS_MEMBROS_CONFIGURAR'),('FORMULARIOS_PRECADASTRO_GERENCIAR'))
INSERT OR IGNORE INTO `user_permissions` (`user_id`,`permission`,`created_at`)
SELECT o.`user_id`,p.`permission`,CURRENT_TIMESTAMP FROM `platform_owners` o CROSS JOIN `new_permissions` p;
