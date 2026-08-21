CREATE UNIQUE INDEX IF NOT EXISTS `tenant_memberships_id_tenant_unique` ON `tenant_memberships` (`id`,`tenant_id`);
--> statement-breakpoint
CREATE TABLE `departments` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `name` text NOT NULL,
  `acronym` text,
  `description` text,
  `type` text NOT NULL CHECK (`type` IN ('DEPARTAMENTO','MINISTERIO','GRUPO','EQUIPE','ESCOLA_BIBLICA','OUTRO')),
  `unit_id` integer NOT NULL,
  `convention_id` integer NOT NULL,
  `matrix_id` integer,
  `branch_id` integer,
  `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','INATIVO')),
  `enabled_features` text NOT NULL DEFAULT '["PARTICIPANTES","AGENDA","FREQUENCIA","COMUNICACAO"]',
  `absence_alert_threshold` integer NOT NULL DEFAULT 3 CHECK (`absence_alert_threshold` BETWEEN 1 AND 20),
  `version` integer NOT NULL DEFAULT 1,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`convention_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`matrix_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`branch_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`unit_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `departments_tenant_scope_status_idx` ON `departments` (`tenant_id`,`convention_id`,`matrix_id`,`branch_id`,`status`);
--> statement-breakpoint
CREATE INDEX `departments_tenant_type_idx` ON `departments` (`tenant_id`,`type`,`name`);
--> statement-breakpoint
CREATE TABLE `department_roles` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `department_id` integer NOT NULL,
  `name` text NOT NULL,
  `is_leadership` integer NOT NULL DEFAULT 0 CHECK (`is_leadership` IN (0,1)),
  `display_order` integer NOT NULL DEFAULT 0,
  `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','INATIVO')),
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`department_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `department_roles_department_idx` ON `department_roles` (`tenant_id`,`department_id`,`status`,`display_order`);
--> statement-breakpoint
CREATE TABLE `department_participants` (
  `department_id` integer NOT NULL,
  `tenant_id` integer NOT NULL,
  `person_id` integer NOT NULL,
  `role_id` integer,
  `joined_at` text NOT NULL,
  `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','INATIVO')),
  `left_at` text,
  `exit_reason` text,
  `notes` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  FOREIGN KEY (`role_id`) REFERENCES `department_roles`(`id`),
  PRIMARY KEY (`department_id`,`person_id`)
);
--> statement-breakpoint
CREATE INDEX `department_participants_tenant_person_idx` ON `department_participants` (`tenant_id`,`person_id`,`status`);
--> statement-breakpoint
CREATE INDEX `department_participants_department_status_idx` ON `department_participants` (`tenant_id`,`department_id`,`status`,`joined_at`);
--> statement-breakpoint
CREATE TABLE `department_access` (
  `department_id` integer NOT NULL,
  `tenant_id` integer NOT NULL,
  `membership_id` integer NOT NULL,
  `role_id` integer,
  `permissions_json` text NOT NULL DEFAULT '[]',
  `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','INATIVO')),
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  FOREIGN KEY (`membership_id`,`tenant_id`) REFERENCES `tenant_memberships`(`id`,`tenant_id`),
  FOREIGN KEY (`role_id`) REFERENCES `department_roles`(`id`),
  PRIMARY KEY (`department_id`,`membership_id`)
);
--> statement-breakpoint
CREATE INDEX `department_access_membership_idx` ON `department_access` (`tenant_id`,`membership_id`,`status`,`department_id`);
--> statement-breakpoint
CREATE TABLE `department_events` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `department_id` integer NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `event_date` text NOT NULL,
  `start_time` text,
  `location` text,
  `responsible_person_id` integer,
  `notes` text,
  `status` text NOT NULL DEFAULT 'AGENDADO' CHECK (`status` IN ('AGENDADO','REALIZADO','CANCELADO')),
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  FOREIGN KEY (`responsible_person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `department_events_department_date_idx` ON `department_events` (`tenant_id`,`department_id`,`event_date`,`status`);
--> statement-breakpoint
CREATE TABLE `department_activities` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `department_id` integer NOT NULL,
  `activity_date` text NOT NULL,
  `title` text NOT NULL,
  `notes` text,
  `status` text NOT NULL DEFAULT 'ABERTA' CHECK (`status` IN ('ABERTA','FINALIZADA')),
  `version` integer NOT NULL DEFAULT 1,
  `finalized_by_user_id` integer,
  `finalized_at` text,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  FOREIGN KEY (`finalized_by_user_id`) REFERENCES `auth_users`(`id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `department_activities_department_date_idx` ON `department_activities` (`tenant_id`,`department_id`,`activity_date`,`status`);
--> statement-breakpoint
CREATE TABLE `department_attendance` (
  `activity_id` integer NOT NULL,
  `tenant_id` integer NOT NULL,
  `department_id` integer NOT NULL,
  `person_id` integer NOT NULL,
  `attendance_status` text NOT NULL CHECK (`attendance_status` IN ('PRESENTE','AUSENTE','JUSTIFICADO','NAO_INFORMADO')),
  `notes` text,
  `updated_by_user_id` integer NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`activity_id`) REFERENCES `department_activities`(`id`),
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  FOREIGN KEY (`updated_by_user_id`) REFERENCES `auth_users`(`id`),
  PRIMARY KEY (`activity_id`,`person_id`)
);
--> statement-breakpoint
CREATE INDEX `department_attendance_person_idx` ON `department_attendance` (`tenant_id`,`person_id`,`attendance_status`,`activity_id`);
--> statement-breakpoint
CREATE TABLE `department_communications` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `department_id` integer NOT NULL,
  `message` text NOT NULL,
  `audience` text NOT NULL,
  `channel` text NOT NULL DEFAULT 'COPIAR_COMPARTILHAR',
  `recipient_count` integer NOT NULL DEFAULT 0,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `department_communications_department_created_idx` ON `department_communications` (`tenant_id`,`department_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `ebd_classes` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `department_id` integer NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `age_range` text,
  `room` text,
  `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','INATIVO')),
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  UNIQUE (`id`,`tenant_id`),
  UNIQUE (`tenant_id`,`department_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `ebd_classes_department_status_idx` ON `ebd_classes` (`tenant_id`,`department_id`,`status`,`name`);
--> statement-breakpoint
CREATE TABLE `ebd_class_teachers` (
  `class_id` integer NOT NULL,
  `tenant_id` integer NOT NULL,
  `membership_id` integer NOT NULL,
  `person_id` integer,
  `teacher_role` text NOT NULL CHECK (`teacher_role` IN ('PRINCIPAL','AUXILIAR','SUBSTITUTO')),
  `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','INATIVO')),
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`class_id`,`tenant_id`) REFERENCES `ebd_classes`(`id`,`tenant_id`),
  FOREIGN KEY (`membership_id`,`tenant_id`) REFERENCES `tenant_memberships`(`id`,`tenant_id`),
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  PRIMARY KEY (`class_id`,`membership_id`)
);
--> statement-breakpoint
CREATE INDEX `ebd_class_teachers_membership_idx` ON `ebd_class_teachers` (`tenant_id`,`membership_id`,`status`,`class_id`);
--> statement-breakpoint
CREATE TABLE `ebd_enrollments` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `department_id` integer NOT NULL,
  `class_id` integer NOT NULL,
  `person_id` integer NOT NULL,
  `enrolled_at` text NOT NULL,
  `status` text NOT NULL DEFAULT 'ATIVO' CHECK (`status` IN ('ATIVO','TRANSFERIDO','INATIVO')),
  `left_at` text,
  `notes` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  FOREIGN KEY (`class_id`,`tenant_id`) REFERENCES `ebd_classes`(`id`,`tenant_id`),
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ebd_enrollments_active_person_unique` ON `ebd_enrollments` (`tenant_id`,`department_id`,`person_id`) WHERE `status`='ATIVO';
--> statement-breakpoint
CREATE INDEX `ebd_enrollments_class_status_idx` ON `ebd_enrollments` (`tenant_id`,`class_id`,`status`,`person_id`);
--> statement-breakpoint
CREATE TABLE `ebd_meetings` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `department_id` integer NOT NULL,
  `meeting_date` text NOT NULL,
  `theme` text,
  `start_time` text,
  `status` text NOT NULL DEFAULT 'ABERTO' CHECK (`status` IN ('ABERTO','FINALIZADO')),
  `version` integer NOT NULL DEFAULT 1,
  `created_by_user_id` integer NOT NULL,
  `finalized_by_user_id` integer,
  `finalized_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  FOREIGN KEY (`finalized_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`tenant_id`,`department_id`,`meeting_date`)
);
--> statement-breakpoint
CREATE INDEX `ebd_meetings_department_date_idx` ON `ebd_meetings` (`tenant_id`,`department_id`,`meeting_date`,`status`);
--> statement-breakpoint
CREATE TABLE `ebd_attendance` (
  `meeting_id` integer NOT NULL,
  `class_id` integer NOT NULL,
  `tenant_id` integer NOT NULL,
  `person_id` integer NOT NULL,
  `attendance_status` text NOT NULL CHECK (`attendance_status` IN ('PRESENTE','AUSENTE','JUSTIFICADO','NAO_INFORMADO')),
  `updated_by_user_id` integer NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`meeting_id`) REFERENCES `ebd_meetings`(`id`),
  FOREIGN KEY (`class_id`,`tenant_id`) REFERENCES `ebd_classes`(`id`,`tenant_id`),
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  FOREIGN KEY (`updated_by_user_id`) REFERENCES `auth_users`(`id`),
  PRIMARY KEY (`meeting_id`,`class_id`,`person_id`)
);
--> statement-breakpoint
CREATE INDEX `ebd_attendance_person_history_idx` ON `ebd_attendance` (`tenant_id`,`person_id`,`attendance_status`,`meeting_id`);
--> statement-breakpoint
CREATE INDEX `ebd_attendance_class_meeting_idx` ON `ebd_attendance` (`tenant_id`,`class_id`,`meeting_id`,`attendance_status`);
--> statement-breakpoint
CREATE TABLE `ebd_visitors` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `department_id` integer NOT NULL,
  `meeting_id` integer NOT NULL,
  `class_id` integer NOT NULL,
  `person_id` integer,
  `name` text NOT NULL,
  `phone` text,
  `age_range` text,
  `invited_by` text,
  `notes` text,
  `created_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  FOREIGN KEY (`meeting_id`) REFERENCES `ebd_meetings`(`id`),
  FOREIGN KEY (`class_id`,`tenant_id`) REFERENCES `ebd_classes`(`id`,`tenant_id`),
  FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `ebd_visitors_meeting_class_idx` ON `ebd_visitors` (`tenant_id`,`meeting_id`,`class_id`);
--> statement-breakpoint
CREATE TABLE `ebd_class_summaries` (
  `meeting_id` integer NOT NULL,
  `class_id` integer NOT NULL,
  `tenant_id` integer NOT NULL,
  `enrolled_count` integer NOT NULL DEFAULT 0,
  `present_count` integer NOT NULL DEFAULT 0,
  `absent_count` integer NOT NULL DEFAULT 0,
  `justified_count` integer NOT NULL DEFAULT 0,
  `visitor_count` integer NOT NULL DEFAULT 0,
  `bible_count` integer NOT NULL DEFAULT 0,
  `assistance_count` integer NOT NULL DEFAULT 0,
  `offering_cents` integer NOT NULL DEFAULT 0,
  `notes` text,
  `status` text NOT NULL DEFAULT 'RASCUNHO' CHECK (`status` IN ('RASCUNHO','FINALIZADA')),
  `version` integer NOT NULL DEFAULT 1,
  `finalized_by_user_id` integer,
  `finalized_at` text,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`meeting_id`) REFERENCES `ebd_meetings`(`id`),
  FOREIGN KEY (`class_id`,`tenant_id`) REFERENCES `ebd_classes`(`id`,`tenant_id`),
  FOREIGN KEY (`finalized_by_user_id`) REFERENCES `auth_users`(`id`),
  PRIMARY KEY (`meeting_id`,`class_id`)
);
--> statement-breakpoint
CREATE INDEX `ebd_class_summaries_status_idx` ON `ebd_class_summaries` (`tenant_id`,`meeting_id`,`status`,`class_id`);
--> statement-breakpoint
CREATE TABLE `ebd_closures` (
  `meeting_id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer NOT NULL,
  `department_id` integer NOT NULL,
  `enrolled_total` integer NOT NULL,
  `present_total` integer NOT NULL,
  `absent_total` integer NOT NULL,
  `justified_total` integer NOT NULL,
  `visitor_total` integer NOT NULL,
  `bible_total` integer NOT NULL,
  `assistance_total` integer NOT NULL,
  `offering_total_cents` integer NOT NULL,
  `exception_reason` text,
  `finalized_by_user_id` integer NOT NULL,
  `finalized_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  FOREIGN KEY (`meeting_id`) REFERENCES `ebd_meetings`(`id`),
  FOREIGN KEY (`finalized_by_user_id`) REFERENCES `auth_users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `ebd_closures_department_date_idx` ON `ebd_closures` (`tenant_id`,`department_id`,`finalized_at`);
