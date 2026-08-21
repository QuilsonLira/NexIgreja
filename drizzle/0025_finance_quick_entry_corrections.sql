ALTER TABLE `finance_movements` ADD COLUMN `reversal_direction` text CHECK (`reversal_direction` IN ('ENTRADA','SAIDA'));
--> statement-breakpoint
ALTER TABLE `finance_movements` ADD COLUMN `created_during_reopening` integer NOT NULL DEFAULT 0 CHECK (`created_during_reopening` IN (0,1));
--> statement-breakpoint
ALTER TABLE `finance_movements` ADD COLUMN `version` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `finance_movements` ADD COLUMN `updated_at` text;
--> statement-breakpoint
UPDATE `finance_movements` SET `updated_at`=`created_at` WHERE `updated_at` IS NULL;
--> statement-breakpoint
UPDATE `finance_movements` SET `reversal_direction`=CASE
  WHEN (SELECT `direction` FROM `finance_movements` original WHERE original.`id`=`finance_movements`.`original_movement_id` AND original.`tenant_id`=`finance_movements`.`tenant_id`)='ENTRADA' THEN 'SAIDA'
  WHEN (SELECT `direction` FROM `finance_movements` original WHERE original.`id`=`finance_movements`.`original_movement_id` AND original.`tenant_id`=`finance_movements`.`tenant_id`)='SAIDA' THEN 'ENTRADA'
  ELSE NULL END
