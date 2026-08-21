DROP TABLE IF EXISTS `member_pre_registration_rate_limits`;
DROP TABLE IF EXISTS `member_pre_registration_custom_values`;
DROP TABLE IF EXISTS `member_pre_registration_photos`;
DROP TABLE IF EXISTS `member_pre_registrations`;
DROP TABLE IF EXISTS `member_pre_registration_forms`;
DROP TABLE IF EXISTS `member_custom_values`;
DROP TABLE IF EXISTS `member_custom_fields`;
DROP INDEX IF EXISTS `people_tenant_voter_title_idx`;
ALTER TABLE `people` DROP COLUMN `voter_title`;
