-- Reversão estrutural. Antes de executar, consolide ou remova identificadores
-- repetidos entre tenants; os índices globais abaixo recusarão ambiguidades.
DROP INDEX IF EXISTS `auth_users_tenant_username_unique`;
DROP INDEX IF EXISTS `auth_users_tenant_email_unique`;
DROP INDEX IF EXISTS `auth_users_tenant_cpf_unique`;
DROP INDEX IF EXISTS `auth_users_platform_username_unique`;
DROP INDEX IF EXISTS `auth_users_platform_email_unique`;
DROP INDEX IF EXISTS `auth_users_platform_cpf_unique`;
DROP INDEX IF EXISTS `auth_users_tenant_status_idx`;
CREATE UNIQUE INDEX `auth_users_username_unique` ON `auth_users` (`username`);
CREATE UNIQUE INDEX `auth_users_email_unique` ON `auth_users` (`email`);
CREATE UNIQUE INDEX `auth_users_cpf_unique` ON `auth_users` (`cpf`);
CREATE INDEX `auth_users_status_idx` ON `auth_users` (`status`);
