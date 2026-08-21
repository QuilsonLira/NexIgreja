CREATE TABLE `help_articles` (
  `id` integer PRIMARY KEY NOT NULL,
  `tenant_id` integer,
  `slug` text NOT NULL,
  `title` text NOT NULL,
  `summary` text NOT NULL,
  `content` text NOT NULL,
  `category` text NOT NULL,
  `display_order` integer NOT NULL DEFAULT 0,
  `target_profiles` text NOT NULL DEFAULT '["TODOS"]',
  `required_permission` text,
  `related_route` text,
  `published` integer NOT NULL DEFAULT 1 CHECK (`published` IN (0,1)),
  `is_new_feature` integer NOT NULL DEFAULT 0 CHECK (`is_new_feature` IN (0,1)),
  `released_at` text,
  `version` text NOT NULL DEFAULT '1.0',
  `created_by_user_id` integer,
  `published_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  UNIQUE (`tenant_id`,`slug`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `help_articles_global_slug_unique` ON `help_articles` (`slug`) WHERE `tenant_id` IS NULL;
--> statement-breakpoint
CREATE INDEX `help_articles_visibility_idx` ON `help_articles` (`published`,`category`,`display_order`,`released_at`);
--> statement-breakpoint
CREATE TABLE `help_article_reads` (
  `user_id` integer NOT NULL,
  `article_id` integer NOT NULL,
  `viewed_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`),
  FOREIGN KEY (`article_id`) REFERENCES `help_articles`(`id`),
  PRIMARY KEY (`user_id`,`article_id`)
);
--> statement-breakpoint
CREATE TABLE `data_export_audit` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `actor_user_id` integer NOT NULL,
  `actor_membership_id` integer,
  `tenant_id` integer NOT NULL,
  `export_type` text NOT NULL,
  `modules` text NOT NULL,
  `format` text NOT NULL,
  `record_count` integer NOT NULL DEFAULT 0,
  `scope_unit_id` integer,
  `status` text NOT NULL,
  `details` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`),
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`scope_unit_id`) REFERENCES `organizational_units`(`id`)
);
--> statement-breakpoint
CREATE INDEX `data_export_audit_tenant_created_idx` ON `data_export_audit` (`tenant_id`,`created_at`);
--> statement-breakpoint
INSERT INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(17001,NULL,'compartilhar-ficha-pre-cadastro','Compartilhar ficha de cadastro','Gere um link para que a própria pessoa preencha a ficha de pré-cadastro.','1. Acesse Pessoas / Membros.\n2. Abra Links públicos.\n3. Clique em Gerar formulário.\n4. Copie ou compartilhe o link.\n5. Aguarde o envio.\n6. Abra Pré-cadastros.\n7. Analise e aprove ou recuse.','Pré-Cadastro',1,'["ADMIN_FILIAL","ADMIN_MATRIZ","ADMIN_CONVENCAO","PLATFORM_OWNER"]','FORMULARIOS_PRECADASTRO_GERENCIAR','/painel/membros/formularios',1,1,'2026-08-11','25','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z'),
(17002,NULL,'aprovar-pre-cadastro','Como aprovar um pré-cadastro','Confira os dados enviados antes de transformá-los em um cadastro de membro.','1. Acesse Pessoas / Membros.\n2. Clique em Pré-cadastros.\n3. Abra o cadastro pendente.\n4. Confira e corrija os dados.\n5. Clique em Aprovar cadastro.\n6. Confirme a operação.','Pré-Cadastro',2,'["ADMIN_FILIAL","ADMIN_MATRIZ","ADMIN_CONVENCAO","PLATFORM_OWNER"]','PRECADASTROS_APROVAR','/painel/membros/pre-cadastros',1,1,'2026-08-11','25','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z'),
(17003,NULL,'cadastrar-membro','Cadastrar e localizar membros','Cadastre pessoas e consulte suas fichas respeitando seu alcance organizacional.','1. Acesse Pessoas / Membros.\n2. Clique em Novo membro.\n3. Preencha os dados disponíveis.\n4. Confira Matriz e Filial.\n5. Salve o cadastro.\nUse os filtros para localizar por nome, código, CPF, RG, título, telefone ou e-mail.','Membros',10,'["USUARIO","ADMIN_FILIAL","ADMIN_MATRIZ","ADMIN_CONVENCAO","PLATFORM_OWNER"]','MEMBROS_VISUALIZAR','/painel/membros',1,0,'2026-08-01','1.0','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z'),
(17004,NULL,'usuarios-permissoes','Usuários, vínculos e permissões','Entenda como liberar somente as áreas necessárias para cada pessoa.','1. Acesse Vínculos.\n2. Crie ou abra um usuário.\n3. Defina o perfil e a unidade de alcance.\n4. Marque somente as permissões necessárias.\n5. Salve e, se necessário, redefina a senha.','Usuários',20,'["ADMIN_MATRIZ","ADMIN_CONVENCAO","PLATFORM_OWNER"]','USUARIOS_VISUALIZAR','/painel/usuarios',1,0,'2026-08-01','1.0','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z'),
(17005,NULL,'unidades-organizacionais','Convenção, Matrizes e Filiais','Organize a estrutura da instituição sem ultrapassar seu perfil de acesso.','Acesse Unidades para consultar a estrutura. Administradores autorizados podem criar, editar, ativar ou desativar unidades. O seletor no topo define a unidade atual de trabalho.','Unidades',30,'["ADMIN_MATRIZ","ADMIN_CONVENCAO","PLATFORM_OWNER"]','UNIDADES_VISUALIZAR','/painel/unidades',1,0,'2026-08-01','1.0','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z'),
(17006,NULL,'login-e-senha','Acesso, senha e segurança','Saiba como entrar, trocar sua senha e encerrar a sessão.','Use o código da instituição e depois informe CPF, usuário ou e-mail. No primeiro acesso, troque a senha temporária. Use Sair para encerrar completamente a sessão. Em caso de bloqueio, procure um administrador autorizado.','Acesso e Login',40,'["TODOS"]',NULL,'/painel',1,0,'2026-08-01','1.0','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z'),
(17007,NULL,'dados-exportacao','Exportar dados e criar pacote de portabilidade','Baixe dados autorizados em Excel, CSV, JSON ou pacote completo.','1. Acesse Dados e Exportação.\n2. Escolha o tipo e o formato.\n3. Confirme o aviso de dados pessoais.\n4. Baixe o arquivo.\nA exportação é somente leitura, respeita a instituição e o alcance do usuário e nunca inclui senhas, sessões, tokens ou segredos.','Dados e Backup',3,'["ADMIN_FILIAL","ADMIN_MATRIZ","ADMIN_CONVENCAO","PLATFORM_OWNER"]','DADOS_EXPORTAR','/painel/dados-exportacao',1,1,'2026-08-11','26','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z'),
(17008,NULL,'administracao-plataforma','Administração da Plataforma','Guia exclusivo do proprietário para clientes, planos, cobrança e auditoria.','Use Clientes SaaS para cadastrar e administrar tenants e códigos institucionais. Use Comercial para planos, assinaturas, testes, cobranças, carência, suspensão e reativação. Entre no contexto de um cliente antes de acessar dados organizacionais ou gerar exportações.','Administração',50,'["PLATFORM_OWNER"]',NULL,'/painel/plataforma/clientes',1,0,'2026-08-01','1.0','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z'),
(17009,NULL,'perguntas-frequentes','Perguntas frequentes','Respostas rápidas sobre acesso, permissões, unidades e segurança dos dados.','Não encontro uma área do sistema.\nA área pode estar oculta porque seu vínculo não possui a permissão necessária. Procure o administrador da sua instituição.\n\nPosso trabalhar em outra unidade?\nSomente se o alcance do seu vínculo permitir. Use o seletor no topo.\n\nA exportação altera os dados?\nNão. Exportar é uma operação somente de leitura.\n\nEsqueci minha senha.\nPeça a um administrador autorizado para redefini-la.','Perguntas frequentes',60,'["TODOS"]',NULL,'/painel/ajuda',1,0,'2026-08-11','1.0','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z','2026-08-11T00:00:00.000Z');
--> statement-breakpoint
WITH `new_permissions`(`permission`) AS (VALUES ('DADOS_EXPORTAR'),('DADOS_EXPORTAR_COMPLETO'))
INSERT OR IGNORE INTO `membership_permissions` (`membership_id`,`permission`,`created_at`)
SELECT m.`id`,p.`permission`,CURRENT_TIMESTAMP FROM `tenant_memberships` m CROSS JOIN `new_permissions` p WHERE m.`scope`='CONVENCAO' AND m.`status`='ATIVO' AND m.`archived_at` IS NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO `membership_permissions` (`membership_id`,`permission`,`created_at`)
SELECT m.`id`,'DADOS_EXPORTAR',CURRENT_TIMESTAMP FROM `tenant_memberships` m WHERE m.`scope` IN ('MATRIZ','FILIAL') AND m.`status`='ATIVO' AND m.`archived_at` IS NULL AND m.`role_name` LIKE 'Administrador%';
--> statement-breakpoint
WITH `new_permissions`(`permission`) AS (VALUES ('DADOS_EXPORTAR'),('DADOS_EXPORTAR_COMPLETO'))
INSERT OR IGNORE INTO `user_permissions` (`user_id`,`permission`,`created_at`)
SELECT o.`user_id`,p.`permission`,CURRENT_TIMESTAMP FROM `platform_owners` o CROSS JOIN `new_permissions` p;
