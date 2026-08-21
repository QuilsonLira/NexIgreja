CREATE TABLE `finance_allocation_configs` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `unit_id` integer NOT NULL,
  `version` integer NOT NULL DEFAULT 1,
  `status` text NOT NULL DEFAULT 'ATIVA' CHECK (`status` IN ('ATIVA','INATIVA')),
  `created_by_user_id` integer NOT NULL,
  `updated_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  FOREIGN KEY (`updated_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`unit_id`)
);
--> statement-breakpoint
CREATE INDEX `finance_allocation_configs_scope_idx` ON `finance_allocation_configs` (`tenant_id`,`unit_id`,`status`);
--> statement-breakpoint
CREATE TABLE `finance_allocation_rules` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `config_id` integer NOT NULL,
  `recipient_name` text NOT NULL,
  `description` text,
  `recipient_type` text NOT NULL CHECK (`recipient_type` IN ('PASTOR','VICE_PASTOR','DIRIGENTE','MATRIZ','CONVENCAO','IGREJA','CONGREGACAO','ASSISTENCIA','MISSOES','FUNDO','OUTRO')),
  `rule_type` text NOT NULL DEFAULT 'PERCENTUAL' CHECK (`rule_type` IN ('PERCENTUAL','FIXO','RESTANTE')),
  `percentage_basis_points` integer CHECK (`percentage_basis_points` IS NULL OR (`percentage_basis_points` >= 0 AND `percentage_basis_points` <= 10000)),
  `fixed_amount_cents` integer,
  `calculation_base` text NOT NULL DEFAULT 'RECEITAS_PARTICIPANTES',
  `display_order` integer NOT NULL,
  `active` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`config_id`,`tenant_id`) REFERENCES `finance_allocation_configs`(`id`,`tenant_id`),
  UNIQUE (`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`config_id`,`display_order`)
);
--> statement-breakpoint
CREATE INDEX `finance_allocation_rules_config_idx` ON `finance_allocation_rules` (`tenant_id`,`config_id`,`active`,`display_order`);
--> statement-breakpoint
CREATE TABLE `finance_periods` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `unit_id` integer NOT NULL,
  `unit_type` text NOT NULL CHECK (`unit_type` IN ('MATRIZ','FILIAL')),
  `matrix_id` integer NOT NULL,
  `branch_id` integer,
  `competency` text NOT NULL CHECK (`competency` GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  `status` text NOT NULL DEFAULT 'ABERTO' CHECK (`status` IN ('ABERTO','FECHADO')),
  `lifecycle_state` text NOT NULL DEFAULT 'ABERTO' CHECK (`lifecycle_state` IN ('ABERTO','REABERTO','FECHADO')),
  `allocation_config_id` integer NOT NULL,
  `allocation_config_version` integer NOT NULL,
  `opened_at` text NOT NULL,
  `opened_by_user_id` integer NOT NULL,
  `closed_at` text,
  `closed_by_user_id` integer,
  `reopened_at` text,
  `reopened_by_user_id` integer,
  `reopen_reason` text,
  `reopen_count` integer NOT NULL DEFAULT 0,
  `closure_version` integer NOT NULL DEFAULT 0,
  `notes` text,
  `version` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`matrix_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`branch_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`allocation_config_id`,`tenant_id`) REFERENCES `finance_allocation_configs`(`id`,`tenant_id`),
  FOREIGN KEY (`opened_by_user_id`) REFERENCES `auth_users`(`id`),
  FOREIGN KEY (`closed_by_user_id`) REFERENCES `auth_users`(`id`),
  FOREIGN KEY (`reopened_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`unit_id`,`competency`),
  CHECK ((`unit_type`='MATRIZ' AND `branch_id` IS NULL AND `unit_id`=`matrix_id`) OR (`unit_type`='FILIAL' AND `branch_id`=`unit_id`))
);
--> statement-breakpoint
CREATE INDEX `finance_periods_scope_competency_idx` ON `finance_periods` (`tenant_id`,`matrix_id`,`branch_id`,`competency`,`status`);
--> statement-breakpoint
CREATE INDEX `finance_periods_unit_status_idx` ON `finance_periods` (`tenant_id`,`unit_id`,`status`,`competency`);
--> statement-breakpoint
CREATE TABLE `finance_period_allocation_rules` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `period_id` integer NOT NULL,
  `source_rule_id` integer NOT NULL,
  `recipient_name` text NOT NULL,
  `description` text,
  `recipient_type` text NOT NULL,
  `rule_type` text NOT NULL,
  `percentage_basis_points` integer,
  `fixed_amount_cents` integer,
  `calculation_base` text NOT NULL,
  `participating_category_ids_json` text NOT NULL DEFAULT '[]',
  `display_order` integer NOT NULL,
  `snapshot_version` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`period_id`,`tenant_id`) REFERENCES `finance_periods`(`id`,`tenant_id`),
  UNIQUE (`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`period_id`,`display_order`)
);
--> statement-breakpoint
CREATE INDEX `finance_period_rules_period_idx` ON `finance_period_allocation_rules` (`tenant_id`,`period_id`,`display_order`);
--> statement-breakpoint
CREATE TABLE `finance_period_reopenings` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `period_id` integer NOT NULL,
  `reopen_number` integer NOT NULL,
  `previous_status` text NOT NULL,
  `reason` text NOT NULL,
  `reopened_by_user_id` integer NOT NULL,
  `actor_scope` text NOT NULL,
  `actor_matrix_id` integer NOT NULL,
  `reopened_at` text NOT NULL,
  FOREIGN KEY (`period_id`,`tenant_id`) REFERENCES `finance_periods`(`id`,`tenant_id`),
  FOREIGN KEY (`reopened_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`period_id`,`reopen_number`)
);
--> statement-breakpoint
CREATE INDEX `finance_period_reopenings_history_idx` ON `finance_period_reopenings` (`tenant_id`,`period_id`,`reopen_number`,`reopened_at`);
--> statement-breakpoint
CREATE TABLE `finance_closure_versions` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `period_id` integer NOT NULL,
  `version` integer NOT NULL,
  `total_entries_cents` integer NOT NULL,
  `total_expenses_cents` integer NOT NULL,
  `restricted_resources_cents` integer NOT NULL,
  `balance_cents` integer NOT NULL,
  `movement_count` integer NOT NULL,
  `rules_snapshot_json` text NOT NULL,
  `totals_snapshot_json` text NOT NULL,
  `closed_by_user_id` integer NOT NULL,
  `closed_at` text NOT NULL,
  FOREIGN KEY (`period_id`,`tenant_id`) REFERENCES `finance_periods`(`id`,`tenant_id`),
  FOREIGN KEY (`closed_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`period_id`,`version`)
);
--> statement-breakpoint
CREATE INDEX `finance_closure_versions_period_idx` ON `finance_closure_versions` (`tenant_id`,`period_id`,`version`);
--> statement-breakpoint
CREATE TABLE `finance_quick_sessions` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `period_id` integer NOT NULL,
  `unit_id` integer NOT NULL,
  `user_id` integer NOT NULL,
  `account_id` integer NOT NULL,
  `default_date` text NOT NULL,
  `default_competency` text NOT NULL,
  `default_contribution_type` text NOT NULL,
  `default_payment_method_id` integer,
  `status` text NOT NULL DEFAULT 'EM_ANDAMENTO' CHECK (`status` IN ('EM_ANDAMENTO','FINALIZADA','CANCELADA')),
  `entry_count` integer NOT NULL DEFAULT 0,
  `total_cents` integer NOT NULL DEFAULT 0,
  `started_at` text NOT NULL,
  `finished_at` text,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`period_id`,`tenant_id`) REFERENCES `finance_periods`(`id`,`tenant_id`),
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`account_id`,`tenant_id`) REFERENCES `finance_accounts`(`id`,`tenant_id`),
  FOREIGN KEY (`default_payment_method_id`,`tenant_id`) REFERENCES `finance_payment_methods`(`id`,`tenant_id`),
  FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE INDEX `finance_quick_sessions_resume_idx` ON `finance_quick_sessions` (`tenant_id`,`user_id`,`period_id`,`status`,`updated_at`);
--> statement-breakpoint
ALTER TABLE `finance_movements` ADD COLUMN `period_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_movements` ADD COLUMN `quick_session_id` integer;
--> statement-breakpoint
CREATE INDEX `finance_movements_period_idx` ON `finance_movements` (`tenant_id`,`period_id`,`occurred_on`,`id`);
--> statement-breakpoint
CREATE INDEX `finance_movements_quick_session_idx` ON `finance_movements` (`tenant_id`,`quick_session_id`,`id`);
--> statement-breakpoint
WITH `permissions`(`permission`) AS (VALUES
('FINANCEIRO_CAIXA_ABRIR'),('FINANCEIRO_CAIXA_FECHAR'),('FINANCEIRO_CAIXA_REABRIR'),('FINANCEIRO_RATEIO_VISUALIZAR'),('FINANCEIRO_RATEIO_CONFIGURAR'),('FINANCEIRO_RATEIO_PERIODO_ALTERAR'),('FINANCEIRO_LANCAMENTO_RAPIDO'))
INSERT OR IGNORE INTO `membership_permissions` (`membership_id`,`permission`,`created_at`)
SELECT m.`id`,p.`permission`,CURRENT_TIMESTAMP FROM `tenant_memberships` m CROSS JOIN `permissions` p
WHERE m.`status`='ATIVO' AND m.`archived_at` IS NULL AND m.`scope` IN ('CONVENCAO','MATRIZ') AND m.`role_name` LIKE 'Administrador%';
--> statement-breakpoint
WITH `permissions`(`permission`) AS (VALUES
('FINANCEIRO_CAIXA_ABRIR'),('FINANCEIRO_CAIXA_FECHAR'),('FINANCEIRO_RATEIO_VISUALIZAR'),('FINANCEIRO_RATEIO_CONFIGURAR'),('FINANCEIRO_LANCAMENTO_RAPIDO'))
INSERT OR IGNORE INTO `user_permissions` (`user_id`,`permission`,`created_at`)
SELECT o.`user_id`,p.`permission`,CURRENT_TIMESTAMP FROM `platform_owners` o CROSS JOIN `permissions` p;
--> statement-breakpoint
INSERT INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(23001,NULL,'financeiro-novo-fluxo-caixa','Novo fluxo de Caixa Financeiro','Períodos mensais, rateio por unidade e lançamento rápido.','Agora o NexIgreja permite abrir períodos financeiros, configurar rateios específicos por unidade, realizar lançamentos rápidos em tela cheia e bloquear alterações após o fechamento.','Financeiro',16,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=caixa',1,1,CURRENT_TIMESTAMP,'34',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(23002,NULL,'financeiro-abrir-caixa','Como abrir um caixa','Abra uma competência com senha e regras próprias.','Selecione a unidade e a competência, confira o snapshot do rateio e confirme sua senha. O responsável é sempre o usuário autenticado.','Financeiro',17,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CAIXA_ABRIR','/painel/financeiro?aba=caixa',1,0,CURRENT_TIMESTAMP,'34',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(23003,NULL,'financeiro-competencia-mensal','Como funciona a competência mensal','Separe mês de referência e data de recebimento.','A competência define o mês financeiro. A data de abertura ou de recebimento pode ser posterior sem alterar o mês ao qual o valor pertence.','Financeiro',18,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=caixa',1,0,CURRENT_TIMESTAMP,'34',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(23004,NULL,'financeiro-configurar-percentuais','Como configurar percentuais de rateio','Monte divisões que totalizam exatamente 100%.','Cadastre destinatários personalizados, ordene as divisões e informe percentuais. A soma integral percentual precisa resultar em 100%.','Financeiro',19,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RATEIO_CONFIGURAR','/painel/financeiro?aba=rateio',1,0,CURRENT_TIMESTAMP,'34',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(23005,NULL,'financeiro-rateio-por-unidade','Como configurar rateio individual por Matriz ou Filial','Cada unidade mantém sua própria configuração.','Selecione a unidade desejada. Filiais não herdam obrigatoriamente a regra da Matriz; cada configuração é independente e novos períodos recebem um snapshot.','Financeiro',20,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RATEIO_VISUALIZAR','/painel/financeiro?aba=rateio',1,0,CURRENT_TIMESTAMP,'34',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(23006,NULL,'financeiro-lancamento-rapido','Como usar o Lançamento Rápido','Salve contribuições em sequência e retome lotes.','Defina conta, data, competência, tipo e forma padrão. Cada linha é salva progressivamente e uma sessão em andamento pode ser retomada.','Financeiro',21,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_LANCAMENTO_RAPIDO','/painel/financeiro/rapido',1,0,CURRENT_TIMESTAMP,'34',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(23007,NULL,'financeiro-dizimos-teclado','Como lançar vários dízimos pelo teclado','Use Enter, F2, F4 e Ctrl+Enter.','Digite ou pesquise a Pessoa, pressione Enter, informe o valor e confirme. F2 volta à busca, F4 marca anônimo e Ctrl+Enter cria a próxima linha.','Financeiro',22,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_LANCAMENTO_RAPIDO','/painel/financeiro/rapido',1,0,CURRENT_TIMESTAMP,'34',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(23008,NULL,'financeiro-mascara-valores','Como funciona a máscara de valores','Digite centavos sem pontos e vírgulas.','No lançamento rápido, 1250 vira R$ 12,50. Valores colados como 1.250,50 ou R$ 1.250,50 também são normalizados e armazenados em centavos inteiros.','Financeiro',23,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_VISUALIZAR','/painel/financeiro/rapido',1,0,CURRENT_TIMESTAMP,'34',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(23009,NULL,'financeiro-fechar-caixa','Como fechar um caixa','Confira totais, regras e confirme sua senha.','O fechamento registra uma versão imutável dos totais e regras. Finalizar um lote de lançamento rápido não fecha o período mensal.','Financeiro',24,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CAIXA_FECHAR','/painel/financeiro?aba=caixa',1,0,CURRENT_TIMESTAMP,'34',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(23010,NULL,'financeiro-apos-fechamento','O que acontece após o fechamento','O servidor bloqueia operações no período.','Após o fechamento, novas entradas, saídas, pagamentos, transferências e estornos são negados, inclusive por chamada direta à API.','Financeiro',25,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=caixa',1,0,CURRENT_TIMESTAMP,'34',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(23011,NULL,'financeiro-reabrir-caixa','Como funciona a reabertura','Correção excepcional com senha, motivo e histórico.','Somente administrador autorizado da Matriz pode reabrir sua Matriz ou Filial subordinada. A Filial não pode reabrir, e cada novo fechamento preserva as versões anteriores.','Financeiro',26,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CAIXA_REABRIR','/painel/financeiro?aba=caixa',1,0,CURRENT_TIMESTAMP,'34',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
