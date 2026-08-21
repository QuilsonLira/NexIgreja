ALTER TABLE `finance_campaigns` ADD COLUMN `archived_at` text;
--> statement-breakpoint
ALTER TABLE `finance_campaigns` ADD COLUMN `archived_by_user_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_campaigns` ADD COLUMN `archive_reason` text;
--> statement-breakpoint
ALTER TABLE `finance_funds` ADD COLUMN `description` text;
--> statement-breakpoint
ALTER TABLE `finance_funds` ADD COLUMN `purpose` text;
--> statement-breakpoint
ALTER TABLE `finance_funds` ADD COLUMN `archived_at` text;
--> statement-breakpoint
ALTER TABLE `finance_funds` ADD COLUMN `archived_by_user_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_funds` ADD COLUMN `archive_reason` text;
--> statement-breakpoint
CREATE INDEX `finance_movements_period_page_idx` ON `finance_movements` (`tenant_id`,`unit_id`,`period_id`,`occurred_on`,`id`);
--> statement-breakpoint
CREATE INDEX `finance_movements_period_status_idx` ON `finance_movements` (`tenant_id`,`period_id`,`status`,`direction`);
--> statement-breakpoint
CREATE INDEX `finance_movements_campaign_period_idx` ON `finance_movements` (`tenant_id`,`campaign_id`,`period_id`,`status`);
--> statement-breakpoint
CREATE INDEX `finance_movements_fund_period_idx` ON `finance_movements` (`tenant_id`,`fund_id`,`period_id`,`status`);
--> statement-breakpoint
CREATE INDEX `finance_campaigns_scope_archive_idx` ON `finance_campaigns` (`tenant_id`,`unit_id`,`status`,`archived_at`);
--> statement-breakpoint
CREATE INDEX `finance_funds_scope_archive_idx` ON `finance_funds` (`tenant_id`,`unit_id`,`status`,`archived_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(30001,NULL,'financeiro-filtrar-lancamentos-caixa','Como filtrar lançamentos por Caixa','Consulte somente os movimentos de um período financeiro.','Em Lançamentos, escolha o Caixa/Período. O caixa aberto é selecionado primeiro; sem caixa aberto, o período mais recente é usado. Todos os períodos permanece disponível para consultas paginadas.','Financeiro',113,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=lancamentos',1,0,CURRENT_TIMESTAMP,'41',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(30002,NULL,'financeiro-filtrar-despesas-caixa','Como filtrar despesas por Caixa','Separe as saídas por período financeiro.','Em Despesas, selecione o Caixa/Período. A filtragem ocorre no servidor usando o vínculo period_id, e não apenas o mês da data.','Financeiro',114,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=despesas',1,0,CURRENT_TIMESTAMP,'41',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(30003,NULL,'financeiro-filtrar-contribuicoes-caixa','Como filtrar contribuições por Caixa','Consulte dízimos e ofertas do caixa escolhido.','O filtro usa o caixa em que a contribuição foi recebida. A competência informada no dízimo ou oferta continua visível e independente.','Financeiro',115,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CONTRIBUICOES_VISUALIZAR','/painel/financeiro?aba=contribuicoes',1,0,CURRENT_TIMESTAMP,'41',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(30004,NULL,'financeiro-caixa-competencia-contribuicao','Caixa x Competência da contribuição','Entenda por que os dois campos podem ser diferentes.','Caixa identifica o período operacional do recebimento. Competência identifica o mês ao qual a contribuição se refere. Um dízimo de julho recebido no caixa de agosto mantém as duas informações.','Financeiro',116,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=contribuicoes',1,0,CURRENT_TIMESTAMP,'41',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(30005,NULL,'financeiro-editar-campanha','Como editar uma Campanha','Corrija nome, meta, datas, fundo e descrição.','Campanhas podem ser editadas dentro da mesma unidade e tenant. O histórico financeiro relacionado permanece intacto.','Financeiro',117,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CAMPANHAS_GERENCIAR','/painel/financeiro?aba=campanhas',1,0,CURRENT_TIMESTAMP,'41',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(30006,NULL,'financeiro-arquivar-campanha','Como arquivar uma Campanha','Retire a campanha dos novos lançamentos sem apagar o histórico.','Campanhas com movimentação não podem ser excluídas. Use Arquivar ou Encerrar; relatórios e lançamentos antigos continuam exibindo a campanha.','Financeiro',118,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CAMPANHAS_GERENCIAR','/painel/financeiro?aba=campanhas',1,0,CURRENT_TIMESTAMP,'41',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(30007,NULL,'financeiro-editar-fundo','Como editar um Fundo','Atualize nome, finalidade e restrição.','Edite os dados do fundo sem alterar seus lançamentos, saldo ou histórico.','Financeiro',119,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CAMPANHAS_GERENCIAR','/painel/financeiro?aba=campanhas',1,0,CURRENT_TIMESTAMP,'41',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(30008,NULL,'financeiro-arquivar-fundo','Como arquivar um Fundo','Desative novos usos preservando o saldo vinculado.','Fundos utilizados não podem ser excluídos. Ao arquivar um fundo com saldo, o sistema mostra o valor e exige confirmação, sem apagar recursos ou relatórios.','Financeiro',120,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CAMPANHAS_GERENCIAR','/painel/financeiro?aba=campanhas',1,0,CURRENT_TIMESTAMP,'41',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(30009,NULL,'financeiro-reabrir-caixa','Como reabrir um Caixa','Localize a ação em um período fechado.','Abra Caixa mensal, escolha um período fechado e use Reabrir Caixa. Confirme sua senha e informe um motivo detalhado.','Financeiro',121,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_CAIXA_REABRIR','/painel/financeiro?aba=caixa',1,0,CURRENT_TIMESTAMP,'41',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(30010,NULL,'financeiro-quem-reabre-caixa','Quem pode reabrir um Caixa','A reabertura pertence à Matriz responsável.','Administrador local de Filial não pode reabrir. A operação exige usuário autorizado da Matriz responsável, permissão específica, senha, motivo e vínculo hierárquico válido.','Financeiro',122,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=caixa',1,0,CURRENT_TIMESTAMP,'41',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(30011,NULL,'financeiro-rateio-resumo-mensal','Como visualizar o Rateio no Resumo Mensal','Confira base, exclusões e divisão por destinatário.','O resumo do caixa mostra entradas, recursos fora do rateio, base elegível, Percentual, Valor Fixo, Saldo Restante e valores calculados. Caixas fechados usam o snapshot do fechamento.','Financeiro',123,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RATEIO_VISUALIZAR','/painel/financeiro?aba=caixa',1,0,CURRENT_TIMESTAMP,'41',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(30012,NULL,'financeiro-rateio-relatorio-oficial','Como visualizar o Rateio no Relatório Oficial','A divisão vem do snapshot do fechamento.','O Relatório Oficial exibe a versão histórica da regra, valor calculado, repassado e a repassar. Alterar a configuração atual não muda relatórios antigos.','Financeiro',124,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_RELATORIOS_VISUALIZAR','/painel/financeiro?aba=relatorios',1,0,CURRENT_TIMESTAMP,'41',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(30013,NULL,'financeiro-novos-filtros-fechamento','Novos filtros e melhorias no fechamento financeiro','Filtros por Caixa, cadastros seguros, reabertura e Rateio corrigido.','Agora o Financeiro permite filtrar Lançamentos, Despesas e Contribuições por Caixa/Período, gerenciar Campanhas e Fundos com mais segurança, localizar a reabertura de caixas fechados e visualizar corretamente o Rateio no resumo mensal e nos relatórios.','Novidades',3,'["ADMINISTRADOR","FINANCEIRO"]','FINANCEIRO_VISUALIZAR','/painel/financeiro',1,1,CURRENT_TIMESTAMP,'41',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
