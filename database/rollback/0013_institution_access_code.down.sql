DROP INDEX IF EXISTS `institution_lookup_attempts_code_created_idx`;
DROP INDEX IF EXISTS `institution_lookup_attempts_ip_created_idx`;
DROP TABLE IF EXISTS `institution_lookup_attempts`;
DROP INDEX IF EXISTS `tenant_access_contexts_expiry_idx`;
DROP TABLE IF EXISTS `tenant_access_contexts`;
UPDATE `auth_sessions`
SET `tenant_id` = (SELECT `id` FROM `tenants` ORDER BY `id` LIMIT 1)
WHERE `tenant_id` IS NULL;
ALTER TABLE `auth_sessions` DROP COLUMN `platform_context_active`;
CREATE TRIGGER `auth_sessions_tenant_required_insert`
BEFORE INSERT ON `auth_sessions` WHEN NEW.`tenant_id` IS NULL
BEGIN SELECT RAISE(ABORT, 'tenant_id is required'); END;
CREATE TRIGGER `auth_sessions_tenant_required_update`
BEFORE UPDATE OF `tenant_id` ON `auth_sessions` WHEN NEW.`tenant_id` IS NULL
BEGIN SELECT RAISE(ABORT, 'tenant_id is required'); END;
DROP TRIGGER IF EXISTS `tenants_access_code_update_guard`;
DROP TRIGGER IF EXISTS `tenants_access_code_insert_guard`;
DROP INDEX IF EXISTS `tenants_access_code_unique`;
ALTER TABLE `tenants` DROP COLUMN `access_code`;
