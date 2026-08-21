CREATE TABLE `ebd_students` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `department_id` integer NOT NULL,
  `person_id` integer,
  `full_name` text NOT NULL,
  `birth_date` text,
  `sex` text CHECK (`sex` IS NULL OR `sex` IN ('MASCULINO','FEMININO','NAO_INFORMADO')),
  `cpf` text,
  `phone` text,
  `whatsapp` text,
  `guardian_name` text,
  `guardian_phone` text,
  `notes` text,
  `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','INATIVO')),
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ebd_students_person_unique` ON `ebd_students` (`tenant_id`,`department_id`,`person_id`) WHERE `person_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `ebd_students_department_name_idx` ON `ebd_students` (`tenant_id`,`department_id`,`status`,`full_name` COLLATE NOCASE);
--> statement-breakpoint
CREATE INDEX `ebd_students_unlinked_idx` ON `ebd_students` (`tenant_id`,`department_id`,`person_id`,`status`);
--> statement-breakpoint
INSERT INTO `ebd_students` (`id`,`tenant_id`,`department_id`,`person_id`,`full_name`,`birth_date`,`sex`,`cpf`,`phone`,`whatsapp`,`status`,`created_by_user_id`,`created_at`,`updated_at`)
SELECT MIN(e.`id`),e.`tenant_id`,e.`department_id`,e.`person_id`,p.`full_name`,p.`birth_date`,p.`sex`,p.`cpf`,p.`phone`,p.`whatsapp`,'ATIVO',d.`created_by_user_id`,MIN(e.`created_at`),MAX(e.`updated_at`)
FROM `ebd_enrollments` e JOIN `people` p ON p.`id`=e.`person_id` AND p.`tenant_id`=e.`tenant_id` JOIN `departments` d ON d.`id`=e.`department_id` AND d.`tenant_id`=e.`tenant_id`
GROUP BY e.`tenant_id`,e.`department_id`,e.`person_id`;
--> statement-breakpoint
CREATE TABLE `ebd_student_enrollments` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `department_id` integer NOT NULL,
  `class_id` integer NOT NULL,
  `student_id` integer NOT NULL,
  `enrolled_at` text NOT NULL,
  `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','TRANSFERIDO','INATIVO')),
  `left_at` text,
  `notes` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  FOREIGN KEY (`class_id`,`tenant_id`) REFERENCES `ebd_classes`(`id`,`tenant_id`),
  FOREIGN KEY (`student_id`,`tenant_id`) REFERENCES `ebd_students`(`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ebd_student_enrollments_active_unique` ON `ebd_student_enrollments` (`tenant_id`,`department_id`,`student_id`) WHERE `status`='ATIVO';
--> statement-breakpoint
CREATE INDEX `ebd_student_enrollments_class_idx` ON `ebd_student_enrollments` (`tenant_id`,`class_id`,`status`,`student_id`);
--> statement-breakpoint
INSERT INTO `ebd_student_enrollments` SELECT e.`id`,e.`tenant_id`,e.`department_id`,e.`class_id`,s.`id`,e.`enrolled_at`,e.`status`,e.`left_at`,e.`notes`,e.`created_at`,e.`updated_at` FROM `ebd_enrollments` e JOIN `ebd_students` s ON s.`tenant_id`=e.`tenant_id` AND s.`department_id`=e.`department_id` AND s.`person_id`=e.`person_id`;
--> statement-breakpoint
CREATE TABLE `ebd_student_attendance` (
  `meeting_id` integer NOT NULL,
  `class_id` integer NOT NULL,
  `tenant_id` integer NOT NULL,
  `student_id` integer NOT NULL,
  `attendance_status` text NOT NULL CHECK (`attendance_status` IN ('PRESENTE','AUSENTE','JUSTIFICADO','NAO_INFORMADO')),
  `updated_by_user_id` integer NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`meeting_id`) REFERENCES `ebd_meetings`(`id`),
  FOREIGN KEY (`class_id`,`tenant_id`) REFERENCES `ebd_classes`(`id`,`tenant_id`),
  FOREIGN KEY (`student_id`,`tenant_id`) REFERENCES `ebd_students`(`id`,`tenant_id`),
  FOREIGN KEY (`updated_by_user_id`) REFERENCES `auth_users`(`id`),
  PRIMARY KEY (`meeting_id`,`class_id`,`student_id`)
);
--> statement-breakpoint
CREATE INDEX `ebd_student_attendance_history_idx` ON `ebd_student_attendance` (`tenant_id`,`student_id`,`attendance_status`,`meeting_id`);
--> statement-breakpoint
CREATE INDEX `ebd_student_attendance_class_idx` ON `ebd_student_attendance` (`tenant_id`,`class_id`,`meeting_id`,`attendance_status`);
--> statement-breakpoint
INSERT INTO `ebd_student_attendance` SELECT a.`meeting_id`,a.`class_id`,a.`tenant_id`,s.`id`,a.`attendance_status`,a.`updated_by_user_id`,a.`updated_at` FROM `ebd_attendance` a JOIN `ebd_classes` c ON c.`id`=a.`class_id` AND c.`tenant_id`=a.`tenant_id` JOIN `ebd_students` s ON s.`tenant_id`=a.`tenant_id` AND s.`department_id`=c.`department_id` AND s.`person_id`=a.`person_id`;
--> statement-breakpoint
CREATE TABLE `secretary_requests` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `person_id` integer NOT NULL,
  `request_type` text NOT NULL CHECK (`request_type` IN ('TRANSFERENCIA_INTERNA','TRANSFERENCIA_EXTERNA','DOCUMENTO','RECEBIMENTO','CONSAGRACAO','ALTERACAO_ECLESIASTICA')),
  `origin_unit_id` integer,
  `destination_unit_id` integer,
  `external_church` text,
  `external_city` text,
  `external_state` text,
  `reason` text,
  `notes` text,
  `status` text NOT NULL DEFAULT 'PENDENTE' CHECK (`status` IN ('PENDENTE','EM_ANALISE','APROVADA','RECUSADA','CONCLUIDA','CANCELADA')),
  `department_resolution` text,
  `ebd_resolution` text,
  `version` integer NOT NULL DEFAULT 1,
  `requested_by_user_id` integer NOT NULL,
  `reviewed_by_user_id` integer,
  `requested_at` text NOT NULL,
  `reviewed_at` text,
  `completed_at` text,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  FOREIGN KEY (`origin_unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`destination_unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`requested_by_user_id`) REFERENCES `auth_users`(`id`),
  FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE INDEX `secretary_requests_queue_idx` ON `secretary_requests` (`tenant_id`,`status`,`request_type`,`requested_at`);
