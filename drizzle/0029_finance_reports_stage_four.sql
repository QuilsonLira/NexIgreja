CREATE TABLE `finance_report_models` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `unit_id` integer,
  `name` text NOT NULL,
  `description` text,
  `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','ARQUIVADO')),
  `is_default` integer NOT NULL DEFAULT 0,
  `current_version` integer NOT NULL DEFAULT 1,
  `created_by_user_id` integer NOT NULL,
  `updated_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  FOREIGN KEY (`updated_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE INDEX `finance_report_models_scope_idx` ON `finance_report_models` (`tenant_id`,`unit_id`,`status`,`is_default`,`name`);
--> statement-breakpoint
CREATE TABLE `finance_report_model_versions` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `model_id` integer NOT NULL,
  `version` integer NOT NULL,
  `config_snapshot_json` text NOT NULL,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`model_id`,`tenant_id`) REFERENCES `finance_report_models`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`model_id`,`version`)
);
--> statement-breakpoint
CREATE INDEX `finance_report_model_versions_idx` ON `finance_report_model_versions` (`tenant_id`,`model_id`,`version`);
--> statement-breakpoint
CREATE TABLE `finance_reports` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `unit_id` integer NOT NULL,
  `period_id` integer NOT NULL,
  `closure_id` integer,
  `closure_version` integer,
  `report_type` text NOT NULL CHECK (`report_type` IN ('OFICIAL_CAIXA','ENTRADAS','SAIDAS','CONTRIBUICOES','RATEIO','CAMPANHAS_FUNDOS')),
  `version` integer NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('PRELIMINAR','OFICIAL','SUBSTITUIDO_POR_NOVA_VERSAO','HISTORICO')),
  `model_id` integer,
  `model_version` integer NOT NULL,
  `model_snapshot_json` text NOT NULL,
  `report_snapshot_json` text NOT NULL,
  `generated_by_user_id` integer NOT NULL,
  `generated_at` text NOT NULL,
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`period_id`,`tenant_id`) REFERENCES `finance_periods`(`id`,`tenant_id`),
  FOREIGN KEY (`closure_id`,`tenant_id`) REFERENCES `finance_closure_versions`(`id`,`tenant_id`),
  FOREIGN KEY (`model_id`,`tenant_id`) REFERENCES `finance_report_models`(`id`,`tenant_id`),
  FOREIGN KEY (`generated_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`period_id`,`report_type`,`version`)
);
--> statement-breakpoint
CREATE INDEX `finance_reports_history_idx` ON `finance_reports` (`tenant_id`,`unit_id`,`period_id`,`report_type`,`status`,`version`);
--> statement-breakpoint
CREATE INDEX `finance_reports_closure_idx` ON `finance_reports` (`tenant_id`,`closure_id`,`closure_version`);
--> statement-breakpoint
WITH `permissions`(`permission`) AS (VALUES
('FINANCEIRO_RELATORIOS_VISUALIZAR'),('FINANCEIRO_RELATORIOS_GERAR'),('FINANCEIRO_RELATORIOS_IMPRIMIR'),('FINANCEIRO_RELATORIOS_EXPORTAR'),('FINANCEIRO_RELATORIOS_MODELOS_VISUALIZAR'),('FINANCEIRO_RELATORIOS_MODELOS_CONFIGURAR'))
INSERT OR IGNORE INTO `membership_permissions` (`membership_id`,`permission`,`created_at`)
SELECT m.`id`,p.`permission`,CURRENT_TIMESTAMP FROM `tenant_memberships` m CROSS JOIN `permissions` p
WHERE m.`status`='ATIVO' AND m.`archived_at` IS NULL AND EXISTS(SELECT 1 FROM `membership_permissions` fp WHERE fp.`membership_id`=m.`id` AND fp.`permission`='FINANCEIRO_VISUALIZAR');
--> statement-breakpoint
WITH `permissions`(`permission`) AS (VALUES
('FINANCEIRO_RELATORIOS_VISUALIZAR'),('FINANCEIRO_RELATORIOS_GERAR'),('FINANCEIRO_RELATORIOS_IMPRIMIR'),('FINANCEIRO_RELATORIOS_EXPORTAR'),('FINANCEIRO_RELATORIOS_MODELOS_VISUALIZAR'),('FINANCEIRO_RELATORIOS_MODELOS_CONFIGURAR'))
INSERT OR IGNORE INTO `user_permissions` (`user_id`,`permission`,`created_at`)
SELECT o.`user_id`,p.`permission`,CURRENT_TIMESTAMP FROM `platform_owners` o CROSS JOIN `permissions` p;
--> statement-breakpoint
INSERT INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(29001,NULL,'financeiro-central-relatorios','Central de Relatórios','Escolha unidade, competência, relatório e modelo.','A Central reúne relatórios de caixa, entradas, saídas, contribuições, rateio, campanhas e fundos. Os filtros respeitam tenant, unidade e permissões.','Financeiro',90,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29002,NULL,'financeiro-relatorio-oficial-caixa','Relatório Oficial de Caixa','Consolide o fechamento financeiro mensal.','O relatório oficial utiliza a versão fechada da competência e apresenta entradas, exclusões, base do rateio, divisões, saídas e saldos.','Financeiro',91,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29003,NULL,'financeiro-previa-caixa','Como gerar uma prévia do caixa','Visualize números enquanto o período está aberto.','Selecione um caixa aberto e use Visualizar. A marca Relatório Preliminar indica que os valores ainda podem mudar.','Financeiro',92,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29004,NULL,'financeiro-preliminar-oficial','Relatório Preliminar x Relatório Oficial','Entenda quando os dados ficam congelados.','O preliminar acompanha o caixa aberto. O oficial só é gerado para um fechamento e guarda snapshots do relatório e do modelo.','Financeiro',93,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29005,NULL,'financeiro-saldo-anterior-relatorio','Como interpretar o saldo anterior','O valor vem do histórico financeiro anterior.','O saldo anterior deriva dos saldos iniciais das contas e dos movimentos anteriores à competência. Ele não pode ser alterado apenas no relatório.','Financeiro',94,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29006,NULL,'financeiro-saldo-atual-relatorio','Como interpretar o saldo atual','Veja o recurso físico após entradas e saídas.','Saldo financeiro atual é o saldo anterior somado às entradas e reduzido pelas saídas operacionais, sem inflar os números com transferências internas.','Financeiro',95,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29007,NULL,'financeiro-recursos-vinculados-relatorio','Recursos vinculados','Campanhas e fundos permanecem separados.','Recursos vinculados existem financeiramente, mas possuem destinação própria e por isso aparecem separados do saldo livre.','Financeiro',96,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29008,NULL,'financeiro-valores-comprometidos-rateio','Valores comprometidos com Rateio','Diferencie cálculo, repasse e saldo.','O relatório mostra valor calculado, valor efetivamente repassado e valor ainda a repassar. O cálculo não cria movimentação bancária automática.','Financeiro',97,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29009,NULL,'financeiro-saldo-livre-relatorio','Saldo livre','Consulte o valor sem vinculações ou compromissos.','Saldo livre considera o saldo financeiro, os recursos vinculados e apenas o que ainda está a repassar, evitando desconto duplicado.','Financeiro',98,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29010,NULL,'financeiro-relatorio-entradas','Relatório de Entradas','Agrupe e detalhe receitas da competência.','Use os filtros de competência, conta e unidade. Transferências internas não são consideradas entradas operacionais.','Financeiro',99,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29011,NULL,'financeiro-relatorio-saidas','Relatório de Saídas','Consulte despesas por categoria.','O relatório de saídas mostra categorias, contas, beneficiários e valores do período sem contar transferências internas como despesas.','Financeiro',100,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29012,NULL,'financeiro-relatorio-contribuicoes','Relatório de Contribuições','Consulte dízimos, ofertas e demais contribuições.','Contribuições identificadas privadas e anônimas aparecem como Anônimo na apresentação pública do relatório.','Financeiro',101,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29013,NULL,'financeiro-relatorio-rateio','Relatório de Rateio','Veja base, regras e repasses.','O relatório usa o snapshot da competência e detalha Percentual, Valor Fixo, Saldo Restante, calculado, repassado e a repassar.','Financeiro',102,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29014,NULL,'financeiro-relatorio-campanhas-fundos','Relatório de Campanhas e Fundos','Acompanhe metas e saldos vinculados.','Consulte meta, arrecadado, gasto, compromissos e saldo vinculado das campanhas e fundos da unidade.','Financeiro',103,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29015,NULL,'financeiro-criar-modelo-relatorio','Como criar um modelo de relatório','Personalize a apresentação com blocos seguros.','Crie um nome, escolha unidade ou escopo geral, configure título, logo, orientação, margens, seções e assinaturas.','Financeiro',104,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_MODELOS_CONFIGURAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29016,NULL,'financeiro-alterar-titulos-relatorio','Como alterar títulos','Renomeie a apresentação sem mudar os cálculos.','O editor permite alterar o título principal e os rótulos das seções. A semântica financeira e os cálculos permanecem protegidos.','Financeiro',105,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_MODELOS_CONFIGURAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29017,NULL,'financeiro-reorganizar-secoes-relatorio','Como reorganizar seções','Use Subir e Descer para ordenar blocos.','A ordem visual pode ser alterada pelos controles do editor. Nenhum bloco executa código ou fórmula livre.','Financeiro',106,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_MODELOS_CONFIGURAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29018,NULL,'financeiro-logo-relatorio','Como adicionar uma logo','Use a identidade já cadastrada.','Escolha a logo da instituição, da unidade ou nenhuma logo. O relatório reutiliza imagens cadastradas com acesso protegido.','Financeiro',107,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_MODELOS_CONFIGURAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29019,NULL,'financeiro-assinaturas-relatorio','Como configurar assinaturas','Inclua responsáveis no rodapé.','Adicione nomes e funções opcionais. O campo Gerado por não é editável e sempre vem do usuário autenticado.','Financeiro',108,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_MODELOS_CONFIGURAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29020,NULL,'financeiro-gerar-pdf-relatorio','Como gerar PDF','Use o formato A4 configurado no modelo.','Clique em Gerar PDF e escolha Salvar como PDF na janela do navegador. A impressão respeita orientação, margens e blocos do modelo.','Financeiro',109,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_GERAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29021,NULL,'financeiro-imprimir-relatorio','Como imprimir','Imprima somente o documento financeiro.','O modo de impressão remove menu, filtros, botões e controles, preservando o relatório A4.','Financeiro',110,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_IMPRIMIR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29022,NULL,'financeiro-historico-relatorios','Como funciona o histórico','Consulte versões sem apagar documentos antigos.','O histórico lista unidade, competência, status, versão, usuário, data e modelo usado em cada geração.','Financeiro',111,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29023,NULL,'financeiro-versionamento-relatorios','Como funciona o versionamento','Fechamentos e modelos mantêm versões imutáveis.','Reabrir e fechar novamente cria novo fechamento. Alterar o modelo cria nova versão. Relatórios antigos continuam usando seus próprios snapshots.','Financeiro',112,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(29024,NULL,'financeiro-nova-central-relatorios','Nova Central de Relatórios Financeiros','Relatório Oficial, saldos, modelos, PDF e histórico.','O NexIgreja agora possui uma área completa de relatórios financeiros, com Relatório Oficial de Caixa, visualização de saldos, entradas, saídas, rateios, recursos vinculados, modelos personalizados, PDF e histórico versionado.','Novidades',3,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,1,CURRENT_TIMESTAMP,'40',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
