DROP INDEX IF EXISTS `audit_logs_tenant_idx`;
ALTER TABLE `audit_logs` DROP COLUMN `tenant_id`;
