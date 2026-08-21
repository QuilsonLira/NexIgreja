ALTER TABLE `finance_allocation_rules` ADD COLUMN `destination_unit_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_allocation_rules` ADD COLUMN `destination_department_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_period_allocation_rules` ADD COLUMN `destination_unit_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_period_allocation_rules` ADD COLUMN `destination_department_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_period_allocation_results` ADD COLUMN `destination_unit_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_period_allocation_results` ADD COLUMN `destination_department_id` integer;
--> statement-breakpoint
CREATE TABLE `finance_interunit_repasses` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `period_id` integer NOT NULL,
  `closure_version` integer NOT NULL,
  `rule_display_order` integer NOT NULL,
  `source_rule_id` integer,
  `source_unit_id` integer NOT NULL,
  `destination_unit_id` integer NOT NULL,
  `destination_department_id` integer,
  `kind` text NOT NULL DEFAULT 'NORMAL' CHECK (`kind` IN ('NORMAL','AJUSTE_COMPLEMENTAR','AJUSTE_DEVOLUCAO')),
  `payer_unit_id` integer NOT NULL,
  `receiver_unit_id` integer NOT NULL,
  `recipient_name` text NOT NULL,
  `competency` text NOT NULL,
  `expected_cents` integer NOT NULL CHECK (`expected_cents` > 0),
  `sent_cents` integer NOT NULL DEFAULT 0 CHECK (`sent_cents` >= 0),
  `received_cents` integer NOT NULL DEFAULT 0 CHECK (`received_cents` >= 0),
  `written_off_cents` integer NOT NULL DEFAULT 0 CHECK (`written_off_cents` >= 0),
  `status` text NOT NULL DEFAULT 'PENDENTE' CHECK (`status` IN ('PENDENTE','ENVIADO','PARCIAL','DIVERGENCIA','QUITADO','SUBSTITUIDO')),
  `superseded_by_id` integer,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`period_id`,`tenant_id`) REFERENCES `finance_periods`(`id`,`tenant_id`),
  FOREIGN KEY (`source_unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`destination_unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`payer_unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`receiver_unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`destination_department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`period_id`,`closure_version`,`rule_display_order`,`kind`,`payer_unit_id`,`receiver_unit_id`)
);
--> statement-breakpoint
CREATE INDEX `finance_interunit_repasses_scope_idx` ON `finance_interunit_repasses` (`tenant_id`,`payer_unit_id`,`receiver_unit_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `finance_interunit_repasses_period_idx` ON `finance_interunit_repasses` (`tenant_id`,`period_id`,`rule_display_order`,`closure_version`);
--> statement-breakpoint
CREATE TABLE `finance_interunit_repass_events` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `repass_id` integer NOT NULL,
  `event_type` text NOT NULL CHECK (`event_type` IN ('ENVIO','RECEBIMENTO','REGULARIZACAO')),
  `amount_cents` integer NOT NULL CHECK (`amount_cents` > 0),
  `account_id` integer,
  `movement_id` integer,
  `occurred_on` text NOT NULL,
  `reason` text,
  `actor_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`repass_id`,`tenant_id`) REFERENCES `finance_interunit_repasses`(`id`,`tenant_id`),
  FOREIGN KEY (`account_id`,`tenant_id`) REFERENCES `finance_accounts`(`id`,`tenant_id`),
  FOREIGN KEY (`movement_id`,`tenant_id`) REFERENCES `finance_movements`(`id`,`tenant_id`),
  FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`movement_id`)
);
--> statement-breakpoint
CREATE INDEX `finance_interunit_repass_events_idx` ON `finance_interunit_repass_events` (`tenant_id`,`repass_id`,`created_at`);
--> statement-breakpoint
INSERT INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(35001,NULL,'financeiro-repasses-entre-unidades','Repasses entre unidades','Acompanhe valores enviados, recebidos e diferenças do Rateio.','Ao fechar o Caixa, cada divisão marcada como Repassar e vinculada a uma unidade gera um repasse. A origem registra o envio, o destino confirma o valor realmente recebido e o sistema mantém diferenças pendentes até novo recebimento ou regularização autorizada. Reabrir e fechar novamente cria somente o ajuste necessário, preservando o histórico.','Financeiro',135,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=repasses',1,1,'2026-08-17','51',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
