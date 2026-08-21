CREATE UNIQUE INDEX `organizational_units_id_tenant_unique` ON `organizational_units` (`id`,`tenant_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizational_units_hierarchy_scope_unique` ON `organizational_units` (`id`,`parent_id`,`tenant_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizational_functions_id_tenant_unique` ON `organizational_functions` (`id`,`tenant_id`);
--> statement-breakpoint
CREATE TABLE `member_sequences` (
  `tenant_id` integer PRIMARY KEY NOT NULL,
  `last_number` integer NOT NULL DEFAULT 0 CHECK (`last_number` >= 0),
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
);
--> statement-breakpoint
CREATE TABLE `people` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `member_number` integer NOT NULL CHECK (`member_number` > 0),
  `full_name` text NOT NULL,
  `status` text NOT NULL DEFAULT 'MEMBRO_ATIVO' CHECK (`status` IN ('MEMBRO_ATIVO','CONGREGADO','NOVO_CONVERTIDO','VISITANTE','AFASTADO','TRANSFERIDO','DESLIGADO','FALECIDO','INATIVO')),
  `birth_date` text,
  `sex` text CHECK (`sex` IS NULL OR `sex` IN ('MASCULINO','FEMININO','NAO_INFORMADO')),
  `cpf` text,
  `rg` text,
  `birth_city` text,
  `birth_state` text,
  `phone` text,
  `whatsapp` text,
  `email` text,
  `mother_name` text,
  `father_name` text,
  `marital_status` text CHECK (`marital_status` IS NULL OR `marital_status` IN ('SOLTEIRO','CASADO','DIVORCIADO','VIUVO','UNIAO_ESTAVEL','OUTRO','NAO_INFORMADO')),
  `spouse_name` text,
  `spouse_person_id` integer,
  `children_count` integer NOT NULL DEFAULT 0 CHECK (`children_count` >= 0),
  `postal_code` text,
  `street` text,
  `address_number` text,
  `complement` text,
  `district` text,
  `city` text,
  `state` text,
  `profession` text,
  `workplace` text,
  `education_level` text CHECK (`education_level` IS NULL OR `education_level` IN ('NAO_INFORMADO','NAO_ALFABETIZADO','FUNDAMENTAL_INCOMPLETO','FUNDAMENTAL_COMPLETO','MEDIO_INCOMPLETO','MEDIO_COMPLETO','SUPERIOR_INCOMPLETO','SUPERIOR_COMPLETO','POS_GRADUACAO','MESTRADO','DOUTORADO')),
  `theological_education` text CHECK (`theological_education` IS NULL OR `theological_education` IN ('NAO_INFORMADO','NENHUMA','BASICO','MEDIO','AVANCADO','OUTRO')),
  `primary_function_id` integer,
  `matrix_id` integer NOT NULL,
  `branch_id` integer,
  `church_entry_date` text,
  `origin_church` text,
  `conversion_date` text,
  `baptism_date` text,
  `consecration_date` text,
  `notes` text,
  `linked_auth_user_id` integer,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`spouse_person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  FOREIGN KEY (`primary_function_id`,`tenant_id`) REFERENCES `organizational_functions`(`id`,`tenant_id`),
  FOREIGN KEY (`matrix_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`branch_id`,`matrix_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`parent_id`,`tenant_id`),
  FOREIGN KEY (`linked_auth_user_id`) REFERENCES `auth_users`(`id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`tenant_id`,`member_number`),
  UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_tenant_cpf_unique` ON `people` (`tenant_id`,`cpf`) WHERE `cpf` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `people_tenant_name_idx` ON `people` (`tenant_id`,`full_name` COLLATE NOCASE);
--> statement-breakpoint
CREATE INDEX `people_tenant_status_idx` ON `people` (`tenant_id`,`status`);
--> statement-breakpoint
CREATE INDEX `people_tenant_units_idx` ON `people` (`tenant_id`,`matrix_id`,`branch_id`);
--> statement-breakpoint
CREATE INDEX `people_tenant_function_idx` ON `people` (`tenant_id`,`primary_function_id`);
--> statement-breakpoint
CREATE INDEX `people_tenant_birth_idx` ON `people` (`tenant_id`,`birth_date`);
--> statement-breakpoint
CREATE TABLE `person_functions` (
  `person_id` integer NOT NULL,
  `tenant_id` integer NOT NULL,
  `function_id` integer NOT NULL,
  `is_primary` integer NOT NULL DEFAULT 0 CHECK (`is_primary` IN (0,1)),
  `started_at` text,
  `ended_at` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  FOREIGN KEY (`function_id`,`tenant_id`) REFERENCES `organizational_functions`(`id`,`tenant_id`),
  PRIMARY KEY (`person_id`,`function_id`)
);
--> statement-breakpoint
CREATE TABLE `person_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `tenant_id` integer NOT NULL,
  `person_id` integer NOT NULL,
  `event_type` text NOT NULL,
  `description` text NOT NULL,
  `event_date` text,
  `previous_values` text,
  `new_values` text,
  `actor_user_id` integer NOT NULL,
  `actor_membership_id` integer,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`),
  FOREIGN KEY (`actor_membership_id`) REFERENCES `tenant_memberships`(`id`)
);
--> statement-breakpoint
CREATE INDEX `person_history_person_created_idx` ON `person_history` (`tenant_id`,`person_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `person_relationships` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `person_id` integer NOT NULL,
  `related_person_id` integer NOT NULL,
  `relationship_type` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  FOREIGN KEY (`related_person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  UNIQUE (`person_id`,`related_person_id`,`relationship_type`)
);
--> statement-breakpoint
CREATE TABLE `member_photos` (
  `person_id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `image_data` blob NOT NULL,
  `mime_type` text NOT NULL CHECK (`mime_type` IN ('image/jpeg','image/png','image/webp')),
  `byte_size` integer NOT NULL CHECK (`byte_size` BETWEEN 1 AND 2097152),
  `updated_at` text NOT NULL,
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
);
--> statement-breakpoint
INSERT INTO `member_sequences` (`tenant_id`,`last_number`,`updated_at`) SELECT `id`,0,CURRENT_TIMESTAMP FROM `tenants`;
--> statement-breakpoint
WITH `member_permissions`(`permission`) AS (VALUES ('MEMBROS_VISUALIZAR'),('MEMBROS_CRIAR'),('MEMBROS_EDITAR'),('MEMBROS_ALTERAR_SITUACAO'),('MEMBROS_TRANSFERIR'),('MEMBROS_IMPRIMIR'),('MEMBROS_HISTORICO_VISUALIZAR'),('MEMBROS_OBSERVACOES_VISUALIZAR'),('MEMBROS_OBSERVACOES_EDITAR'))
INSERT OR IGNORE INTO `membership_permissions` (`membership_id`,`permission`,`created_at`)
SELECT m.`id`,p.`permission`,CURRENT_TIMESTAMP FROM `tenant_memberships` m CROSS JOIN `member_permissions` p WHERE m.`scope`='CONVENCAO' AND m.`status`='ATIVO' AND m.`archived_at` IS NULL;
--> statement-breakpoint
WITH `member_permissions`(`permission`) AS (VALUES ('MEMBROS_VISUALIZAR'),('MEMBROS_CRIAR'),('MEMBROS_EDITAR'),('MEMBROS_ALTERAR_SITUACAO'),('MEMBROS_TRANSFERIR'),('MEMBROS_IMPRIMIR'),('MEMBROS_HISTORICO_VISUALIZAR'),('MEMBROS_OBSERVACOES_VISUALIZAR'),('MEMBROS_OBSERVACOES_EDITAR'))
INSERT OR IGNORE INTO `user_permissions` (`user_id`,`permission`,`created_at`)
SELECT o.`user_id`,p.`permission`,CURRENT_TIMESTAMP FROM `platform_owners` o CROSS JOIN `member_permissions` p;
