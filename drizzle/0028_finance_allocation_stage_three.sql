CREATE TABLE `finance_allocation_config_versions` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `unit_id` integer NOT NULL,
  `config_id` integer NOT NULL,
  `version` integer NOT NULL,
  `rules_snapshot_json` text NOT NULL,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`config_id`,`tenant_id`) REFERENCES `finance_allocation_configs`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`config_id`,`version`)
);
--> statement-breakpoint
CREATE INDEX `finance_allocation_config_versions_scope_idx` ON `finance_allocation_config_versions` (`tenant_id`,`unit_id`,`version`);
--> statement-breakpoint
CREATE TABLE `finance_period_allocation_rule_versions` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `period_id` integer NOT NULL,
  `snapshot_version` integer NOT NULL,
  `rules_snapshot_json` text NOT NULL,
  `change_reason` text,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`period_id`,`tenant_id`) REFERENCES `finance_periods`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`period_id`,`snapshot_version`)
);
--> statement-breakpoint
CREATE INDEX `finance_period_rule_versions_idx` ON `finance_period_allocation_rule_versions` (`tenant_id`,`period_id`,`snapshot_version`);
--> statement-breakpoint
CREATE TABLE `finance_period_allocation_results` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `period_id` integer NOT NULL,
  `closure_version` integer NOT NULL DEFAULT 0,
  `snapshot_version` integer NOT NULL,
  `source_rule_id` integer,
  `recipient_name` text NOT NULL,
  `rule_type` text NOT NULL CHECK (`rule_type` IN ('PERCENTUAL','FIXO','RESTANTE')),
  `percentage_basis_points` integer,
  `fixed_amount_cents` integer,
  `eligible_base_cents` integer NOT NULL,
  `calculated_amount_cents` integer NOT NULL,
  `transferred_amount_cents` integer NOT NULL DEFAULT 0,
  `remaining_transfer_cents` integer NOT NULL,
  `display_order` integer NOT NULL,
  `calculated_at` text NOT NULL,
  FOREIGN KEY (`period_id`,`tenant_id`) REFERENCES `finance_periods`(`id`,`tenant_id`),
  UNIQUE (`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`period_id`,`closure_version`,`display_order`)
);
--> statement-breakpoint
CREATE INDEX `finance_period_allocation_results_idx` ON `finance_period_allocation_results` (`tenant_id`,`period_id`,`closure_version`,`display_order`);
--> statement-breakpoint
ALTER TABLE `finance_closure_versions` ADD COLUMN `eligible_base_cents` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `finance_closure_versions` ADD COLUMN `excluded_resources_cents` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `finance_closure_versions` ADD COLUMN `allocated_cents` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `finance_closure_versions` ADD COLUMN `unallocated_cents` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `finance_closure_versions` ADD COLUMN `allocation_results_json` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
INSERT INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(28001,NULL,'financeiro-rateio-conceito','O que é Rateio','Entenda a divisão calculada da base elegível.','Rateio é a divisão calculada das receitas elegíveis de uma competência. Ele não cria saída bancária automática e mantém separado o valor calculado, o valor já repassado e o saldo a repassar.','Financeiro',70,'["TODOS"]','FINANCEIRO_RATEIO_VISUALIZAR','/painel/financeiro?aba=rateio',1,0,CURRENT_TIMESTAMP,'39',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(28002,NULL,'financeiro-rateio-configurar','Como configurar o Rateio','Crie uma regra padrão própria para cada unidade.','Escolha a Matriz ou Filial, adicione destinatários livres, defina Percentual, Valor Fixo ou Saldo Restante, ajuste a ordem e salve. A regra será o modelo dos próximos caixas.','Financeiro',71,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RATEIO_CONFIGURAR','/painel/financeiro?aba=rateio',1,0,CURRENT_TIMESTAMP,'39',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(28003,NULL,'financeiro-rateio-individual-unidade','Rateio individual por Matriz e Filial','Cada unidade mantém regras independentes.','Uma Filial não herda obrigatoriamente a configuração da Matriz. Administradores autorizados da Matriz podem configurar suas Filiais, mas cada regra continua pertencendo à unidade escolhida.','Financeiro',72,'["TODOS"]','FINANCEIRO_RATEIO_VISUALIZAR','/painel/financeiro?aba=rateio',1,0,CURRENT_TIMESTAMP,'39',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(28004,NULL,'financeiro-rateio-adicionar-divisao','Como adicionar uma divisão','Cadastre destinatário, tipo, valor e ordem.','Use Adicionar divisão, informe um nome livre, escolha o tipo de cálculo e preencha somente o percentual ou valor fixo solicitado. Saldo Restante não exige valor.','Financeiro',73,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RATEIO_CONFIGURAR','/painel/financeiro?aba=rateio',1,0,CURRENT_TIMESTAMP,'39',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(28005,NULL,'financeiro-rateio-percentual','Rateio por Percentual','O percentual usa a base elegível original.','Percentuais são calculados sobre a base elegível original do período, mesmo quando existem valores fixos. O cálculo usa centavos inteiros e aplica resíduo de forma determinística.','Financeiro',74,'["TODOS"]','FINANCEIRO_RATEIO_VISUALIZAR','/painel/financeiro?aba=rateio',1,0,CURRENT_TIMESTAMP,'39',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(28006,NULL,'financeiro-rateio-valor-fixo','Rateio por Valor Fixo','Defina uma quantia determinada por competência.','Valor Fixo permite definir uma quantia para dirigente, pastor, assistência, missões ou outro destino. O valor é copiado para o snapshot mensal e não vira percentual.','Financeiro',75,'["TODOS"]','FINANCEIRO_RATEIO_VISUALIZAR','/painel/financeiro?aba=rateio',1,0,CURRENT_TIMESTAMP,'39',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(28007,NULL,'financeiro-rateio-saldo-restante','Como funciona o Saldo Restante','Destine exatamente o que sobrar.','Depois dos valores fixos e percentuais, o valor ainda disponível vai para o único destinatário configurado como Saldo Restante. O sistema nunca permite resultado negativo.','Financeiro',76,'["TODOS"]','FINANCEIRO_RATEIO_VISUALIZAR','/painel/financeiro?aba=rateio',1,0,CURRENT_TIMESTAMP,'39',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(28008,NULL,'financeiro-rateio-base-calculo','Como funciona a base de cálculo','A base considera somente receitas participantes.','A base elegível soma receitas cujas categorias participam do rateio. Transferências, campanhas e fundos restritos ficam fora do cálculo geral.','Financeiro',77,'["TODOS"]','FINANCEIRO_RATEIO_VISUALIZAR','/painel/financeiro?aba=caixa',1,0,CURRENT_TIMESTAMP,'39',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(28009,NULL,'financeiro-rateio-receitas-fora','Receitas que não participam do Rateio','Veja por que total arrecadado e base podem diferir.','Categorias marcadas como fora do rateio não entram na base elegível. A prévia mostra separadamente total de entradas, recursos não participantes e base de cálculo.','Financeiro',78,'["TODOS"]','FINANCEIRO_RATEIO_VISUALIZAR','/painel/financeiro?aba=caixa',1,0,CURRENT_TIMESTAMP,'39',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(28010,NULL,'financeiro-rateio-campanhas-fundos','Campanhas e Fundos fora do Rateio','Recursos vinculados permanecem separados.','Por padrão, receitas vinculadas a campanhas ou fundos restritos não participam do rateio geral, preservando sua destinação específica.','Financeiro',79,'["TODOS"]','FINANCEIRO_RATEIO_VISUALIZAR','/painel/financeiro?aba=caixa',1,0,CURRENT_TIMESTAMP,'39',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(28011,NULL,'financeiro-rateio-caixa-aberto','Como alterar a regra de um caixa aberto','Altere somente o snapshot autorizado.','Usuários autorizados podem corrigir as regras do período aberto. Em caixa reaberto, senha e motivo são obrigatórios e cada versão anterior permanece preservada.','Financeiro',80,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RATEIO_PERIODO_ALTERAR','/painel/financeiro?aba=caixa',1,0,CURRENT_TIMESTAMP,'39',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(28012,NULL,'financeiro-rateio-historico','Por que a configuração atual não muda caixas antigos','Cada competência usa sua própria cópia.','Alterar a configuração padrão afeta somente caixas abertos depois da mudança. Períodos existentes continuam consultando seu snapshot, nunca a regra atual.','Financeiro',81,'["TODOS"]','FINANCEIRO_RATEIO_VISUALIZAR','/painel/financeiro?aba=caixa',1,0,CURRENT_TIMESTAMP,'39',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(28013,NULL,'financeiro-rateio-snapshot','Como funciona o snapshot mensal','A abertura congela regras e categorias elegíveis.','Ao abrir o caixa, o NexIgreja copia destinatários, tipos, valores, ordem e categorias participantes. Fechamentos guardam novas versões sem apagar as anteriores.','Financeiro',82,'["TODOS"]','FINANCEIRO_RATEIO_VISUALIZAR','/painel/financeiro?aba=caixa',1,0,CURRENT_TIMESTAMP,'39',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(28014,NULL,'financeiro-rateio-previa','Prévia do Rateio','Confira base, exclusões e destinos antes de fechar.','A prévia mostra total de entradas, recursos fora do rateio, base elegível, cálculo por destinatário e eventual valor não distribuído. Configuração excedente bloqueia o fechamento.','Financeiro',83,'["TODOS"]','FINANCEIRO_RATEIO_VISUALIZAR','/painel/financeiro?aba=caixa',1,0,CURRENT_TIMESTAMP,'39',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(28015,NULL,'financeiro-rateio-novas-opcoes','Novas opções de Rateio Financeiro','Percentual, Valor Fixo e Saldo Restante por unidade.','Agora o NexIgreja permite configurar divisões por Percentual, Valor Fixo e Saldo Restante, com regras independentes para cada Matriz e Filial e preservação histórica por competência.','Financeiro',84,'["TODOS"]','FINANCEIRO_RATEIO_VISUALIZAR','/painel/financeiro?aba=rateio',1,1,CURRENT_TIMESTAMP,'39',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
