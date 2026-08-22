ALTER TABLE `finance_allocation_rules` ADD COLUMN `person_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_allocation_rules` ADD COLUMN `beneficiary_type` text;
--> statement-breakpoint
ALTER TABLE `finance_allocation_rules` ADD COLUMN `payable_description` text;
--> statement-breakpoint
ALTER TABLE `finance_allocation_rules` ADD COLUMN `due_day` integer;
--> statement-breakpoint
ALTER TABLE `finance_period_allocation_rules` ADD COLUMN `person_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_period_allocation_rules` ADD COLUMN `beneficiary_type` text;
--> statement-breakpoint
ALTER TABLE `finance_period_allocation_rules` ADD COLUMN `payable_description` text;
--> statement-breakpoint
ALTER TABLE `finance_period_allocation_rules` ADD COLUMN `due_day` integer;
--> statement-breakpoint
ALTER TABLE `finance_obligations` ADD COLUMN `generated_by_rateio` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `finance_obligations` ADD COLUMN `rateio_period_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_obligations` ADD COLUMN `rateio_closure_version` integer;
--> statement-breakpoint
ALTER TABLE `finance_obligations` ADD COLUMN `rateio_rule_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_obligations` ADD COLUMN `rateio_rule_order` integer;
--> statement-breakpoint
ALTER TABLE `finance_obligations` ADD COLUMN `beneficiary_cpf_snapshot` text;
--> statement-breakpoint
ALTER TABLE `finance_obligations` ADD COLUMN `rateio_gross_cents` integer;
--> statement-breakpoint
ALTER TABLE `finance_obligations` ADD COLUMN `rateio_advance_cents` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `finance_obligations` ADD COLUMN `rateio_adjustment_cents` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `finance_obligations` ADD COLUMN `rateio_adjustment_reason` text;
--> statement-breakpoint
ALTER TABLE `finance_obligations` ADD COLUMN `rateio_cancel_reason` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_obligations_rateio_version_rule_uq` ON `finance_obligations` (`tenant_id`,`rateio_period_id`,`rateio_closure_version`,`rateio_rule_order`);
--> statement-breakpoint
CREATE INDEX `finance_obligations_rateio_person_history_idx` ON `finance_obligations` (`tenant_id`,`person_id`,`rateio_period_id`,`rateio_closure_version`);
--> statement-breakpoint
CREATE INDEX `finance_allocation_rules_person_idx` ON `finance_allocation_rules` (`tenant_id`,`person_id`);
--> statement-breakpoint
CREATE INDEX `finance_period_allocation_rules_person_idx` ON `finance_period_allocation_rules` (`tenant_id`,`period_id`,`person_id`);
--> statement-breakpoint
INSERT INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(36001,NULL,'financeiro-rateio-pagar-pessoa','Rateio — Pagar uma pessoa','Gere Contas a Pagar automáticas para pastor, dirigente ou outra pessoa.','Na configuração do Rateio, escolha Pagar uma pessoa, vincule o cadastro pelo ID interno e defina tipo do beneficiário, descrição e dia sugerido do vencimento. No fechamento, o sistema preserva o valor bruto, considera adiantamentos já lançados, registra ajustes justificados e gera somente o saldo como Conta a Pagar. Reaberturas cancelam apenas obrigações automáticas ainda não pagas e preservam o histórico das versões.','Financeiro',127,'["TODOS"]','FINANCEIRO_RATEIO_VISUALIZAR','/painel/financeiro?aba=rateio',1,1,'2026-08-22','46',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
