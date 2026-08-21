ALTER TABLE `finance_obligations` ADD COLUMN `notes` text;
--> statement-breakpoint
ALTER TABLE `finance_obligations` ADD COLUMN `document_reference` text;
--> statement-breakpoint
ALTER TABLE `finance_obligations` ADD COLUMN `suggested_account_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_obligations` ADD COLUMN `payment_method_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_obligations` ADD COLUMN `version` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `finance_installments` ADD COLUMN `settled_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `finance_installments` ADD COLUMN `interest_cents` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `finance_installments` ADD COLUMN `penalty_cents` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `finance_installments` ADD COLUMN `discount_cents` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `finance_installments` ADD COLUMN `adjustment_cents` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `finance_installments` ADD COLUMN `difference_reason` text;
--> statement-breakpoint
ALTER TABLE `finance_installments` ADD COLUMN `settled_account_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_installments` ADD COLUMN `payment_method_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_installments` ADD COLUMN `settled_on` text;
--> statement-breakpoint
ALTER TABLE `finance_installments` ADD COLUMN `reversal_movement_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_installments` ADD COLUMN `version` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `finance_installments` ADD COLUMN `updated_at` text;
--> statement-breakpoint
UPDATE `finance_installments` SET `settled_amount_cents`=`amount_cents`,`settled_on`=substr(`settled_at`,1,10),`updated_at`=COALESCE(`settled_at`,`created_at`) WHERE `movement_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `finance_installments` SET `updated_at`=`created_at` WHERE `updated_at` IS NULL;
--> statement-breakpoint
ALTER TABLE `finance_transfers` ADD COLUMN `notes` text;
--> statement-breakpoint
ALTER TABLE `finance_transfers` ADD COLUMN `status` text NOT NULL DEFAULT 'CONFIRMADA' CHECK (`status` IN ('CONFIRMADA','REVERTIDA','REVERSAO'));
--> statement-breakpoint
ALTER TABLE `finance_transfers` ADD COLUMN `reversal_of_transfer_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_transfers` ADD COLUMN `reversed_by_transfer_id` integer;
--> statement-breakpoint
ALTER TABLE `finance_transfers` ADD COLUMN `version` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `finance_transfers` ADD COLUMN `updated_at` text;
--> statement-breakpoint
UPDATE `finance_transfers` SET `updated_at`=`created_at` WHERE `updated_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `finance_obligations_scope_status_idx` ON `finance_obligations` (`tenant_id`,`unit_id`,`kind`,`status`,`competency`);
--> statement-breakpoint
CREATE INDEX `finance_installments_obligation_status_idx` ON `finance_installments` (`tenant_id`,`obligation_id`,`status`,`installment_number`);
--> statement-breakpoint
CREATE INDEX `finance_installments_account_settled_idx` ON `finance_installments` (`tenant_id`,`settled_account_id`,`settled_on`);
--> statement-breakpoint
CREATE INDEX `finance_transfers_scope_status_idx` ON `finance_transfers` (`tenant_id`,`unit_id`,`status`,`occurred_on`);
--> statement-breakpoint
INSERT INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(27001,NULL,'financeiro-contas-pagar-visao','Contas a Pagar','Organize obrigações, parcelas e pagamentos.','Contas a Pagar reúne obrigações da unidade e mantém o vínculo entre parcela, baixa, conta utilizada e movimento de saída.','Financeiro',40,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=pagar',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27002,NULL,'financeiro-criar-conta-pagar','Como criar uma Conta a Pagar','Cadastre valor, vencimento e parcelas.','Abra Contas a Pagar, clique em Novo e informe os dados. A conta informada é uma sugestão para a baixa.','Financeiro',41,'["TODOS"]','FINANCEIRO_CONTAS_PAGAR_GERENCIAR','/painel/financeiro?aba=pagar',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27003,NULL,'financeiro-editar-conta-pagar','Como editar uma Conta a Pagar','Corrija antes de qualquer pagamento.','Use Editar enquanto nenhuma parcela tiver movimento. O sistema recalcula as parcelas e registra auditoria.','Financeiro',42,'["TODOS"]','FINANCEIRO_CONTAS_PAGAR_GERENCIAR','/painel/financeiro?aba=pagar',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27004,NULL,'financeiro-parcelas-obrigacao','Como funcionam as parcelas','Cada parcela possui número e vencimento.','As parcelas aparecem como 1/10, 2/10 e assim por diante, com valor previsto, efetivo, conta e movimento.','Financeiro',43,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=pagar',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27005,NULL,'financeiro-baixar-parcela-pagar','Como dar baixa em uma parcela','Registre a conta e o valor pagos.','Escolha Dar baixa, confira o valor previsto, selecione a conta de saída, a forma e a data.','Financeiro',44,'["TODOS"]','FINANCEIRO_CONTAS_PAGAR_GERENCIAR','/painel/financeiro?aba=pagar',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27006,NULL,'financeiro-escolher-conta-pagamento','Como escolher a conta de pagamento','A conta sugerida pode ser trocada.','Selecione na baixa a conta de onde o dinheiro realmente saiu; somente ela terá o saldo reduzido.','Financeiro',45,'["TODOS"]','FINANCEIRO_CONTAS_PAGAR_GERENCIAR','/painel/financeiro?aba=pagar',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27007,NULL,'financeiro-juros-multa','Como registrar juros e multa','Informe os acréscimos separadamente.','Na baixa, informe juros, multa e outros ajustes. Toda diferença exige um motivo.','Financeiro',46,'["TODOS"]','FINANCEIRO_CONTAS_PAGAR_GERENCIAR','/painel/financeiro?aba=pagar',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27008,NULL,'financeiro-desconto-pagamento','Como registrar desconto','Reduza o valor final com justificativa.','Informe o desconto e descreva o motivo da diferença para a auditoria.','Financeiro',47,'["TODOS"]','FINANCEIRO_CONTAS_PAGAR_GERENCIAR','/painel/financeiro?aba=pagar',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27009,NULL,'financeiro-desfazer-baixa','Como desfazer uma baixa','Corrija antes do fechamento.','Se o caixa nunca foi fechado, Desfazer baixa remove a saída e devolve a parcela para Pendente sem estorno operacional.','Financeiro',48,'["TODOS"]','FINANCEIRO_CONTAS_PAGAR_GERENCIAR','/painel/financeiro?aba=pagar',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27010,NULL,'financeiro-desfazer-ou-estornar-pagamento','Diferença entre desfazer baixa e estornar pagamento','O histórico define a operação.','Antes do primeiro fechamento, use Desfazer. Após fechamento e reabertura, use Estornar para preservar original e inversão.','Financeiro',49,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=pagar',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27011,NULL,'financeiro-contas-receber-visao','Contas a Receber','Acompanhe parcelas e recebimentos.','Contas a Receber vincula cada recebimento à conta onde o dinheiro entrou.','Financeiro',50,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=receber',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27012,NULL,'financeiro-editar-conta-receber','Como editar uma Conta a Receber','Corrija antes do recebimento.','Use Editar enquanto nenhuma parcela tiver movimento; sem histórico, também é possível excluir.','Financeiro',51,'["TODOS"]','FINANCEIRO_CONTAS_RECEBER_GERENCIAR','/painel/financeiro?aba=receber',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27013,NULL,'financeiro-receber-parcela','Como receber uma parcela','Registre o recebimento real.','Escolha a parcela, conta de destino, valor recebido, forma e data. A confirmação impede baixa duplicada.','Financeiro',52,'["TODOS"]','FINANCEIRO_CONTAS_RECEBER_GERENCIAR','/painel/financeiro?aba=receber',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27014,NULL,'financeiro-conta-destino-recebimento','Como escolher a conta de destino','Selecione onde o dinheiro entrou.','Na baixa, escolha a conta que realmente recebeu o valor.','Financeiro',53,'["TODOS"]','FINANCEIRO_CONTAS_RECEBER_GERENCIAR','/painel/financeiro?aba=receber',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27015,NULL,'financeiro-alterar-valor-recebido','Como alterar o valor recebido','Registre descontos ou acréscimos.','Informe desconto, juros, multa ou ajuste e registre o motivo da diferença.','Financeiro',54,'["TODOS"]','FINANCEIRO_CONTAS_RECEBER_GERENCIAR','/painel/financeiro?aba=receber',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27016,NULL,'financeiro-desfazer-recebimento','Como desfazer um recebimento','Volte a parcela para Pendente.','Em caixa nunca fechado, desfazer remove a entrada e limpa a baixa sem gerar estorno.','Financeiro',55,'["TODOS"]','FINANCEIRO_CONTAS_RECEBER_GERENCIAR','/painel/financeiro?aba=receber',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27017,NULL,'financeiro-estorno-recebimento','Como funciona o estorno de recebimento','Preserve o original após fechamento.','Em período histórico, o sistema mantém a entrada original e cria uma saída inversa com motivo.','Financeiro',56,'["TODOS"]','FINANCEIRO_LANCAMENTOS_ESTORNAR','/painel/financeiro?aba=receber',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27018,NULL,'financeiro-despesas-saidas','Despesas e Saídas','Entenda lançamentos e pagamentos vinculados.','Despesas avulsas podem ser corrigidas antes do fechamento; saídas de Contas a Pagar permanecem ligadas à parcela.','Financeiro',57,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=despesas',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27019,NULL,'financeiro-editar-despesa','Como editar uma despesa','Corrija lançamentos correntes.','Enquanto o período estiver aberto e nunca fechado, edite valor, conta, categoria, data e demais campos.','Financeiro',58,'["TODOS"]','FINANCEIRO_DESPESAS_GERENCIAR','/painel/financeiro?aba=despesas',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27020,NULL,'financeiro-excluir-despesa','Como excluir uma despesa antes do fechamento','Remova sem gerar estorno.','Uma despesa avulsa de caixa nunca fechado pode ser excluída, mantendo somente auditoria técnica.','Financeiro',59,'["TODOS"]','FINANCEIRO_DESPESAS_GERENCIAR','/painel/financeiro?aba=despesas',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27021,NULL,'financeiro-despesa-conta-pagar','Despesas vinculadas a Contas a Pagar','Não quebre o vínculo.','Quando a saída veio de uma baixa, use Desfazer ou Estornar; movimento, parcela e saldo são atualizados juntos.','Financeiro',60,'["TODOS"]','FINANCEIRO_CONTAS_PAGAR_GERENCIAR','/painel/financeiro?aba=despesas',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27022,NULL,'financeiro-transferencias-contas','Transferências entre contas','Uma operação com dois efeitos.','A transferência reduz a origem e aumenta o destino com o mesmo identificador, sem compor receita ou despesa.','Financeiro',61,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=transferencias',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27023,NULL,'financeiro-editar-transferencia','Como editar uma transferência','Atualize os dois lados juntos.','Antes do primeiro fechamento, altere valor, data, contas, descrição ou observação atomicamente.','Financeiro',62,'["TODOS"]','FINANCEIRO_TRANSFERENCIAS_GERENCIAR','/painel/financeiro?aba=transferencias',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27024,NULL,'financeiro-cancelar-transferencia','Como cancelar uma transferência antes do fechamento','Remova os dois efeitos.','Em período nunca fechado, Cancelar retira os dois movimentos sem gerar estorno operacional.','Financeiro',63,'["TODOS"]','FINANCEIRO_TRANSFERENCIAS_GERENCIAR','/painel/financeiro?aba=transferencias',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27025,NULL,'financeiro-reverter-transferencia','Como funciona a reversão de transferência','Preserve transferências históricas.','Reverter cria uma operação no sentido contrário, preserva a original e exige motivo.','Financeiro',64,'["TODOS"]','FINANCEIRO_LANCAMENTOS_ESTORNAR','/painel/financeiro?aba=transferencias',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27026,NULL,'financeiro-transferencia-nao-receita','Por que transferência não é receita nem despesa','Apenas move saldo entre contas.','Transferências são excluídas dos totais operacionais e da base de rateio.','Financeiro',65,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=transferencias',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27027,NULL,'financeiro-periodo-historico','Caixa reaberto continua histórico','Reabrir não apaga o fechamento.','Se a versão de fechamento for maior que zero, correções usam estorno ou reversão.','Financeiro',66,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro?aba=caixa',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27028,NULL,'financeiro-motivo-diferenca','Por que informar o motivo da diferença','Diferenças ficam auditadas.','A auditoria registra previsto, efetivo, juros, multa, desconto e ajustes.','Financeiro',67,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(27029,NULL,'financeiro-melhorias-pagamentos-recebimentos-transferencias','Melhorias em Pagamentos, Recebimentos e Transferências','Mais controle para corrigir obrigações, baixas e transferências.','Agora é possível editar obrigações antes da movimentação, escolher a conta utilizada nas baixas, registrar diferenças de valor, desfazer operações feitas por engano enquanto o caixa está aberto e corrigir transferências com maior segurança.','Novidades',3,'["TODOS"]','FINANCEIRO_VISUALIZAR','/painel/financeiro',1,1,CURRENT_TIMESTAMP,'38',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
