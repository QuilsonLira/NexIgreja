DROP TRIGGER IF EXISTS `auth_sessions_membership_tenant_update`;
DROP TRIGGER IF EXISTS `auth_sessions_membership_tenant_insert`;
DROP TRIGGER IF EXISTS `tenant_memberships_scope_unit_update`;
DROP TRIGGER IF EXISTS `tenant_memberships_scope_unit_insert`;
UPDATE `auth_users`
SET `status` = COALESCE((SELECT membership.`status` FROM `tenant_memberships` membership WHERE membership.`user_id` = `auth_users`.`id` AND membership.`tenant_id` = `auth_users`.`tenant_id`), `status`),
    `archived_at` = (SELECT membership.`archived_at` FROM `tenant_memberships` membership WHERE membership.`user_id` = `auth_users`.`id` AND membership.`tenant_id` = `auth_users`.`tenant_id`),
    `archived_previous_status` = (SELECT membership.`archived_previous_status` FROM `tenant_memberships` membership WHERE membership.`user_id` = `auth_users`.`id` AND membership.`tenant_id` = `auth_users`.`tenant_id`)
WHERE `tenant_id` IS NOT NULL;
DROP INDEX IF EXISTS `auth_sessions_membership_idx`;
ALTER TABLE `administration_audit` DROP COLUMN `actor_membership_id`;
ALTER TABLE `auth_sessions` DROP COLUMN `membership_id`;
DROP TABLE `membership_permissions`;
DROP INDEX IF EXISTS `tenant_memberships_user_status_idx`;
DROP INDEX IF EXISTS `tenant_memberships_tenant_status_idx`;
DROP INDEX IF EXISTS `tenant_memberships_user_tenant_unique`;
DROP TABLE `tenant_memberships`;
