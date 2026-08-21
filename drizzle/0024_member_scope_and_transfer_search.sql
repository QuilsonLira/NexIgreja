ALTER TABLE `secretary_requests` ADD COLUMN `request_direction` text NOT NULL DEFAULT 'SAIDA' CHECK (`request_direction` IN ('SAIDA','RECEBIMENTO'));
--> statement-breakpoint
CREATE INDEX `secretary_requests_pending_destination_idx` ON `secretary_requests` (`tenant_id`,`person_id`,`destination_unit_id`,`status`);
--> statement-breakpoint
CREATE TABLE `secretary_transfer_search_limits` (
  `tenant_id` integer NOT NULL,
  `user_id` integer NOT NULL,
  `attempts` integer NOT NULL DEFAULT 0,
  `window_started_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`),
  PRIMARY KEY (`tenant_id`,`user_id`)
);
--> statement-breakpoint
CREATE INDEX `secretary_transfer_search_limits_window_idx` ON `secretary_transfer_search_limits` (`window_started_at`,`updated_at`);
--> statement-breakpoint
INSERT INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(24001,NULL,'membro-filial-unidade-automatica','Cadastro de membro por usuário de Filial','Matriz e Filial são preenchidas automaticamente.','Ao cadastrar ou editar uma Pessoa com acesso restrito à Filial, o NexIgreja identifica a Matriz pai e a Filial atual. Os dois campos aparecem preenchidos e bloqueados. Isso evita cadastrar acidentalmente como membro direto da Matriz e não concede acesso a outras unidades.','Membros',11,'["ADMIN_FILIAL","SECRETARIA"]','MEMBROS_VISUALIZAR','/painel/membros',1,1,CURRENT_TIMESTAMP,'35',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(24002,NULL,'secretaria-solicitar-recebimento-interno','Solicitar recebimento de membro de outra unidade','Pesquise pessoas elegíveis e aguarde a aprovação da origem.','Em Secretaria Eclesiástica, abra Transferências, escolha Solicitar recebimento e digite pelo menos três caracteres do nome ou código. A busca mostra somente nome, código, situação e unidade atual. Selecione a Pessoa, confirme sua unidade como destino e envie a solicitação. A mudança ocorre somente após aprovação da unidade de origem.','Secretaria Eclesiástica',11,'["ADMINISTRADOR","SECRETARIA"]','SECRETARIA_TRANSFERENCIAS_SOLICITAR','/painel/secretaria?aba=transferencias',1,1,CURRENT_TIMESTAMP,'35',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(24003,NULL,'melhorias-cadastro-transferencias','Melhorias no cadastro de membros e transferências','Correção de unidade automática e nova busca de recebimento.','A seleção de Matriz e Filial agora é automática para usuários restritos à Filial. Solicitações de recebimento também podem localizar, de forma limitada e segura, membros elegíveis de outras unidades do mesmo tenant.','Novidades',1,'["ADMINISTRADOR","SECRETARIA"]','SECRETARIA_VISUALIZAR','/painel/secretaria?aba=transferencias',1,1,CURRENT_TIMESTAMP,'35',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