--> statement-breakpoint
CREATE TABLE `department_audit` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `tenant_id` integer NOT NULL,
  `department_id` integer NOT NULL,
  `actor_user_id` integer NOT NULL,
  `actor_membership_id` integer,
  `action` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` integer NOT NULL,
  `previous_values` text,
  `new_values` text,
  `reason` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`department_id`,`tenant_id`) REFERENCES `departments`(`id`,`tenant_id`),
  FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`),
  FOREIGN KEY (`actor_membership_id`) REFERENCES `tenant_memberships`(`id`)
);
--> statement-breakpoint
CREATE INDEX `department_audit_department_created_idx` ON `department_audit` (`tenant_id`,`department_id`,`created_at`);
--> statement-breakpoint
WITH `department_permissions`(`permission`) AS (VALUES
 ('DEPARTAMENTO_VISUALIZAR'),('DEPARTAMENTO_PARTICIPANTES_VISUALIZAR'),('DEPARTAMENTO_PARTICIPANTES_GERENCIAR'),('DEPARTAMENTO_LIDERANCA_GERENCIAR'),
 ('DEPARTAMENTO_AGENDA_VISUALIZAR'),('DEPARTAMENTO_AGENDA_GERENCIAR'),('DEPARTAMENTO_FREQUENCIA_VISUALIZAR'),('DEPARTAMENTO_FREQUENCIA_LANCAR'),
 ('DEPARTAMENTO_COMUNICACAO'),('DEPARTAMENTO_RELATORIOS'),('DEPARTAMENTO_CONFIGURAR'),('EBD_VISUALIZAR'),('EBD_GERENCIAR'),('EBD_CLASSES_GERENCIAR'),
 ('EBD_ALUNOS_VISUALIZAR'),('EBD_ALUNOS_GERENCIAR'),('EBD_CHAMADA_LANCAR'),('EBD_CHAMADA_CORRIGIR'),('EBD_SECRETARIA'),('EBD_FECHAMENTO'),
 ('EBD_RELATORIOS'),('EBD_CONFIGURAR'))
