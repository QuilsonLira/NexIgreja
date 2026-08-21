CREATE TABLE `notifications` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer,
  `audience` text NOT NULL DEFAULT 'ORGANIZATIONAL' CHECK (`audience` IN ('ORGANIZATIONAL','PLATFORM')),
  `type` text NOT NULL,
  `title` text NOT NULL,
  `message` text NOT NULL,
  `priority` text NOT NULL DEFAULT 'INFO' CHECK (`priority` IN ('INFO','ATENCAO','IMPORTANTE','CRITICA')),
  `internal_route` text,
  `source_entity` text,
  `source_entity_id` integer,
  `unit_id` integer,
  `group_key` text,
  `metadata_json` text,
  `mandatory` integer NOT NULL DEFAULT 0 CHECK (`mandatory` IN (0,1)),
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`unit_id`) REFERENCES `organizational_units`(`id`),
  CHECK ((`audience`='PLATFORM' AND `tenant_id` IS NULL) OR (`audience`='ORGANIZATIONAL' AND `tenant_id` IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `notifications_tenant_type_created_idx` ON `notifications` (`tenant_id`,`type`,`created_at`);
--> statement-breakpoint
CREATE INDEX `notifications_group_key_idx` ON `notifications` (`group_key`,`created_at`);
--> statement-breakpoint
CREATE TABLE `notification_recipients` (
  `notification_id` integer NOT NULL,
  `user_id` integer NOT NULL,
  `read_at` text,
  `archived_at` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`),
  FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`),
  PRIMARY KEY (`notification_id`,`user_id`)
);
--> statement-breakpoint
CREATE INDEX `notification_recipients_user_unread_idx` ON `notification_recipients` (`user_id`,`read_at`,`notification_id`);
--> statement-breakpoint
CREATE INDEX `notification_recipients_user_created_idx` ON `notification_recipients` (`user_id`,`created_at`);
--> statement-breakpoint
INSERT INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(18001,NULL,'como-funcionam-notificacoes','Como funcionam as notificações','Use o sino para acompanhar cadastros, pendências e avisos que precisam da sua atenção.','1. Localize o sino no topo do sistema.\n2. O número sobre o sino mostra quantas notificações ainda não foram lidas.\n3. Clique no sino para ver os avisos recentes.\n4. Clique em uma notificação para marcá-la como lida e abrir a funcionalidade relacionada.\n5. Use Ver todas as notificações para consultar o histórico.\n6. Na página completa, filtre entre Todas, Não lidas e Lidas ou marque todas como lidas.\n\nAs notificações respeitam sua instituição, sua unidade e suas permissões. Elas não concedem acesso a áreas bloqueadas.','Primeiros passos',1,'["TODOS"]',NULL,'/painel/notificacoes',1,1,'2026-08-11','27','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z');