--> statement-breakpoint
CREATE INDEX `secretary_requests_person_idx` ON `secretary_requests` (`tenant_id`,`person_id`,`requested_at`);
--> statement-breakpoint
CREATE TABLE `church_movements` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `person_id` integer NOT NULL,
  `unit_id` integer NOT NULL,
  `movement_type` text NOT NULL CHECK (`movement_type` IN ('RECEBIMENTO','TRANSFERENCIA_INTERNA','TRANSFERENCIA_EXTERNA','DESLIGAMENTO','AFASTAMENTO','RETORNO','FALECIMENTO','BATISMO','CONSAGRACAO','ALTERACAO_FUNCAO','OUTRO')),
  `request_id` integer,
  `effective_date` text NOT NULL,
  `previous_status` text,
  `new_status` text,
  `previous_unit_id` integer,
  `destination_unit_id` integer,
  `external_church` text,
  `external_city` text,
  `external_state` text,
  `description` text NOT NULL,
  `metadata_json` text NOT NULL DEFAULT '{}',
  `status` text NOT NULL DEFAULT 'CONCLUIDA' CHECK (`status` IN ('PENDENTE','CONCLUIDA','CANCELADA','CORRIGIDA')),
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`request_id`,`tenant_id`) REFERENCES `secretary_requests`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE INDEX `church_movements_report_idx` ON `church_movements` (`tenant_id`,`unit_id`,`movement_type`,`effective_date`,`status`);
--> statement-breakpoint
CREATE INDEX `church_movements_person_idx` ON `church_movements` (`tenant_id`,`person_id`,`effective_date`);
--> statement-breakpoint
CREATE UNIQUE INDEX `church_movements_request_unique` ON `church_movements` (`tenant_id`,`request_id`) WHERE `request_id` IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `baptism_events` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `unit_id` integer NOT NULL, `title` text NOT NULL, `scheduled_date` text NOT NULL, `location` text, `responsible_person_id` integer, `notes` text, `status` text NOT NULL DEFAULT 'AGENDADO' CHECK (`status` IN ('PLANEJADO','AGENDADO','REALIZADO','CANCELADO')), `version` integer NOT NULL DEFAULT 1, `created_by_user_id` integer NOT NULL, `created_at` text NOT NULL, `updated_at` text NOT NULL,
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`), FOREIGN KEY (`responsible_person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`), FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`), UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE INDEX `baptism_events_date_idx` ON `baptism_events` (`tenant_id`,`unit_id`,`scheduled_date`,`status`);
--> statement-breakpoint
CREATE TABLE `baptism_candidates` (
  `event_id` integer NOT NULL, `tenant_id` integer NOT NULL, `person_id` integer NOT NULL, `status` text NOT NULL DEFAULT 'CANDIDATO' CHECK (`status` IN ('CANDIDATO','EM_PREPARACAO','AGENDADO','REALIZADO','CANCELADO')), `notes` text, `completed_at` text, `updated_by_user_id` integer NOT NULL, `created_at` text NOT NULL, `updated_at` text NOT NULL,
  FOREIGN KEY (`event_id`,`tenant_id`) REFERENCES `baptism_events`(`id`,`tenant_id`), FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`), FOREIGN KEY (`updated_by_user_id`) REFERENCES `auth_users`(`id`), PRIMARY KEY (`event_id`,`person_id`)
);
--> statement-breakpoint
CREATE INDEX `baptism_candidates_status_idx` ON `baptism_candidates` (`tenant_id`,`status`,`person_id`);
--> statement-breakpoint
CREATE TABLE `consecrations` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `person_id` integer NOT NULL, `unit_id` integer NOT NULL, `previous_function_id` integer, `new_function_id` integer NOT NULL, `event_date` text NOT NULL, `location` text, `responsible_person_id` integer, `notes` text, `status` text NOT NULL DEFAULT 'SOLICITADA' CHECK (`status` IN ('SOLICITADA','APROVADA','REALIZADA','CANCELADA')), `version` integer NOT NULL DEFAULT 1, `created_by_user_id` integer NOT NULL, `completed_by_user_id` integer, `created_at` text NOT NULL, `updated_at` text NOT NULL,
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`), FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`), FOREIGN KEY (`previous_function_id`,`tenant_id`) REFERENCES `organizational_functions`(`id`,`tenant_id`), FOREIGN KEY (`new_function_id`,`tenant_id`) REFERENCES `organizational_functions`(`id`,`tenant_id`), FOREIGN KEY (`responsible_person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`), FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`), FOREIGN KEY (`completed_by_user_id`) REFERENCES `auth_users`(`id`), UNIQUE (`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE INDEX `consecrations_status_date_idx` ON `consecrations` (`tenant_id`,`unit_id`,`status`,`event_date`);
--> statement-breakpoint
CREATE TABLE `secretary_document_templates` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `unit_id` integer, `name` text NOT NULL, `document_type` text NOT NULL, `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','INATIVO')), `current_version` integer NOT NULL DEFAULT 1, `created_by_user_id` integer NOT NULL, `created_at` text NOT NULL, `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`), FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`), FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`), UNIQUE (`id`,`tenant_id`), UNIQUE (`tenant_id`,`unit_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `secretary_templates_type_idx` ON `secretary_document_templates` (`tenant_id`,`status`,`document_type`,`name`);
--> statement-breakpoint
CREATE TABLE `secretary_document_template_versions` (
  `template_id` integer NOT NULL, `tenant_id` integer NOT NULL, `version` integer NOT NULL, `title` text NOT NULL, `body` text NOT NULL, `header_text` text, `footer_text` text, `signature_labels_json` text NOT NULL DEFAULT '[]', `style_json` text NOT NULL DEFAULT '{}', `created_by_user_id` integer NOT NULL, `created_at` text NOT NULL,
  FOREIGN KEY (`template_id`,`tenant_id`) REFERENCES `secretary_document_templates`(`id`,`tenant_id`), FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`), PRIMARY KEY (`template_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `secretary_documents` (
  `id` integer PRIMARY KEY NOT NULL, `tenant_id` integer NOT NULL, `unit_id` integer NOT NULL, `person_id` integer NOT NULL, `template_id` integer NOT NULL, `template_version` integer NOT NULL, `document_type` text NOT NULL, `document_number` text NOT NULL, `title_snapshot` text NOT NULL, `body_snapshot` text NOT NULL, `header_snapshot` text, `footer_snapshot` text, `signatures_snapshot` text NOT NULL DEFAULT '[]', `issued_by_user_id` integer NOT NULL, `issued_at` text NOT NULL,
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`), FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`), FOREIGN KEY (`template_id`,`template_version`) REFERENCES `secretary_document_template_versions`(`template_id`,`version`), FOREIGN KEY (`issued_by_user_id`) REFERENCES `auth_users`(`id`), UNIQUE (`id`,`tenant_id`), UNIQUE (`tenant_id`,`document_number`)
);
--> statement-breakpoint
CREATE INDEX `secretary_documents_report_idx` ON `secretary_documents` (`tenant_id`,`unit_id`,`document_type`,`issued_at`);
--> statement-breakpoint
CREATE TABLE `secretary_document_sequences` (`tenant_id` integer NOT NULL, `year` integer NOT NULL, `last_number` integer NOT NULL DEFAULT 0, `updated_at` text NOT NULL, FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`), PRIMARY KEY (`tenant_id`,`year`));
--> statement-breakpoint
CREATE TABLE `secretary_audit` (
 `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `tenant_id` integer NOT NULL, `unit_id` integer, `actor_user_id` integer NOT NULL, `actor_membership_id` integer, `action` text NOT NULL, `entity_type` text NOT NULL, `entity_id` integer NOT NULL, `previous_values` text, `new_values` text, `reason` text, `created_at` text NOT NULL,
 FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`), FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`), FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`), FOREIGN KEY (`actor_membership_id`) REFERENCES `tenant_memberships`(`id`)
);
--> statement-breakpoint
CREATE INDEX `secretary_audit_created_idx` ON `secretary_audit` (`tenant_id`,`unit_id`,`created_at`,`action`);
--> statement-breakpoint
WITH `permissions`(`permission`) AS (VALUES ('SECRETARIA_VISUALIZAR'),('SECRETARIA_MOVIMENTACOES_VISUALIZAR'),('SECRETARIA_MOVIMENTACOES_GERENCIAR'),('SECRETARIA_TRANSFERENCIAS_SOLICITAR'),('SECRETARIA_TRANSFERENCIAS_APROVAR'),('SECRETARIA_RECEBIMENTOS_GERENCIAR'),('SECRETARIA_BATISMOS_GERENCIAR'),('SECRETARIA_CONSAGRACOES_GERENCIAR'),('SECRETARIA_DOCUMENTOS_EMITIR'),('SECRETARIA_DOCUMENTOS_MODELOS_GERENCIAR'),('SECRETARIA_RELATORIOS'),('SECRETARIA_CONFIGURAR'))
INSERT OR IGNORE INTO `membership_permissions` (`membership_id`,`permission`,`created_at`) SELECT m.`id`,p.`permission`,CURRENT_TIMESTAMP FROM `tenant_memberships` m CROSS JOIN `permissions` p WHERE m.`status`='ATIVO' AND m.`archived_at` IS NULL AND (m.`role_name` LIKE 'Administrador%' OR m.`scope`='CONVENCAO');
--> statement-breakpoint
WITH `permissions`(`permission`) AS (VALUES ('SECRETARIA_VISUALIZAR'),('SECRETARIA_MOVIMENTACOES_VISUALIZAR'),('SECRETARIA_MOVIMENTACOES_GERENCIAR'),('SECRETARIA_TRANSFERENCIAS_SOLICITAR'),('SECRETARIA_TRANSFERENCIAS_APROVAR'),('SECRETARIA_RECEBIMENTOS_GERENCIAR'),('SECRETARIA_BATISMOS_GERENCIAR'),('SECRETARIA_CONSAGRACOES_GERENCIAR'),('SECRETARIA_DOCUMENTOS_EMITIR'),('SECRETARIA_DOCUMENTOS_MODELOS_GERENCIAR'),('SECRETARIA_RELATORIOS'),('SECRETARIA_CONFIGURAR'))
INSERT OR IGNORE INTO `user_permissions` (`user_id`,`permission`,`created_at`) SELECT o.`user_id`,p.`permission`,CURRENT_TIMESTAMP FROM `platform_owners` o CROSS JOIN `permissions` p;
--> statement-breakpoint
INSERT INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(20001,NULL,'secretaria-visao-geral','Nova Secretaria Eclesiástica','Transferências, recebimentos, batismos, consagrações, movimentações e documentos em um só lugar.','Use a Secretaria Eclesiástica para preservar a história das Pessoas sem criar cadastros duplicados. Todas as operações respeitam seu tenant, unidade, permissão e escopo.','Secretaria Eclesiástica',1,'["ADMINISTRADOR","SECRETARIA"]','SECRETARIA_VISUALIZAR','/painel/secretaria',1,1,CURRENT_TIMESTAMP,'29',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(20002,NULL,'secretaria-transferir-membro','Como transferir um membro','Solicite, analise e conclua transferências internas ou externas.','Escolha uma Pessoa existente, confira a unidade atual e informe o destino. A aprovação interna atualiza a unidade em operação atômica, preserva histórico e sinaliza vínculos de Departamentos e EBD para revisão.','Secretaria Eclesiástica',2,'["ADMINISTRADOR","SECRETARIA"]','SECRETARIA_TRANSFERENCIAS_SOLICITAR','/painel/secretaria?aba=transferencias',1,1,CURRENT_TIMESTAMP,'29',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(20003,NULL,'secretaria-receber-membro','Como receber membro de outra igreja','Registre a origem e evite duplicidade.','Pesquise primeiro por nome, código, CPF ou telefone. Vincule uma Pessoa existente ou conclua o cadastro normal antes de registrar o recebimento.','Secretaria Eclesiástica',3,'["ADMINISTRADOR","SECRETARIA"]','SECRETARIA_RECEBIMENTOS_GERENCIAR','/painel/secretaria?aba=movimentacoes',1,1,CURRENT_TIMESTAMP,'29',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(20004,NULL,'secretaria-batismos','Como cadastrar e concluir batismos','Organize eventos, candidatos e certificados.','Crie o evento, adicione Pessoas e acompanhe a preparação. Ao marcar Realizado, a data de batismo é atualizada na ficha com alerta quando já existir, e o histórico é preservado.','Secretaria Eclesiástica',4,'["ADMINISTRADOR","SECRETARIA"]','SECRETARIA_BATISMOS_GERENCIAR','/painel/secretaria?aba=batismos',1,1,CURRENT_TIMESTAMP,'29',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(20005,NULL,'secretaria-consagracoes','Como registrar uma consagração','Atualize a função estruturada e preserve o cargo anterior.','Selecione a Pessoa e uma função ativa do tenant. Ao concluir, a função ministerial é atualizada e a consagração entra no histórico e na auditoria.','Secretaria Eclesiástica',5,'["ADMINISTRADOR","SECRETARIA"]','SECRETARIA_CONSAGRACOES_GERENCIAR','/painel/secretaria?aba=consagracoes',1,1,CURRENT_TIMESTAMP,'29',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(20006,NULL,'secretaria-situacao-eclesiastica','Como registrar afastamento e retorno','Movimente a situação sem apagar a Pessoa.','Afastamento, retorno, desligamento e falecimento geram movimentações e histórico eclesiástico. Cadastros nunca são excluídos por esses atos.','Secretaria Eclesiástica',6,'["ADMINISTRADOR","SECRETARIA"]','SECRETARIA_MOVIMENTACOES_GERENCIAR','/painel/secretaria?aba=movimentacoes',1,1,CURRENT_TIMESTAMP,'29',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(20007,NULL,'secretaria-emitir-documentos','Como emitir documentos','Pré-visualize, confira campos vazios e imprima em A4.','Selecione Pessoa e modelo. O sistema substitui apenas variáveis seguras e guarda o texto, número e versão usados para que documentos antigos não mudem.','Secretaria Eclesiástica',7,'["ADMINISTRADOR","SECRETARIA"]','SECRETARIA_DOCUMENTOS_EMITIR','/painel/secretaria?aba=documentos',1,1,CURRENT_TIMESTAMP,'29',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(20008,NULL,'secretaria-modelos-documentos','Como criar modelo de documento','Personalize modelos sem executar código.','Use texto e variáveis permitidas como {nome_membro}, {codigo_membro}, {funcao}, {nome_igreja}, {data_atual} e {data_batismo}. HTML, JavaScript, SQL e variáveis desconhecidas são recusados.','Secretaria Eclesiástica',8,'["ADMINISTRADOR","SECRETARIA"]','SECRETARIA_DOCUMENTOS_MODELOS_GERENCIAR','/painel/secretaria?aba=modelos',1,1,CURRENT_TIMESTAMP,'29',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(20009,NULL,'secretaria-historico','Como visualizar o histórico eclesiástico','Consulte acontecimentos importantes da vida da Pessoa.','O histórico reúne recebimentos, transferências, batismos, consagrações, afastamentos e retornos. Alterações comuns de contato permanecem somente na auditoria.','Secretaria Eclesiástica',9,'["ADMINISTRADOR","SECRETARIA"]','SECRETARIA_MOVIMENTACOES_VISUALIZAR','/painel/secretaria?aba=historico',1,1,CURRENT_TIMESTAMP,'29',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(20010,NULL,'ebd-aluno-independente','Melhoria na EBD — cadastro independente de alunos','Cadastre na EBD sem exigir vínculo imediato com Pessoas.','Vincular uma Pessoa existente continua recomendado. Quando necessário, cadastre somente na EBD, faça chamadas normalmente e vincule depois sem perder matrícula ou frequência. Também é possível criar uma Pessoa a partir dos dados do aluno.','Escola Bíblica Dominical',9,'["ADMINISTRADOR","EBD"]','EBD_ALUNOS_GERENCIAR','/painel/departamentos?aba=ebd',1,1,CURRENT_TIMESTAMP,'29',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