INSERT OR IGNORE INTO `membership_permissions` (`membership_id`,`permission`,`created_at`)
SELECT m.`id`,p.`permission`,CURRENT_TIMESTAMP FROM `tenant_memberships` m CROSS JOIN `department_permissions` p
WHERE m.`status`='ATIVO' AND m.`archived_at` IS NULL AND m.`role_name` LIKE 'Administrador%';
--> statement-breakpoint
WITH `department_permissions`(`permission`) AS (VALUES
 ('DEPARTAMENTO_VISUALIZAR'),('DEPARTAMENTO_PARTICIPANTES_VISUALIZAR'),('DEPARTAMENTO_PARTICIPANTES_GERENCIAR'),('DEPARTAMENTO_LIDERANCA_GERENCIAR'),
 ('DEPARTAMENTO_AGENDA_VISUALIZAR'),('DEPARTAMENTO_AGENDA_GERENCIAR'),('DEPARTAMENTO_FREQUENCIA_VISUALIZAR'),('DEPARTAMENTO_FREQUENCIA_LANCAR'),
 ('DEPARTAMENTO_COMUNICACAO'),('DEPARTAMENTO_RELATORIOS'),('DEPARTAMENTO_CONFIGURAR'),('EBD_VISUALIZAR'),('EBD_GERENCIAR'),('EBD_CLASSES_GERENCIAR'),
 ('EBD_ALUNOS_VISUALIZAR'),('EBD_ALUNOS_GERENCIAR'),('EBD_CHAMADA_LANCAR'),('EBD_CHAMADA_CORRIGIR'),('EBD_SECRETARIA'),('EBD_FECHAMENTO'),
 ('EBD_RELATORIOS'),('EBD_CONFIGURAR'))
