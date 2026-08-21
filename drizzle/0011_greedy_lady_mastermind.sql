CREATE TABLE `organizational_functions` (
	`id` integer PRIMARY KEY NOT NULL,
	`tenant_id` integer NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'ATIVO' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizational_functions_tenant_name_unique` ON `organizational_functions` (`tenant_id`,`normalized_name`);--> statement-breakpoint
DROP INDEX `organizational_units_cnpj_unique`;--> statement-breakpoint
ALTER TABLE `organizational_units` ADD `uses_parent_cnpj` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `organizational_units_tenant_own_cnpj_unique` ON `organizational_units` (`tenant_id`,`cnpj`) WHERE "organizational_units"."cnpj" IS NOT NULL AND "organizational_units"."uses_parent_cnpj" = 0;--> statement-breakpoint
ALTER TABLE `tenant_memberships` ADD `function_id` integer REFERENCES organizational_functions(id);--> statement-breakpoint
INSERT INTO `organizational_functions` (`id`, `tenant_id`, `name`, `normalized_name`, `description`, `status`, `created_at`, `updated_at`)
SELECT MIN(`id`), `tenant_id`, MIN(TRIM(`role_name`)), LOWER(TRIM(`role_name`)), NULL, 'ATIVO', MIN(`created_at`), MAX(`updated_at`)
FROM `tenant_memberships`
WHERE TRIM(`role_name`) <> ''
GROUP BY `tenant_id`, LOWER(TRIM(`role_name`));--> statement-breakpoint
UPDATE `tenant_memberships`
SET `function_id` = (
	SELECT `organizational_functions`.`id` FROM `organizational_functions`
	WHERE `organizational_functions`.`tenant_id` = `tenant_memberships`.`tenant_id`
		AND `organizational_functions`.`normalized_name` = LOWER(TRIM(`tenant_memberships`.`role_name`))
);--> statement-breakpoint
INSERT OR IGNORE INTO `membership_permissions` (`membership_id`, `permission`, `created_at`)
SELECT `membership_id`, CASE `permission`
	WHEN 'USUARIOS_VISUALIZAR' THEN 'FUNCOES_VISUALIZAR'
	WHEN 'USUARIOS_CRIAR' THEN 'FUNCOES_CRIAR'
	WHEN 'USUARIOS_EDITAR' THEN 'FUNCOES_EDITAR'
	WHEN 'USUARIOS_DESATIVAR' THEN 'FUNCOES_DESATIVAR'
END, `created_at`
FROM `membership_permissions`
WHERE `permission` IN ('USUARIOS_VISUALIZAR', 'USUARIOS_CRIAR', 'USUARIOS_EDITAR', 'USUARIOS_DESATIVAR');--> statement-breakpoint
INSERT OR IGNORE INTO `user_permissions` (`user_id`, `permission`, `created_at`)
SELECT `user_id`, CASE `permission`
	WHEN 'USUARIOS_VISUALIZAR' THEN 'FUNCOES_VISUALIZAR'
	WHEN 'USUARIOS_CRIAR' THEN 'FUNCOES_CRIAR'
	WHEN 'USUARIOS_EDITAR' THEN 'FUNCOES_EDITAR'
	WHEN 'USUARIOS_DESATIVAR' THEN 'FUNCOES_DESATIVAR'
END, `created_at`
FROM `user_permissions`
WHERE `permission` IN ('USUARIOS_VISUALIZAR', 'USUARIOS_CRIAR', 'USUARIOS_EDITAR', 'USUARIOS_DESATIVAR');--> statement-breakpoint
CREATE TRIGGER `organizational_units_parent_cnpj_insert_guard`
BEFORE INSERT ON `organizational_units`
WHEN NEW.`uses_parent_cnpj` = 1 AND (
	NEW.`type` <> 'FILIAL' OR NEW.`cnpj` IS NOT NULL OR NOT EXISTS (
		SELECT 1 FROM `organizational_units` parent
		WHERE parent.`id` = NEW.`parent_id` AND parent.`tenant_id` = NEW.`tenant_id`
			AND parent.`type` = 'MATRIZ' AND parent.`cnpj` IS NOT NULL
	)
)
BEGIN SELECT RAISE(ABORT, 'CNPJ herdado exige filial e matriz do mesmo tenant com CNPJ próprio'); END;--> statement-breakpoint
CREATE TRIGGER `organizational_units_parent_cnpj_update_guard`
BEFORE UPDATE OF `uses_parent_cnpj`, `cnpj`, `parent_id`, `tenant_id`, `type` ON `organizational_units`
WHEN NEW.`uses_parent_cnpj` = 1 AND (
	NEW.`type` <> 'FILIAL' OR NEW.`cnpj` IS NOT NULL OR NOT EXISTS (
		SELECT 1 FROM `organizational_units` parent
		WHERE parent.`id` = NEW.`parent_id` AND parent.`tenant_id` = NEW.`tenant_id`
			AND parent.`type` = 'MATRIZ' AND parent.`cnpj` IS NOT NULL
	)
)
BEGIN SELECT RAISE(ABORT, 'CNPJ herdado exige filial e matriz do mesmo tenant com CNPJ próprio'); END;--> statement-breakpoint
CREATE TRIGGER `tenant_memberships_function_insert_guard`
BEFORE INSERT ON `tenant_memberships`
WHEN NEW.`function_id` IS NOT NULL AND NOT EXISTS (
	SELECT 1 FROM `organizational_functions` fn
	WHERE fn.`id` = NEW.`function_id` AND fn.`tenant_id` = NEW.`tenant_id`
)
BEGIN SELECT RAISE(ABORT, 'Função fora do tenant do vínculo'); END;--> statement-breakpoint
CREATE TRIGGER `tenant_memberships_function_update_guard`
BEFORE UPDATE OF `function_id`, `tenant_id` ON `tenant_memberships`
WHEN NEW.`function_id` IS NOT NULL AND NOT EXISTS (
	SELECT 1 FROM `organizational_functions` fn
	WHERE fn.`id` = NEW.`function_id` AND fn.`tenant_id` = NEW.`tenant_id`
)
BEGIN SELECT RAISE(ABORT, 'Função fora do tenant do vínculo'); END;
