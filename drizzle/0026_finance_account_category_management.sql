ALTER TABLE `finance_accounts` ADD COLUMN `description` text;
--> statement-breakpoint
ALTER TABLE `finance_accounts` ADD COLUMN `agency` text;
--> statement-breakpoint
ALTER TABLE `finance_accounts` ADD COLUMN `account_number` text;
--> statement-breakpoint
ALTER TABLE `finance_accounts` ADD COLUMN `pix_key` text;
--> statement-breakpoint
ALTER TABLE `finance_accounts` ADD COLUMN `notes` text;
--> statement-breakpoint
ALTER TABLE `finance_accounts` ADD COLUMN `archived_at` text;
--> statement-breakpoint
ALTER TABLE `finance_accounts` ADD COLUMN `archived_by_user_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_categories` ADD COLUMN `description` text;
--> statement-breakpoint
ALTER TABLE `finance_categories` ADD COLUMN `archived_at` text;
--> statement-breakpoint
ALTER TABLE `finance_categories` ADD COLUMN `archived_by_user_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_payment_methods` ADD COLUMN `description` text;
--> statement-breakpoint
ALTER TABLE `finance_payment_methods` ADD COLUMN `archived_at` text;
--> statement-breakpoint
ALTER TABLE `finance_payment_methods` ADD COLUMN `archived_by_user_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_cost_centers` ADD COLUMN `description` text;
--> statement-breakpoint
ALTER TABLE `finance_cost_centers` ADD COLUMN `archived_at` text;
--> statement-breakpoint
ALTER TABLE `finance_cost_centers` ADD COLUMN `archived_by_user_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_movements` ADD COLUMN `adjustment_direction` text CHECK (`adjustment_direction` IN ('ENTRADA','SAIDA'));
--> statement-breakpoint
CREATE INDEX `finance_payment_methods_filter_idx` ON `finance_payment_methods` (`tenant_id`,`status`,`name`);
--> statement-breakpoint
CREATE INDEX `finance_cost_centers_filter_idx` ON `finance_cost_centers` (`tenant_id`,`unit_id`,`status`,`name`);
--> statement-breakpoint
UPDATE `help_articles`
SET `target_profiles`='["TODOS"]', `updated_at`=CURRENT_TIMESTAMP
WHERE `category`='Financeiro' AND `target_profiles`='["ADMINISTRADOR","FINANCEIRO"]';
--> statement-breakpoint
INSERT INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(26001,NULL,'financeiro-contas-financeiras','Contas Financeiras','Entenda a diferença entre caixa, banco e conta financeira.','Uma conta financeira representa onde o dinheiro fica. Caixa registra valores em espécie; banco representa conta corrente ou poupança; PIX, cofre e carteira também podem ser separados para que o saldo de cada local seja calculado corretamente.','Financeiro',40,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=contas',1,0,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(26002,NULL,'financeiro-criar-conta','Como criar uma conta','Cadastre a unidade, o tipo e o saldo inicial.','Em Financeiro, abra Contas e selecione Nova conta. Informe a unidade, o nome, o tipo, a instituição e o saldo inicial com sua data. O saldo inicial deve representar o valor existente antes dos movimentos registrados no NexIgreja.','Financeiro',41,'["TODOS"]','FINANCEIRO_CONTAS_CONFIGURAR','/painel/financeiro?aba=contas',1,0,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(26003,NULL,'financeiro-editar-conta','Como editar uma conta','Corrija nome e dados cadastrais sem criar outra conta.','Na lista de Contas, use Editar. Corrija nome, descrição, tipo, instituição, agência, número, chave PIX e observações. O ID e o histórico permanecem os mesmos. O saldo inicial só pode ser alterado quando a conta ainda não possui movimentos.','Financeiro',42,'["TODOS"]','FINANCEIRO_CONTAS_CONFIGURAR','/painel/financeiro?aba=contas',1,0,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(26004,NULL,'financeiro-arquivar-conta','Como arquivar uma conta','Desative uma conta sem perder movimentos antigos.','Use Arquivar na conta que não deve mais receber lançamentos. A conta e todo o histórico continuam preservados, mas ela deixa de aparecer nos seletores de novas operações.','Financeiro',43,'["TODOS"]','FINANCEIRO_CONTAS_CONFIGURAR','/painel/financeiro?aba=contas',1,0,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(26005,NULL,'financeiro-reativar-conta','Como reativar uma conta','Volte a usar uma conta arquivada.','Selecione o filtro Arquivadas ou Todas e use Reativar. Depois da reativação, a conta volta aos seletores de novos lançamentos da unidade.','Financeiro',44,'["TODOS"]','FINANCEIRO_CONTAS_CONFIGURAR','/painel/financeiro?aba=contas',1,0,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(26006,NULL,'financeiro-saldo-inicial','Como funciona o saldo inicial','O ponto de partida da conta pode ser corrigido antes do primeiro movimento.','Saldo inicial é o valor existente na data em que a conta começa a ser controlada no sistema. Ele pode ser corrigido somente enquanto não houver movimentos. Depois disso, use Ajustar saldo para preservar a trilha financeira.','Financeiro',45,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=contas',1,0,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(26007,NULL,'financeiro-saldo-atual','Como funciona o saldo atual','O saldo atual é calculado pelas movimentações.','Saldo atual é o saldo inicial somado às entradas e ajustes positivos, menos saídas e ajustes negativos. Ele não é um campo de texto livre e nunca deve ser sobrescrito diretamente quando já existem movimentos.','Financeiro',46,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=contas',1,0,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(26008,NULL,'financeiro-ajustar-saldo','Como fazer um ajuste de saldo','Registre uma diferença com data e motivo obrigatório.','Na conta com movimentos, selecione Ajustar saldo. Informe o saldo correto, a data e o motivo. O NexIgreja calcula a diferença, cria um movimento de ajuste e registra saldo anterior, valor do ajuste, saldo resultante, usuário e horário na auditoria.','Financeiro',47,'["TODOS"]','FINANCEIRO_CONTAS_CONFIGURAR','/painel/financeiro?aba=contas',1,0,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(26009,NULL,'financeiro-saldo-negativo','O que significa saldo negativo','Identifique quando as saídas ultrapassaram os recursos da conta.','Saldo negativo indica que, conforme os registros, as saídas e ajustes negativos superaram o saldo inicial, as entradas e os ajustes positivos. O valor aparece em vermelho e com o aviso Saldo negativo para facilitar a identificação.','Financeiro',48,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=contas',1,0,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(26010,NULL,'financeiro-categorias-financeiras','Categorias Financeiras','Organize receitas e despesas sem alterar os movimentos.','Categorias classificam a natureza dos movimentos, como Dízimos, Energia elétrica ou Manutenção. Cada lançamento guarda o ID da categoria, por isso uma correção de nome não quebra o histórico.','Financeiro',49,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=categorias',1,0,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(26011,NULL,'financeiro-criar-categoria','Como criar uma categoria','Defina nome, natureza, rateio e fundo vinculado.','Em Financeiro, abra Categorias e selecione Nova categoria. Informe nome, descrição e natureza. Marque participação no rateio ou exigência de fundo somente quando essa regra fizer parte do uso da categoria.','Financeiro',50,'["TODOS"]','FINANCEIRO_CATEGORIAS_CONFIGURAR','/painel/financeiro?aba=categorias',1,0,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(26012,NULL,'financeiro-editar-categoria','Como editar uma categoria','Corrija a categoria mantendo o mesmo ID.','Na lista de Categorias, use Editar. É possível ajustar nome, descrição, natureza, participação no rateio e exigência de fundo vinculado. Os movimentos antigos continuam ligados à mesma categoria.','Financeiro',51,'["TODOS"]','FINANCEIRO_CATEGORIAS_CONFIGURAR','/painel/financeiro?aba=categorias',1,0,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(26013,NULL,'financeiro-arquivar-categoria','Como arquivar uma categoria','Retire uma categoria de novos lançamentos sem apagar o histórico.','Use Arquivar quando a categoria não deve mais ser escolhida. Ela permanece nos movimentos e relatórios antigos, mas deixa de aparecer em novos lançamentos.','Financeiro',52,'["TODOS"]','FINANCEIRO_CATEGORIAS_CONFIGURAR','/painel/financeiro?aba=categorias',1,0,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(26014,NULL,'financeiro-reativar-categoria','Como reativar uma categoria','Disponibilize novamente uma categoria arquivada.','Selecione Arquivadas ou Todas e use Reativar. A categoria volta aos seletores compatíveis com sua natureza.','Financeiro',53,'["TODOS"]','FINANCEIRO_CATEGORIAS_CONFIGURAR','/painel/financeiro?aba=categorias',1,0,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(26015,NULL,'financeiro-categoria-arquivada-historico','O que acontece com lançamentos antigos quando uma categoria é arquivada','O nome e o relacionamento histórico continuam disponíveis.','Arquivar não exclui. Um lançamento antigo continua exibindo a categoria utilizada, mesmo que ela esteja inativa hoje. Apenas os seletores de novos lançamentos deixam de oferecê-la.','Financeiro',54,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=categorias',1,0,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(26016,NULL,'novidades-contas-categorias-financeiras','Melhorias em Contas e Categorias Financeiras','Edição, arquivamento, reativação e ajustes de saldo com histórico preservado.','Agora é possível editar, arquivar e reativar Contas, Categorias, Formas de Pagamento e Centros de Custo. Ajustes de saldo exigem motivo, geram movimento próprio e mantêm a auditoria completa.','Novidades',3,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=contas',1,1,'2026-08-14','37',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