INSERT OR IGNORE INTO `user_permissions` (`user_id`,`permission`,`created_at`)
SELECT o.`user_id`,p.`permission`,CURRENT_TIMESTAMP FROM `platform_owners` o CROSS JOIN `department_permissions` p;
--> statement-breakpoint
INSERT INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(19001,NULL,'departamentos-ministerios','Departamentos e Ministérios','Crie áreas administrativas com participantes, liderança, agenda, frequência e comunicação.','Acesse Departamentos no menu. Crie o departamento na unidade correta, escolha o tipo e ative os recursos necessários. Depois, adicione participantes já cadastrados, defina funções internas e conceda acessos individuais. Cada usuário enxerga somente os departamentos autorizados.','Departamentos e Ministérios',1,'["ADMIN_FILIAL","ADMIN_MATRIZ","ADMIN_CONVENCAO","PLATFORM_OWNER"]','DEPARTAMENTO_CONFIGURAR','/painel/departamentos',1,1,'2026-08-11','28','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z'),
(19002,NULL,'departamento-participantes-lideranca','Participantes e liderança','Use pessoas existentes sem duplicar cadastros.','Abra o departamento, acesse Participantes e pesquise pelo nome. A função do departamento é independente da função ministerial. Use Acessos para autorizar presidente, secretário ou outro responsável por meio do login individual.','Departamentos e Ministérios',2,'["TODOS"]','DEPARTAMENTO_PARTICIPANTES_VISUALIZAR','/painel/departamentos',1,1,'2026-08-11','28','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z'),
(19003,NULL,'departamento-agenda-frequencia','Agenda, frequência e comunicação','Organize compromissos, chamadas e mensagens do departamento.','Cadastre eventos na Agenda. Em Frequência, crie uma atividade, marque Presente, Ausente ou Justificado e finalize. Em Comunicação, selecione o público e copie a mensagem; os telefones vêm do cadastro da pessoa.','Departamentos e Ministérios',3,'["TODOS"]','DEPARTAMENTO_VISUALIZAR','/painel/departamentos',1,1,'2026-08-11','28','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z'),
(19004,NULL,'ebd-criar-classes','Criar EBD e classes','Configure a Escola Bíblica e suas classes personalizadas.','Crie um departamento do tipo Escola Bíblica. Abra a área EBD e cadastre classes como Primários, Juniores, Jovens ou Adultos. Defina sala, faixa etária e professores com login individual.','Escola Bíblica Dominical',1,'["ADMIN_FILIAL","ADMIN_MATRIZ","ADMIN_CONVENCAO","PLATFORM_OWNER"]','EBD_CLASSES_GERENCIAR','/painel/departamentos',1,1,'2026-08-11','28','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z'),
(19005,NULL,'ebd-professor-chamada','Como o professor faz a chamada','Faça toda a chamada pelo celular, somente na classe atribuída.','Abra Departamentos, selecione a EBD e entre em Chamada. Escolha sua classe, marque todos presentes e altere faltas ou justificativas. Informe visitantes, Bíblias, assistências e oferta. Revise antes de Finalizar chamada.','Escola Bíblica Dominical',2,'["USUARIO"]','EBD_CHAMADA_LANCAR','/painel/departamentos',1,1,'2026-08-11','28','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z'),
(19006,NULL,'ebd-secretaria-fechamento','Secretaria e fechamento da EBD','Acompanhe classes e calcule automaticamente o resumo geral.','A Secretaria acompanha o status de cada classe. Quando todas estiverem finalizadas, abra Fechamento e confira os totais de matriculados, presentes, ausentes, justificados, visitantes, Bíblias, assistências e ofertas. Finalize para travar o encontro e registrar auditoria.','Escola Bíblica Dominical',3,'["ADMIN_FILIAL","ADMIN_MATRIZ","ADMIN_CONVENCAO","PLATFORM_OWNER"]','EBD_SECRETARIA','/painel/departamentos',1,1,'2026-08-11','28','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z'),
(19007,NULL,'ebd-visitantes-indicadores','Visitantes, Bíblias, assistências e oferta','Entenda os indicadores informados em cada classe.','Visitantes podem ser vinculados a uma pessoa existente ou registrados apenas para o encontro. Bíblias e assistências são quantidades informadas pela classe. Oferta é guardada em centavos e auditada, sem lançamento automático no Financeiro.','Escola Bíblica Dominical',4,'["TODOS"]','EBD_VISUALIZAR','/painel/departamentos',1,1,'2026-08-11','28','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z'),
(19008,NULL,'ebd-modo-leitura-relatorios','Modo de leitura e relatórios','Apresente o resumo final e acompanhe os resultados.','Depois do fechamento, use Modo de leitura para exibir os totais com letras grandes. Em Relatórios, consulte frequência, oferta, visitantes e faltas consecutivas por período ou classe.','Escola Bíblica Dominical',5,'["ADMIN_FILIAL","ADMIN_MATRIZ","ADMIN_CONVENCAO","PLATFORM_OWNER"]','EBD_RELATORIOS','/painel/departamentos',1,1,'2026-08-11','28','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z');
