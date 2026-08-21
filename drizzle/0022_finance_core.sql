CREATE TABLE `finance_accounts` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `unit_id` integer NOT NULL,
  `name` text NOT NULL, `account_type` text NOT NULL CHECK (`account_type` IN ('CAIXA_FISICO','CONTA_CORRENTE','POUPANCA','PIX','COFRE','CARTEIRA','OUTRO')),
  `institution` text, `initial_balance_cents` integer NOT NULL DEFAULT 0, `initial_balance_date` text NOT NULL,
  `status` text NOT NULL DEFAULT 'ATIVA' CHECK (`status` IN ('ATIVA','INATIVA')), `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL, `updated_at` text NOT NULL,
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`), FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`), UNIQUE (`tenant_id`,`unit_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `finance_accounts_scope_idx` ON `finance_accounts` (`tenant_id`,`unit_id`,`status`,`name`);
--> statement-breakpoint
CREATE TABLE `finance_categories` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `name` text NOT NULL,
  `kind` text NOT NULL CHECK (`kind` IN ('RECEITA','DESPESA')), `participates_allocation` integer NOT NULL DEFAULT 0,
  `requires_fund` integer NOT NULL DEFAULT 0, `status` text NOT NULL DEFAULT 'ATIVA' CHECK (`status` IN ('ATIVA','INATIVA')),
  `created_at` text NOT NULL, `updated_at` text NOT NULL, FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  UNIQUE (`id`,`tenant_id`), UNIQUE (`tenant_id`,`kind`,`name`)
);
--> statement-breakpoint
CREATE INDEX `finance_categories_filter_idx` ON `finance_categories` (`tenant_id`,`kind`,`status`,`name`);
--> statement-breakpoint
CREATE TABLE `finance_payment_methods` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `name` text NOT NULL,
  `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','INATIVO')), `created_at` text NOT NULL, `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`), UNIQUE (`id`,`tenant_id`), UNIQUE (`tenant_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `finance_cost_centers` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `unit_id` integer NOT NULL, `department_id` integer,
  `name` text NOT NULL, `center_type` text NOT NULL CHECK (`center_type` IN ('DEPARTAMENTO','MINISTERIO','EBD','SECRETARIA','OUTRO')),
  `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','INATIVO')), `created_at` text NOT NULL, `updated_at` text NOT NULL,
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`), FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  UNIQUE (`id`,`tenant_id`), UNIQUE (`tenant_id`,`unit_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `finance_funds` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `unit_id` integer NOT NULL, `name` text NOT NULL,
  `restricted` integer NOT NULL DEFAULT 1, `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','INATIVO')),
  `created_at` text NOT NULL, `updated_at` text NOT NULL, FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  UNIQUE (`id`,`tenant_id`), UNIQUE (`tenant_id`,`unit_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `finance_campaigns` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `unit_id` integer NOT NULL, `fund_id` integer,
  `name` text NOT NULL, `description` text, `target_cents` integer, `starts_on` text NOT NULL, `ends_on` text,
  `status` text NOT NULL DEFAULT 'PLANEJADA' CHECK (`status` IN ('PLANEJADA','ATIVA','CONCLUIDA','CANCELADA')),
  `created_by_user_id` integer NOT NULL, `created_at` text NOT NULL, `updated_at` text NOT NULL,
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`), FOREIGN KEY (`fund_id`,`tenant_id`) REFERENCES `finance_funds`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`), UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE INDEX `finance_campaigns_scope_idx` ON `finance_campaigns` (`tenant_id`,`unit_id`,`status`,`starts_on`);
--> statement-breakpoint
CREATE TABLE `person_financial_preferences` (
  `tenant_id` integer NOT NULL, `person_id` integer NOT NULL, `default_privacy` text NOT NULL DEFAULT 'IDENTIFICADA_PRIVADA' CHECK (`default_privacy` IN ('IDENTIFICADA','IDENTIFICADA_PRIVADA')),
  `updated_by_user_id` integer NOT NULL, `updated_at` text NOT NULL,
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`), FOREIGN KEY (`updated_by_user_id`) REFERENCES `auth_users`(`id`), PRIMARY KEY (`tenant_id`,`person_id`)
);
--> statement-breakpoint
CREATE TABLE `finance_movements` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `unit_id` integer NOT NULL, `account_id` integer NOT NULL,
  `direction` text NOT NULL CHECK (`direction` IN ('ENTRADA','SAIDA','TRANSFERENCIA_ENTRADA','TRANSFERENCIA_SAIDA','AJUSTE','ESTORNO')),
  `amount_cents` integer NOT NULL CHECK (`amount_cents` > 0), `occurred_on` text NOT NULL, `competency` text NOT NULL,
  `description` text NOT NULL, `category_id` integer, `payment_method_id` integer, `person_id` integer,
  `cost_center_id` integer, `department_id` integer, `campaign_id` integer, `fund_id` integer,
  `source` text NOT NULL DEFAULT 'MANUAL' CHECK (`source` IN ('MANUAL','EBD','CAMPANHA','CONTA_RECEBER','OUTRO')),
  `source_entity` text, `source_entity_id` integer, `privacy` text NOT NULL DEFAULT 'IDENTIFICADA_PRIVADA' CHECK (`privacy` IN ('ANONIMA','IDENTIFICADA','IDENTIFICADA_PRIVADA')),
  `status` text NOT NULL DEFAULT 'CONFIRMADO' CHECK (`status` IN ('CONFIRMADO','ESTORNADO')), `original_movement_id` integer,
  `transfer_id` integer, `idempotency_key` text, `created_by_user_id` integer NOT NULL, `created_at` text NOT NULL,
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`), FOREIGN KEY (`account_id`,`tenant_id`) REFERENCES `finance_accounts`(`id`,`tenant_id`),
  FOREIGN KEY (`category_id`,`tenant_id`) REFERENCES `finance_categories`(`id`,`tenant_id`), FOREIGN KEY (`payment_method_id`,`tenant_id`) REFERENCES `finance_payment_methods`(`id`,`tenant_id`),
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`), FOREIGN KEY (`cost_center_id`,`tenant_id`) REFERENCES `finance_cost_centers`(`id`,`tenant_id`),
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`), FOREIGN KEY (`campaign_id`,`tenant_id`) REFERENCES `finance_campaigns`(`id`,`tenant_id`),
  FOREIGN KEY (`fund_id`,`tenant_id`) REFERENCES `finance_funds`(`id`,`tenant_id`), FOREIGN KEY (`original_movement_id`,`tenant_id`) REFERENCES `finance_movements`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`), UNIQUE (`id`,`tenant_id`), UNIQUE (`tenant_id`,`idempotency_key`)
);
--> statement-breakpoint
CREATE INDEX `finance_movements_scope_date_idx` ON `finance_movements` (`tenant_id`,`unit_id`,`occurred_on`,`status`);
--> statement-breakpoint
CREATE INDEX `finance_movements_account_idx` ON `finance_movements` (`tenant_id`,`account_id`,`occurred_on`,`id`);
--> statement-breakpoint
CREATE INDEX `finance_movements_filters_idx` ON `finance_movements` (`tenant_id`,`category_id`,`cost_center_id`,`campaign_id`,`fund_id`,`competency`);
--> statement-breakpoint
CREATE TABLE `finance_contributions` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `movement_id` integer NOT NULL, `contribution_type` text NOT NULL CHECK (`contribution_type` IN ('DIZIMO','OFERTA','VOTO','DOACAO','MISSOES','CAMPANHA','OFERTA_VOLUNTARIA','OUTRA')),
  `person_id` integer, `privacy` text NOT NULL CHECK (`privacy` IN ('ANONIMA','IDENTIFICADA','IDENTIFICADA_PRIVADA')), `created_at` text NOT NULL,
  FOREIGN KEY (`movement_id`,`tenant_id`) REFERENCES `finance_movements`(`id`,`tenant_id`), FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  UNIQUE (`id`,`tenant_id`), UNIQUE (`tenant_id`,`movement_id`), CHECK ((`privacy`='ANONIMA' AND `person_id` IS NULL) OR (`privacy`<>'ANONIMA' AND `person_id` IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `finance_contributions_person_idx` ON `finance_contributions` (`tenant_id`,`person_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `finance_obligations` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `unit_id` integer NOT NULL, `kind` text NOT NULL CHECK (`kind` IN ('PAGAR','RECEBER')),
  `description` text NOT NULL, `beneficiary_name` text, `person_id` integer, `category_id` integer, `cost_center_id` integer, `campaign_id` integer, `fund_id` integer,
  `total_cents` integer NOT NULL CHECK (`total_cents` > 0), `competency` text NOT NULL, `status` text NOT NULL DEFAULT 'ABERTA' CHECK (`status` IN ('ABERTA','PARCIAL','QUITADA','CANCELADA')),
  `created_by_user_id` integer NOT NULL, `created_at` text NOT NULL, `updated_at` text NOT NULL,
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`), FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  FOREIGN KEY (`category_id`,`tenant_id`) REFERENCES `finance_categories`(`id`,`tenant_id`), FOREIGN KEY (`cost_center_id`,`tenant_id`) REFERENCES `finance_cost_centers`(`id`,`tenant_id`),
  FOREIGN KEY (`campaign_id`,`tenant_id`) REFERENCES `finance_campaigns`(`id`,`tenant_id`), FOREIGN KEY (`fund_id`,`tenant_id`) REFERENCES `finance_funds`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`), UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `finance_installments` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `obligation_id` integer NOT NULL, `installment_number` integer NOT NULL, `installment_count` integer NOT NULL,
  `due_on` text NOT NULL, `amount_cents` integer NOT NULL CHECK (`amount_cents` > 0), `status` text NOT NULL DEFAULT 'ABERTA' CHECK (`status` IN ('ABERTA','PAGA','RECEBIDA','CANCELADA')),
  `movement_id` integer, `settled_at` text, `created_at` text NOT NULL,
  FOREIGN KEY (`obligation_id`,`tenant_id`) REFERENCES `finance_obligations`(`id`,`tenant_id`), FOREIGN KEY (`movement_id`,`tenant_id`) REFERENCES `finance_movements`(`id`,`tenant_id`),
  UNIQUE (`id`,`tenant_id`), UNIQUE (`tenant_id`,`obligation_id`,`installment_number`), UNIQUE (`tenant_id`,`movement_id`)
);
--> statement-breakpoint
CREATE INDEX `finance_installments_due_idx` ON `finance_installments` (`tenant_id`,`status`,`due_on`);
--> statement-breakpoint
CREATE TABLE `finance_transfers` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `unit_id` integer NOT NULL, `origin_account_id` integer NOT NULL, `destination_account_id` integer NOT NULL,
  `amount_cents` integer NOT NULL CHECK (`amount_cents` > 0), `occurred_on` text NOT NULL, `out_movement_id` integer NOT NULL, `in_movement_id` integer NOT NULL,
  `description` text, `created_by_user_id` integer NOT NULL, `created_at` text NOT NULL,
  FOREIGN KEY (`origin_account_id`,`tenant_id`) REFERENCES `finance_accounts`(`id`,`tenant_id`), FOREIGN KEY (`destination_account_id`,`tenant_id`) REFERENCES `finance_accounts`(`id`,`tenant_id`),
  FOREIGN KEY (`out_movement_id`,`tenant_id`) REFERENCES `finance_movements`(`id`,`tenant_id`), FOREIGN KEY (`in_movement_id`,`tenant_id`) REFERENCES `finance_movements`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`), UNIQUE (`id`,`tenant_id`), CHECK (`origin_account_id` <> `destination_account_id`)
);
--> statement-breakpoint
CREATE TABLE `finance_campaign_pledges` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `campaign_id` integer NOT NULL, `person_id` integer,
  `supporter_name` text, `total_cents` integer NOT NULL CHECK (`total_cents` > 0), `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','CONCLUIDO','CANCELADO')),
  `created_at` text NOT NULL, `updated_at` text NOT NULL, FOREIGN KEY (`campaign_id`,`tenant_id`) REFERENCES `finance_campaigns`(`id`,`tenant_id`),
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`), UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `finance_campaign_pledge_installments` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `pledge_id` integer NOT NULL, `installment_number` integer NOT NULL, `due_on` text NOT NULL,
  `amount_cents` integer NOT NULL CHECK (`amount_cents` > 0), `movement_id` integer, `status` text NOT NULL DEFAULT 'ABERTA' CHECK (`status` IN ('ABERTA','RECEBIDA','CANCELADA')),
  FOREIGN KEY (`pledge_id`,`tenant_id`) REFERENCES `finance_campaign_pledges`(`id`,`tenant_id`), FOREIGN KEY (`movement_id`,`tenant_id`) REFERENCES `finance_movements`(`id`,`tenant_id`),
  UNIQUE (`id`,`tenant_id`), UNIQUE (`tenant_id`,`pledge_id`,`installment_number`), UNIQUE (`tenant_id`,`movement_id`)
);
--> statement-breakpoint
CREATE TABLE `finance_attachments` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `movement_id` integer NOT NULL, `filename` text NOT NULL, `mime_type` text NOT NULL CHECK (`mime_type` IN ('image/jpeg','image/png','image/webp','application/pdf')),
  `size_bytes` integer NOT NULL CHECK (`size_bytes` > 0 AND `size_bytes` <= 5242880), `content` blob NOT NULL, `uploaded_by_user_id` integer NOT NULL, `created_at` text NOT NULL,
  FOREIGN KEY (`movement_id`,`tenant_id`) REFERENCES `finance_movements`(`id`,`tenant_id`), FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `auth_users`(`id`), UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `finance_allocation_rule_drafts` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `category_id` integer NOT NULL, `rule_type` text NOT NULL CHECK (`rule_type` IN ('PERCENTUAL','FIXO','RESTANTE')),
  `status` text NOT NULL DEFAULT 'RASCUNHO' CHECK (`status`='RASCUNHO'), `created_at` text NOT NULL,
  FOREIGN KEY (`category_id`,`tenant_id`) REFERENCES `finance_categories`(`id`,`tenant_id`), UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `finance_audit` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `tenant_id` integer NOT NULL, `unit_id` integer, `actor_user_id` integer NOT NULL, `actor_membership_id` integer,
  `action` text NOT NULL, `entity_type` text NOT NULL, `entity_id` integer NOT NULL, `previous_values` text, `new_values` text, `reason` text, `created_at` text NOT NULL,
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`), FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`), FOREIGN KEY (`actor_membership_id`) REFERENCES `tenant_memberships`(`id`)
);
--> statement-breakpoint
CREATE INDEX `finance_audit_scope_idx` ON `finance_audit` (`tenant_id`,`unit_id`,`created_at`,`action`);
--> statement-breakpoint
WITH `category_seed`(`name`,`kind`,`participates_allocation`,`requires_fund`,`sort_order`) AS (VALUES
('Dízimos','RECEITA',1,0,1),('Ofertas','RECEITA',1,0,2),('Campanhas','RECEITA',0,1,3),('Despesas administrativas','DESPESA',0,0,4),('Missões e ação social','DESPESA',0,0,5)),
`numbered_categories` AS (SELECT t.`id` AS `tenant_id`,s.*,ROW_NUMBER() OVER (ORDER BY t.`id`,s.`sort_order`) AS `sequence` FROM `tenants` t CROSS JOIN `category_seed` s)
INSERT INTO `finance_categories` (`id`,`tenant_id`,`name`,`kind`,`participates_allocation`,`requires_fund`,`created_at`,`updated_at`)
SELECT 220000000+`sequence`,`tenant_id`,`name`,`kind`,`participates_allocation`,`requires_fund`,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM `numbered_categories`;
--> statement-breakpoint
WITH `method_seed`(`name`,`sort_order`) AS (VALUES ('Dinheiro',1),('PIX',2),('Transferência bancária',3),('Cartão',4),('Boleto',5)),
`numbered_methods` AS (SELECT t.`id` AS `tenant_id`,s.*,ROW_NUMBER() OVER (ORDER BY t.`id`,s.`sort_order`) AS `sequence` FROM `tenants` t CROSS JOIN `method_seed` s)
INSERT INTO `finance_payment_methods` (`id`,`tenant_id`,`name`,`created_at`,`updated_at`)
SELECT 221000000+`sequence`,`tenant_id`,`name`,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM `numbered_methods`;
--> statement-breakpoint
WITH `permissions`(`permission`) AS (VALUES ('FINANCEIRO_VISUALIZAR'),('FINANCEIRO_LANCAMENTOS_CRIAR'),('FINANCEIRO_LANCAMENTOS_ESTORNAR'),('FINANCEIRO_CONTRIBUICOES_VISUALIZAR'),('FINANCEIRO_CONTRIBUICOES_GERENCIAR'),('FINANCEIRO_DESPESAS_GERENCIAR'),('FINANCEIRO_CONTAS_PAGAR_GERENCIAR'),('FINANCEIRO_CONTAS_RECEBER_GERENCIAR'),('FINANCEIRO_TRANSFERENCIAS_GERENCIAR'),('FINANCEIRO_CAMPANHAS_GERENCIAR'),('FINANCEIRO_CONTAS_CONFIGURAR'),('FINANCEIRO_CATEGORIAS_CONFIGURAR'),('FINANCEIRO_CONFIGURAR'),('FINANCEIRO_AUDITORIA_VISUALIZAR'))
INSERT OR IGNORE INTO `membership_permissions` (`membership_id`,`permission`,`created_at`) SELECT m.`id`,p.`permission`,CURRENT_TIMESTAMP FROM `tenant_memberships` m CROSS JOIN `permissions` p WHERE m.`status`='ATIVO' AND m.`archived_at` IS NULL AND (m.`role_name` LIKE 'Administrador%' OR m.`scope`='CONVENCAO');
--> statement-breakpoint
WITH `permissions`(`permission`) AS (VALUES ('FINANCEIRO_VISUALIZAR'),('FINANCEIRO_LANCAMENTOS_CRIAR'),('FINANCEIRO_LANCAMENTOS_ESTORNAR'),('FINANCEIRO_CONTRIBUICOES_VISUALIZAR'),('FINANCEIRO_CONTRIBUICOES_GERENCIAR'),('FINANCEIRO_DESPESAS_GERENCIAR'),('FINANCEIRO_CONTAS_PAGAR_GERENCIAR'),('FINANCEIRO_CONTAS_RECEBER_GERENCIAR'),('FINANCEIRO_TRANSFERENCIAS_GERENCIAR'),('FINANCEIRO_CAMPANHAS_GERENCIAR'),('FINANCEIRO_CONTAS_CONFIGURAR'),('FINANCEIRO_CATEGORIAS_CONFIGURAR'),('FINANCEIRO_CONFIGURAR'),('FINANCEIRO_AUDITORIA_VISUALIZAR'))
INSERT OR IGNORE INTO `user_permissions` (`user_id`,`permission`,`created_at`) SELECT o.`user_id`,p.`permission`,CURRENT_TIMESTAMP FROM `platform_owners` o CROSS JOIN `permissions` p;
--> statement-breakpoint
INSERT INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(22001,NULL,'financeiro-novo-modulo','Novo módulo Financeiro','Conheça a base financeira integrada do NexIgreja.','O Financeiro separa movimentos, contribuições, contas, categorias, centros de custo, fundos, competência e privacidade. Acesse a visão geral para começar.','Financeiro',1,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_VISUALIZAR','/painel/financeiro',1,1,CURRENT_TIMESTAMP,'32',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(22002,NULL,'financeiro-primeiros-passos','Primeiros passos','Configure contas, categorias e formas de pagamento.','Cadastre ao menos uma conta por unidade e confira as categorias e formas de pagamento iniciais antes do primeiro lançamento.','Financeiro',2,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CONFIGURAR','/painel/financeiro?aba=configuracoes',1,0,CURRENT_TIMESTAMP,'32',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(22003,NULL,'financeiro-contas-saldos','Contas e saldos','Entenda saldo inicial e saldo derivado.','O saldo inicial é auditado. Depois dele, o saldo é sempre calculado pelos movimentos confirmados; transferências não viram receita ou despesa.','Financeiro',3,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CONTAS_CONFIGURAR','/painel/financeiro?aba=contas',1,0,CURRENT_TIMESTAMP,'32',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(22004,NULL,'financeiro-lancamentos','Lançamentos financeiros','Registre entradas e saídas com competência.','Informe ocorrência, competência, conta, categoria e valor em centavos. Anexos aceitam imagem ou PDF de até 5 MB.','Financeiro',4,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_LANCAMENTOS_CRIAR','/painel/financeiro?aba=lancamentos',1,0,CURRENT_TIMESTAMP,'32',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(22005,NULL,'financeiro-contribuicoes','Contribuições','Registre dízimos, ofertas e doações sem misturar conceitos.','A contribuição mantém sua natureza própria e aponta para um movimento de entrada. Pode ser anônima, identificada ou identificada privada.','Financeiro',5,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CONTRIBUICOES_GERENCIAR','/painel/financeiro?aba=contribuicoes',1,0,CURRENT_TIMESTAMP,'32',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(22006,NULL,'financeiro-privacidade','Privacidade financeira','Proteja a identidade do contribuinte.','A preferência da Pessoa sugere a privacidade, mas cada contribuição pode ser definida separadamente. Relatórios públicos devem anonimizar no servidor.','Financeiro',6,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CONTRIBUICOES_VISUALIZAR','/painel/financeiro?aba=contribuicoes',1,0,CURRENT_TIMESTAMP,'32',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(22007,NULL,'financeiro-despesas','Despesas','Registre beneficiário, centro de custo e fundo.','Despesas podem usar beneficiário livre ou Pessoa vinculada e podem nascer diretamente ou por uma conta a pagar.','Financeiro',7,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_DESPESAS_GERENCIAR','/painel/financeiro?aba=despesas',1,0,CURRENT_TIMESTAMP,'32',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(22008,NULL,'financeiro-contas-pagar','Contas a pagar','Acompanhe parcelas e vencimentos.','Crie a obrigação e suas parcelas. Ao pagar, o sistema cria exatamente um movimento e vincula a parcela de modo idempotente.','Financeiro',8,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CONTAS_PAGAR_GERENCIAR','/painel/financeiro?aba=pagar',1,0,CURRENT_TIMESTAMP,'32',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(22009,NULL,'financeiro-contas-receber','Contas a receber','Acompanhe cobranças e recebimentos.','O recebimento de uma parcela gera um único movimento de entrada e atualiza a situação da obrigação.','Financeiro',9,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CONTAS_RECEBER_GERENCIAR','/painel/financeiro?aba=receber',1,0,CURRENT_TIMESTAMP,'32',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(22010,NULL,'financeiro-transferencias','Transferências entre contas','Mova valores sem inflar receitas e despesas.','A transferência cria dois movimentos relacionados: saída na origem e entrada no destino. As duas contas devem ser diferentes e pertencer ao mesmo escopo.','Financeiro',10,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_TRANSFERENCIAS_GERENCIAR','/painel/financeiro?aba=transferencias',1,0,CURRENT_TIMESTAMP,'32',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(22011,NULL,'financeiro-campanhas','Campanhas e compromissos','Acompanhe meta, arrecadação e promessas.','Campanhas podem receber contribuições e compromissos parcelados. O resumo operacional separa prometido, recebido e saldo da meta.','Financeiro',11,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CAMPANHAS_GERENCIAR','/painel/financeiro?aba=campanhas',1,0,CURRENT_TIMESTAMP,'32',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(22012,NULL,'financeiro-fundos','Fundos restritos','Diferencie saldo físico, vinculado e livre.','O saldo físico está nas contas. O saldo vinculado pertence a fundos restritos; o saldo livre desconta esses compromissos.','Financeiro',12,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CAMPANHAS_GERENCIAR','/painel/financeiro?aba=campanhas',1,0,CURRENT_TIMESTAMP,'32',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(22013,NULL,'financeiro-estornos','Estornos auditáveis','Corrija sem apagar movimentos.','Movimentos confirmados não são excluídos. O estorno exige justificativa, cria movimento inverso e preserva o original e a auditoria.','Financeiro',13,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_LANCAMENTOS_ESTORNAR','/painel/financeiro?aba=lancamentos',1,0,CURRENT_TIMESTAMP,'32',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(22014,NULL,'financeiro-centros-custo','Centros de custo','Atribua despesas à operação correta.','Use departamentos, ministérios, EBD, Secretaria ou centros livres para análise operacional sem confundir com a categoria contábil.','Financeiro',14,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CONFIGURAR','/painel/financeiro?aba=configuracoes',1,0,CURRENT_TIMESTAMP,'32',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(22015,NULL,'financeiro-rateio-futuro','Base para rateios futuros','Entenda o que já está preparado.','A categoria pode participar de rateio e a estrutura admite percentual, valor fixo ou restante. A execução e os percentuais serão entregues em fase futura.','Financeiro',15,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CONFIGURAR','/painel/financeiro?aba=configuracoes',1,0,CURRENT_TIMESTAMP,'32',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
