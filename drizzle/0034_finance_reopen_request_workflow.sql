CREATE TABLE `finance_period_reopen_requests` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `period_id` integer NOT NULL,
  `unit_id` integer NOT NULL,
  `matrix_id` integer NOT NULL,
  `branch_id` integer,
  `requester_user_id` integer NOT NULL,
  `requester_membership_id` integer NOT NULL,
  `requested_closure_version` integer NOT NULL,
  `reason` text NOT NULL,
  `status` text DEFAULT 'PENDENTE' NOT NULL CHECK (`status` IN ('PENDENTE','APROVADA','RECUSADA','UTILIZADA','EXPIRADA','CANCELADA')),
  `requested_at` text NOT NULL,
  `expires_at` text,
  `decided_by_user_id` integer,
  `decided_by_membership_id` integer,
  `decision_reason` text,
  `decided_at` text,
  `used_at` text,
  `reopened_by_user_id` integer,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`period_id`) REFERENCES `finance_periods`(`id`),
  FOREIGN KEY (`requester_membership_id`) REFERENCES `tenant_memberships`(`id`)
);
--> statement-breakpoint
CREATE INDEX `finance_reopen_requests_matrix_status_idx` ON `finance_period_reopen_requests` (`tenant_id`,`matrix_id`,`status`,`requested_at`);
--> statement-breakpoint
CREATE INDEX `finance_reopen_requests_requester_idx` ON `finance_period_reopen_requests` (`tenant_id`,`requester_user_id`,`period_id`,`requested_closure_version`);
--> statement-breakpoint
CREATE UNIQUE INDEX `finance_reopen_requests_active_unique` ON `finance_period_reopen_requests` (`tenant_id`,`period_id`,`requester_user_id`,`requester_membership_id`,`requested_closure_version`) WHERE `status` IN ('PENDENTE','APROVADA');
--> statement-breakpoint
WITH `matrix_admins` AS (
  SELECT m.`id` FROM `tenant_memberships` m
  WHERE m.`scope`='MATRIZ' AND m.`status`='ATIVO' AND m.`archived_at` IS NULL
    AND EXISTS (SELECT 1 FROM `membership_permissions` p WHERE p.`membership_id`=m.`id` AND p.`permission`='FINANCEIRO_CAIXA_ABRIR')
    AND EXISTS (SELECT 1 FROM `membership_permissions` p WHERE p.`membership_id`=m.`id` AND p.`permission`='FINANCEIRO_CAIXA_FECHAR')
    AND EXISTS (SELECT 1 FROM `membership_permissions` p WHERE p.`membership_id`=m.`id` AND p.`permission`='FINANCEIRO_CONFIGURAR')
), `matrix_permissions`(`permission`) AS (
  VALUES ('FINANCEIRO_CAIXA_REABRIR'),('FINANCEIRO_CAIXA_REABERTURA_APROVAR'),('FINANCEIRO_RATEIO_PERIODO_ALTERAR')
)
INSERT OR IGNORE INTO `membership_permissions` (`membership_id`,`permission`,`created_at`)
SELECT m.`id`,p.`permission`,CURRENT_TIMESTAMP FROM `matrix_admins` m CROSS JOIN `matrix_permissions` p;
--> statement-breakpoint
INSERT OR IGNORE INTO `membership_permissions` (`membership_id`,`permission`,`created_at`)
SELECT m.`id`,'FINANCEIRO_CAIXA_REABERTURA_SOLICITAR',CURRENT_TIMESTAMP
FROM `tenant_memberships` m
WHERE m.`scope`='FILIAL' AND m.`status`='ATIVO' AND m.`archived_at` IS NULL
  AND EXISTS (SELECT 1 FROM `membership_permissions` p WHERE p.`membership_id`=m.`id` AND p.`permission`='FINANCEIRO_VISUALIZAR');
--> statement-breakpoint
WITH `owner_permissions`(`permission`) AS (
  VALUES ('FINANCEIRO_CAIXA_REABRIR'),('FINANCEIRO_CAIXA_REABERTURA_APROVAR'),('FINANCEIRO_RATEIO_PERIODO_ALTERAR')
)
INSERT OR IGNORE INTO `user_permissions` (`user_id`,`permission`,`created_at`)
SELECT o.`user_id`,p.`permission`,CURRENT_TIMESTAMP FROM `platform_owners` o CROSS JOIN `owner_permissions` p;
--> statement-breakpoint
UPDATE `help_articles` SET
  `title`='Reabrir um caixa com autorização única',
  `summary`='A Matriz pode reabrir diretamente ou autorizar uma solicitação da Filial para um único caixa.',
  `content`='Em Financeiro > Caixa, o proprietário no contexto do cliente e o administrador autorizado da Matriz podem reabrir diretamente, confirmando senha e motivo. O usuário da Filial pode clicar em Solicitar reabertura, informar o motivo e confirmar a senha. A Matriz recebe uma notificação e pode aprovar ou recusar. A aprovação vale por 48 horas, para aquele usuário, caixa e versão de fechamento, e é consumida na primeira reabertura. Depois de fechar novamente, uma nova reabertura exige outra solicitação.',
  `required_permission`='FINANCEIRO_VISUALIZAR', `related_route`='/painel/financeiro?aba=caixa', `published`=1, `version`='47', `updated_at`=CURRENT_TIMESTAMP
WHERE `slug` IN ('financeiro-reabrir-caixa','financeiro-reabrir-caixa-versoes');
