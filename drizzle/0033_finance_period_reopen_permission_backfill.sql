-- A reabertura foi criada depois de alguns perfis administrativos. Esses
-- perfis já podiam abrir, fechar e configurar o Financeiro, mas ficaram sem a
-- permissão nova e, por isso, a ação era escondida pela interface.
WITH `eligible_memberships` AS (
  SELECT m.`id`
  FROM `tenant_memberships` m
  WHERE m.`status`='ATIVO'
    AND m.`archived_at` IS NULL
    AND m.`scope` IN ('CONVENCAO','MATRIZ')
    AND EXISTS (
      SELECT 1 FROM `membership_permissions` p
      WHERE p.`membership_id`=m.`id` AND p.`permission`='FINANCEIRO_CAIXA_ABRIR'
    )
    AND EXISTS (
      SELECT 1 FROM `membership_permissions` p
      WHERE p.`membership_id`=m.`id` AND p.`permission`='FINANCEIRO_CAIXA_FECHAR'
    )
    AND EXISTS (
      SELECT 1 FROM `membership_permissions` p
      WHERE p.`membership_id`=m.`id` AND p.`permission`='FINANCEIRO_CONFIGURAR'
    )
)
INSERT OR IGNORE INTO `membership_permissions` (`membership_id`,`permission`,`created_at`)
SELECT e.`id`,'FINANCEIRO_CAIXA_REABRIR',CURRENT_TIMESTAMP
FROM `eligible_memberships` e;
--> statement-breakpoint
UPDATE `help_articles`
SET
  `title`='Como reabrir um Caixa fechado',
  `summary`='Corrija um período fechado sem apagar o fechamento anterior.',
  `content`='Acesse Financeiro > Caixa, selecione a unidade e escolha o período FECHADO no campo Caixa / Período. Clique em Reabrir Caixa, confirme sua senha atual e informe o motivo obrigatório. O mesmo período passa para REABERTO e fica disponível para correções auditadas. Depois das correções, feche novamente: o fechamento anterior continua como v1 e o novo fechamento é preservado como v2. A reabertura somente pode ser executada por perfil autorizado da Matriz responsável; a Filial local não pode reabrir por conta própria.',
  `required_permission`='FINANCEIRO_CAIXA_REABRIR',
  `related_route`='/painel/financeiro?aba=caixa',
  `published`=1,
  `version`='46',
  `updated_at`=CURRENT_TIMESTAMP
WHERE `slug` IN ('financeiro-reabrir-caixa','financeiro-reabrir-caixa-versoes');