WHERE `direction`='ESTORNO' AND `reversal_direction` IS NULL;
--> statement-breakpoint
CREATE INDEX `finance_movements_original_idx` ON `finance_movements` (`tenant_id`,`original_movement_id`,`status`);
--> statement-breakpoint
CREATE INDEX `people_finance_hierarchy_search_idx` ON `people` (`tenant_id`,`matrix_id`,`branch_id`,`status`,`full_name` COLLATE NOCASE);
--> statement-breakpoint
WITH `permissions`(`permission`) AS (VALUES
('FINANCEIRO_LANCAMENTOS_EDITAR_ABERTO'),('FINANCEIRO_LANCAMENTOS_EXCLUIR_ABERTO'),('FINANCEIRO_CONTRIBUINTES_FILIAIS_PESQUISAR'))
INSERT OR IGNORE INTO `membership_permissions` (`membership_id`,`permission`,`created_at`)
SELECT m.`id`,p.`permission`,CURRENT_TIMESTAMP FROM `tenant_memberships` m CROSS JOIN `permissions` p
WHERE m.`status`='ATIVO' AND m.`archived_at` IS NULL AND m.`scope` IN ('CONVENCAO','MATRIZ') AND m.`role_name` LIKE 'Administrador%';
--> statement-breakpoint
WITH `permissions`(`permission`) AS (VALUES
('FINANCEIRO_LANCAMENTOS_EDITAR_ABERTO'),('FINANCEIRO_LANCAMENTOS_EXCLUIR_ABERTO'))
INSERT OR IGNORE INTO `user_permissions` (`user_id`,`permission`,`created_at`)
SELECT o.`user_id`,p.`permission`,CURRENT_TIMESTAMP FROM `platform_owners` o CROSS JOIN `permissions` p;
--> statement-breakpoint
INSERT INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(25001,NULL,'financeiro-corrigir-caixa-aberto','Como corrigir um lançamento enquanto o caixa está aberto','Edite ou exclua erros antes do primeiro fechamento.','Enquanto o caixa estiver aberto e nunca tiver sido fechado, usuários autorizados podem editar ou excluir um lançamento rápido. A operação recalcula os totais imediatamente e deixa somente auditoria técnica.','Financeiro',27,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_LANCAMENTO_RAPIDO','/painel/financeiro/rapido',1,1,CURRENT_TIMESTAMP,'36',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(25002,NULL,'financeiro-editar-excluir-lancamento','Editar ou excluir lançamento','Entenda quando a correção direta é permitida.','Editar e excluir são permitidos apenas antes do primeiro fechamento do período. Depois disso, o movimento histórico não pode ser apagado silenciosamente.','Financeiro',28,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_LANCAMENTOS_EDITAR_ABERTO','/painel/financeiro/rapido',1,1,CURRENT_TIMESTAMP,'36',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(25003,NULL,'financeiro-excluir-ou-estornar','Diferença entre excluir e estornar','Exclusão corrige o caixa corrente; estorno preserva o histórico.','Exclua somente erros de um caixa nunca fechado. Se o lançamento participou de um fechamento anterior, reabra o caixa e use Estornar; se necessário, crie depois o novo lançamento correto.','Financeiro',29,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=lancamentos',1,1,CURRENT_TIMESTAMP,'36',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(25004,NULL,'financeiro-como-funciona-estorno','Como funciona o estorno','O original e a operação inversa permanecem relacionados.','O estorno exige motivo, mantém o movimento original e cria a operação financeira inversa. Uma entrada de R$ 100,00 recebe um estorno de - R$ 100,00; uma saída recebe uma devolução positiva do mesmo valor.','Financeiro',30,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_LANCAMENTOS_ESTORNAR','/painel/financeiro?aba=lancamentos',1,1,CURRENT_TIMESTAMP,'36',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(25005,NULL,'financeiro-tipos-privacidade','Identificada, Identificada privada e Anônima','Escolha como o contribuinte será vinculado e exibido.','Identificada exibe o nome em relatórios autorizados. Identificada privada mantém a Pessoa vinculada internamente, mas mostra Anônimo em relatórios públicos. Anônima não vincula nenhuma Pessoa.','Financeiro',31,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CONTRIBUICOES_VISUALIZAR','/painel/financeiro?aba=contribuicoes',1,1,CURRENT_TIMESTAMP,'36',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(25006,NULL,'financeiro-contribuintes-filiais','Como pesquisar contribuintes das Filiais','Amplie a busca somente quando necessário e autorizado.','No caixa de uma Matriz, a busca mostra diretamente seus membros por padrão. Usuários autorizados podem marcar Incluir pessoas das Filiais/Congregações para pesquisar apenas as unidades subordinadas àquela Matriz.','Financeiro',32,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CONTRIBUINTES_FILIAIS_PESQUISAR','/painel/financeiro/rapido',1,1,CURRENT_TIMESTAMP,'36',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(25007,NULL,'financeiro-lancamento-rapido-celular','Como usar o Lançamento Rápido pelo celular','Pesquise, digite o valor e salve a próxima contribuição.','No celular, selecione o contribuinte, o tipo e o valor usando o teclado numérico. Salvar e próximo mantém conta, data, competência, tipo e forma padrão e devolve o foco à pesquisa.','Financeiro',33,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_LANCAMENTO_RAPIDO','/painel/financeiro/rapido',1,1,CURRENT_TIMESTAMP,'36',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(25008,NULL,'financeiro-competencia-automatica','Como funciona a competência automática','O caixa aberto tem prioridade; sem ele, o sistema sugere o mês anterior.','Ao entrar no Caixa, o NexIgreja carrega primeiro o período aberto da unidade. Se não houver caixa aberto, sugere o mês anterior sem criar automaticamente um novo período.','Financeiro',34,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=caixa',1,1,CURRENT_TIMESTAMP,'36',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(25009,NULL,'financeiro-melhorias-lancamento-rapido','Melhorias no Lançamento Rápido','Competência, correções, estornos, privacidade, busca e celular.','O Lançamento Rápido agora sugere a competência correta, permite correções seguras antes do fechamento, representa estornos com efeito inverso, esclarece a privacidade, oferece busca opcional nas Filiais e melhora a digitação no celular.','Novidades',2,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_VISUALIZAR','/painel/financeiro/rapido',1,1,CURRENT_TIMESTAMP,'36',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
