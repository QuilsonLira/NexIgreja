CREATE TABLE `commercial_profiles` (
  `tenant_id` integer PRIMARY KEY NOT NULL,
  `person_type` text NOT NULL CHECK (`person_type` IN ('PESSOA_FISICA','PESSOA_JURIDICA')),
  `legal_name` text NOT NULL,
  `document` text,
  `responsible_name` text,
  `phone` text,
  `billing_email` text,
  `notes` text,
  `customer_since` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
);
--> statement-breakpoint
CREATE TABLE `saas_plans` (
  `id` integer PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `price_cents` integer NOT NULL CHECK (`price_cents` >= 0),
  `billing_period` text NOT NULL CHECK (`billing_period` IN ('MENSAL','TRIMESTRAL','SEMESTRAL','ANUAL')),
  `default_grace_days` integer NOT NULL DEFAULT 5 CHECK (`default_grace_days` BETWEEN 0 AND 90),
  `default_trial_days` integer NOT NULL DEFAULT 15 CHECK (`default_trial_days` BETWEEN 0 AND 365),
  `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','INATIVO')),
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saas_plans_name_unique` ON `saas_plans` (`name` COLLATE NOCASE);
--> statement-breakpoint
CREATE TABLE `billing_settings` (
  `singleton_id` integer PRIMARY KEY NOT NULL DEFAULT 1 CHECK (`singleton_id` = 1),
  `warning_days` integer NOT NULL DEFAULT 7 CHECK (`warning_days` BETWEEN 0 AND 90),
  `pix_key` text,
  `pix_key_type` text,
  `payee_name` text,
  `bank_name` text,
  `bank_agency` text,
  `bank_account` text,
  `instructions` text,
  `support_contact` text,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tenant_subscriptions` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL UNIQUE,
  `plan_id` integer,
  `contracted_price_cents` integer NOT NULL DEFAULT 0 CHECK (`contracted_price_cents` >= 0),
  `custom_price_cents` integer CHECK (`custom_price_cents` IS NULL OR `custom_price_cents` >= 0),
  `billing_period` text NOT NULL CHECK (`billing_period` IN ('MENSAL','TRIMESTRAL','SEMESTRAL','ANUAL')),
  `status` text NOT NULL CHECK (`status` IN ('TESTE','ATIVA','AGUARDANDO_PAGAMENTO','EM_CARENCIA','SUSPENSA','CANCELADA','ENCERRADA','ISENTA')),
  `start_date` text NOT NULL,
  `next_due_date` text,
  `due_day` integer CHECK (`due_day` IS NULL OR `due_day` BETWEEN 1 AND 31),
  `grace_days` integer NOT NULL DEFAULT 5 CHECK (`grace_days` BETWEEN 0 AND 90),
  `trial_start_date` text,
  `trial_end_date` text,
  `access_until` text,
  `auto_renew` integer NOT NULL DEFAULT 1 CHECK (`auto_renew` IN (0,1)),
  `notes` text,
  `suspended_reason` text,
  `payment_provider` text NOT NULL DEFAULT 'MANUAL',
  `provider_customer_id` text,
  `provider_subscription_id` text,
  `external_reference` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`plan_id`) REFERENCES `saas_plans`(`id`)
);
--> statement-breakpoint
CREATE INDEX `tenant_subscriptions_status_due_idx` ON `tenant_subscriptions` (`status`,`next_due_date`);
--> statement-breakpoint
CREATE TABLE `saas_charges` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `subscription_id` integer NOT NULL,
  `competence` text NOT NULL,
  `description` text NOT NULL,
  `amount_cents` integer NOT NULL CHECK (`amount_cents` >= 0),
  `issued_date` text NOT NULL,
  `due_date` text NOT NULL,
  `status` text NOT NULL DEFAULT 'PENDENTE' CHECK (`status` IN ('PENDENTE','PAGA','VENCIDA','CANCELADA','ISENTA')),
  `paid_at` text,
  `payment_method` text,
  `notes` text,
  `payment_provider` text NOT NULL DEFAULT 'MANUAL',
  `provider_charge_id` text,
  `external_reference` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`subscription_id`) REFERENCES `tenant_subscriptions`(`id`),
  UNIQUE (`subscription_id`,`due_date`)
);
--> statement-breakpoint
CREATE INDEX `saas_charges_tenant_status_due_idx` ON `saas_charges` (`tenant_id`,`status`,`due_date`);
--> statement-breakpoint
CREATE TABLE `saas_payments` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `subscription_id` integer NOT NULL,
  `charge_id` integer NOT NULL UNIQUE,
  `amount_cents` integer NOT NULL CHECK (`amount_cents` >= 0),
  `paid_date` text NOT NULL,
  `payment_method` text NOT NULL CHECK (`payment_method` IN ('PIX','TRANSFERENCIA','DINHEIRO','BOLETO','CARTAO','OUTRO')),
  `notes` text,
  `payment_provider` text NOT NULL DEFAULT 'MANUAL',
  `provider_payment_id` text,
  `external_reference` text UNIQUE,
  `created_by` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`subscription_id`) REFERENCES `tenant_subscriptions`(`id`),
  FOREIGN KEY (`charge_id`) REFERENCES `saas_charges`(`id`),
  FOREIGN KEY (`created_by`) REFERENCES `auth_users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `saas_payments_tenant_paid_idx` ON `saas_payments` (`tenant_id`,`paid_date`);
--> statement-breakpoint
CREATE TABLE `commercial_audit` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `actor_user_id` integer NOT NULL,
  `tenant_id` integer NOT NULL,
  `action` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` integer NOT NULL,
  `previous_values` text,
  `new_values` text,
  `reason` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`),
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
);
--> statement-breakpoint
CREATE INDEX `commercial_audit_tenant_created_idx` ON `commercial_audit` (`tenant_id`,`created_at`);
--> statement-breakpoint
INSERT INTO `billing_settings` (`singleton_id`,`warning_days`,`updated_at`) VALUES (1,7,CURRENT_TIMESTAMP);
--> statement-breakpoint
INSERT INTO `saas_plans` (`id`,`name`,`description`,`price_cents`,`billing_period`,`default_grace_days`,`default_trial_days`,`status`,`created_at`,`updated_at`)
VALUES (1,'Acesso legado','Plano interno de migração para preservar clientes existentes.',0,'MENSAL',0,0,'INATIVO',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
--> statement-breakpoint
INSERT INTO `commercial_profiles` (`tenant_id`,`person_type`,`legal_name`,`customer_since`,`created_at`,`updated_at`)
SELECT `id`,'PESSOA_JURIDICA',`name`,substr(`created_at`,1,10),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM `tenants`;
--> statement-breakpoint
INSERT INTO `tenant_subscriptions` (`id`,`tenant_id`,`plan_id`,`contracted_price_cents`,`billing_period`,`status`,`start_date`,`grace_days`,`auto_renew`,`notes`,`created_at`,`updated_at`)
SELECT `id`,`id`,1,0,'MENSAL','ISENTA',substr(`created_at`,1,10),0,0,'Cortesia criada pela migração para preservar o acesso existente.',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM `tenants`;
