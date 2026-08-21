CREATE TABLE `finance_contribution_category_defaults` (
  `tenant_id` integer NOT NULL,
  `contribution_type` text NOT NULL CHECK (`contribution_type` IN ('DIZIMO','OFERTA','VOTO','DOACAO','MISSOES','CAMPANHA','OFERTA_VOLUNTARIA','OUTRA')),
  `category_id` integer NOT NULL,
  `created_by_user_id` integer NOT NULL,
  `updated_by_user_id` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`tenant_id`,`contribution_type`),
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`category_id`,`tenant_id`) REFERENCES `finance_categories`(`id`,`tenant_id`),
  FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`),
  FOREIGN KEY (`updated_by_user_id`) REFERENCES `auth_users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `finance_contribution_category_defaults_category_idx`
ON `finance_contribution_category_defaults` (`tenant_id`,`category_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `help_articles` (`id`,`tenant_id`,`slug`,`title`,`summary`,`content`,`category`,`display_order`,`target_profiles`,`required_permission`,`related_route`,`published`,`is_new_feature`,`released_at`,`version`,`published_at`,`created_at`,`updated_at`) VALUES
(31001,NULL,'financeiro-categorias-lancamento-rapido','Categorias no Lançamento Rápido','Associe cada tipo de contribuição a uma Categoria Financeira.','Cada tipo de contribuição deve possuir uma Categoria Financeira associada. O NexIgreja usa o ID dessa categoria para saber se o valor participa do rateio. Ao escolher uma categoria no Lançamento Rápido, ela fica como padrão daquele tipo para os próximos lançamentos do mesmo cliente.','Financeiro',61,'["TODOS"]','FINANCEIRO_LANCAMENTO_RAPIDO','/painel/financeiro/rapido',1,1,'2026-08-14','44',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
