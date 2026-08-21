CREATE TABLE `administration_audit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_user_id` int NOT NULL,
	`actor_membership_id` int,
	`tenant_id` int NOT NULL,
	`convention_id` int NOT NULL,
	`action` varchar(191) NOT NULL,
	`entity_type` varchar(80) NOT NULL,
	`entity_id` int NOT NULL,
	`unit_id` int,
	`ip_address` varchar(191),
	`user_agent` text,
	`device_summary` varchar(191),
	`details` text,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `administration_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`tenant_id` int,
	`event` varchar(191) NOT NULL,
	`identifier_type` varchar(80),
	`reason` varchar(191) NOT NULL,
	`matrix_id` int,
	`branch_id` int,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` varchar(191) NOT NULL,
	`token_hash` varchar(191) NOT NULL,
	`user_id` int NOT NULL,
	`tenant_id` int,
	`membership_id` int,
	`organization_selection_required` boolean NOT NULL DEFAULT false,
	`platform_context_active` boolean NOT NULL DEFAULT false,
	`selected_unit_id` int,
	`previous_login_at` varchar(40),
	`previous_identifier_type` varchar(80),
	`previous_device_summary` varchar(191),
	`expires_at` varchar(40) NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`last_seen_at` varchar(40) NOT NULL,
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_sessions_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `auth_users` (
	`id` int NOT NULL,
	`tenant_id` int,
	`name` varchar(255) NOT NULL,
	`username` varchar(100) NOT NULL,
	`email` varchar(254) NOT NULL,
	`cpf` varchar(32) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role_name` varchar(255) NOT NULL,
	`scope` varchar(80) NOT NULL,
	`status` varchar(80) NOT NULL DEFAULT 'ATIVO',
	`must_change_password` boolean NOT NULL DEFAULT false,
	`failed_attempts` int NOT NULL DEFAULT 0,
	`blocked_until` varchar(40),
	`archived_at` varchar(40),
	`archived_by` int,
	`archived_previous_status` varchar(80),
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `auth_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_users_tenant_username_unique` UNIQUE(`tenant_id`,`username`),
	CONSTRAINT `auth_users_tenant_email_unique` UNIQUE(`tenant_id`,`email`),
	CONSTRAINT `auth_users_tenant_cpf_unique` UNIQUE(`tenant_id`,`cpf`)
);
--> statement-breakpoint
CREATE TABLE `baptism_candidates` (
	`event_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`person_id` int NOT NULL,
	`status` varchar(80) NOT NULL,
	`notes` text,
	`completed_at` varchar(40),
	`updated_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `baptism_candidates_event_id_person_id_pk` PRIMARY KEY(`event_id`,`person_id`)
);
--> statement-breakpoint
CREATE TABLE `baptism_events` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`unit_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`scheduled_date` varchar(40) NOT NULL,
	`location` varchar(191),
	`responsible_person_id` int,
	`notes` text,
	`status` varchar(80) NOT NULL,
	`version` int NOT NULL,
	`created_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `baptism_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billing_settings` (
	`singleton_id` int NOT NULL DEFAULT 1,
	`warning_days` int NOT NULL DEFAULT 7,
	`pix_key` varchar(191),
	`pix_key_type` varchar(80),
	`payee_name` varchar(255),
	`bank_name` varchar(255),
	`bank_agency` varchar(191),
	`bank_account` varchar(191),
	`instructions` text,
	`support_contact` varchar(191),
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `billing_settings_singleton_id` PRIMARY KEY(`singleton_id`)
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` int NOT NULL,
	`matrix_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` varchar(80) NOT NULL DEFAULT 'ATIVO',
	CONSTRAINT `branches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `church_movements` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`person_id` int NOT NULL,
	`unit_id` int NOT NULL,
	`movement_type` varchar(80) NOT NULL,
	`request_id` int,
	`effective_date` varchar(40) NOT NULL,
	`previous_status` varchar(80),
	`new_status` varchar(80),
	`previous_unit_id` int,
	`destination_unit_id` int,
	`external_church` varchar(191),
	`external_city` varchar(191),
	`external_state` varchar(191),
	`description` text NOT NULL,
	`metadata_json` text NOT NULL,
	`status` varchar(80) NOT NULL,
	`created_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `church_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `commercial_audit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_user_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`action` varchar(191) NOT NULL,
	`entity_type` varchar(80) NOT NULL,
	`entity_id` int NOT NULL,
	`previous_values` text,
	`new_values` text,
	`reason` varchar(191),
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `commercial_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `commercial_profiles` (
	`tenant_id` int NOT NULL,
	`person_type` varchar(80) NOT NULL,
	`legal_name` varchar(255) NOT NULL,
	`document` varchar(191),
	`responsible_name` varchar(255),
	`phone` varchar(40),
	`billing_email` varchar(254),
	`notes` text,
	`customer_since` varchar(40) NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `commercial_profiles_tenant_id` PRIMARY KEY(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `consecrations` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`person_id` int NOT NULL,
	`unit_id` int NOT NULL,
	`previous_function_id` int,
	`new_function_id` int NOT NULL,
	`event_date` varchar(40) NOT NULL,
	`location` varchar(191),
	`responsible_person_id` int,
	`notes` text,
	`status` varchar(80) NOT NULL,
	`version` int NOT NULL,
	`created_by_user_id` int NOT NULL,
	`completed_by_user_id` int,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `consecrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_export_audit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_user_id` int NOT NULL,
	`actor_membership_id` int,
	`tenant_id` int NOT NULL,
	`export_type` varchar(80) NOT NULL,
	`modules` text NOT NULL,
	`format` varchar(191) NOT NULL,
	`record_count` int NOT NULL DEFAULT 0,
	`scope_unit_id` int,
	`status` varchar(80) NOT NULL,
	`details` text,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `data_export_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `department_access` (
	`department_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`membership_id` int NOT NULL,
	`role_id` int,
	`permissions_json` text NOT NULL,
	`status` varchar(80) NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `department_access_department_id_membership_id_pk` PRIMARY KEY(`department_id`,`membership_id`)
);
--> statement-breakpoint
CREATE TABLE `department_activities` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`department_id` int NOT NULL,
	`activity_date` varchar(40) NOT NULL,
	`title` varchar(255) NOT NULL,
	`notes` text,
	`status` varchar(80) NOT NULL,
	`version` int NOT NULL,
	`finalized_by_user_id` int,
	`finalized_at` varchar(40),
	`created_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `department_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `department_attendance` (
	`activity_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`department_id` int NOT NULL,
	`person_id` int NOT NULL,
	`attendance_status` varchar(80) NOT NULL,
	`notes` text,
	`updated_by_user_id` int NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `department_attendance_activity_id_person_id_pk` PRIMARY KEY(`activity_id`,`person_id`)
);
--> statement-breakpoint
CREATE TABLE `department_audit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`department_id` int NOT NULL,
	`actor_user_id` int NOT NULL,
	`actor_membership_id` int,
	`action` varchar(191) NOT NULL,
	`entity_type` varchar(80) NOT NULL,
	`entity_id` int NOT NULL,
	`previous_values` text,
	`new_values` text,
	`reason` varchar(191),
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `department_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `department_communications` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`department_id` int NOT NULL,
	`message` text NOT NULL,
	`audience` varchar(191) NOT NULL,
	`channel` varchar(191) NOT NULL,
	`recipient_count` int NOT NULL,
	`created_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `department_communications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `department_events` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`department_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`event_date` varchar(40) NOT NULL,
	`start_time` varchar(40),
	`location` varchar(191),
	`responsible_person_id` int,
	`notes` text,
	`status` varchar(80) NOT NULL,
	`created_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `department_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `department_participants` (
	`department_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`person_id` int NOT NULL,
	`role_id` int,
	`joined_at` varchar(40) NOT NULL,
	`status` varchar(80) NOT NULL,
	`left_at` varchar(40),
	`exit_reason` varchar(191),
	`notes` text,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `department_participants_department_id_person_id_pk` PRIMARY KEY(`department_id`,`person_id`)
);
--> statement-breakpoint
CREATE TABLE `department_roles` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`department_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`is_leadership` boolean NOT NULL DEFAULT false,
	`display_order` int NOT NULL DEFAULT 0,
	`status` varchar(80) NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `department_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `department_roles_tenant_department_name_unique` UNIQUE(`tenant_id`,`department_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`acronym` varchar(191),
	`description` text,
	`type` varchar(80) NOT NULL,
	`unit_id` int NOT NULL,
	`convention_id` int NOT NULL,
	`matrix_id` int,
	`branch_id` int,
	`status` varchar(80) NOT NULL DEFAULT 'ATIVO',
	`enabled_features` text NOT NULL,
	`absence_alert_threshold` int NOT NULL DEFAULT 3,
	`version` int NOT NULL DEFAULT 1,
	`created_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `departments_id_tenant_unique` UNIQUE(`id`,`tenant_id`),
	CONSTRAINT `departments_tenant_unit_name_unique` UNIQUE(`tenant_id`,`unit_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `ebd_attendance` (
	`meeting_id` int NOT NULL,
	`class_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`person_id` int NOT NULL,
	`attendance_status` varchar(80) NOT NULL,
	`updated_by_user_id` int NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `ebd_attendance_meeting_id_class_id_person_id_pk` PRIMARY KEY(`meeting_id`,`class_id`,`person_id`)
);
--> statement-breakpoint
CREATE TABLE `ebd_class_summaries` (
	`meeting_id` int NOT NULL,
	`class_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`enrolled_count` int NOT NULL,
	`present_count` int NOT NULL,
	`absent_count` int NOT NULL,
	`justified_count` int NOT NULL,
	`visitor_count` int NOT NULL,
	`bible_count` int NOT NULL,
	`assistance_count` int NOT NULL,
	`offering_cents` int NOT NULL,
	`notes` text,
	`status` varchar(80) NOT NULL,
	`version` int NOT NULL,
	`finalized_by_user_id` int,
	`finalized_at` varchar(40),
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `ebd_class_summaries_meeting_id_class_id_pk` PRIMARY KEY(`meeting_id`,`class_id`)
);
--> statement-breakpoint
CREATE TABLE `ebd_class_teachers` (
	`class_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`membership_id` int NOT NULL,
	`person_id` int,
	`teacher_role` varchar(191) NOT NULL,
	`status` varchar(80) NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `ebd_class_teachers_class_id_membership_id_pk` PRIMARY KEY(`class_id`,`membership_id`)
);
--> statement-breakpoint
CREATE TABLE `ebd_classes` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`department_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`age_range` varchar(191),
	`room` varchar(191),
	`status` varchar(80) NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `ebd_classes_id` PRIMARY KEY(`id`),
	CONSTRAINT `ebd_classes_id_tenant_unique` UNIQUE(`id`,`tenant_id`),
	CONSTRAINT `ebd_classes_tenant_department_name_unique` UNIQUE(`tenant_id`,`department_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `ebd_closures` (
	`meeting_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`department_id` int NOT NULL,
	`enrolled_total` int NOT NULL,
	`present_total` int NOT NULL,
	`absent_total` int NOT NULL,
	`justified_total` int NOT NULL,
	`visitor_total` int NOT NULL,
	`bible_total` int NOT NULL,
	`assistance_total` int NOT NULL,
	`offering_total_cents` int NOT NULL,
	`exception_reason` varchar(191),
	`finalized_by_user_id` int NOT NULL,
	`finalized_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `ebd_closures_meeting_id` PRIMARY KEY(`meeting_id`)
);
--> statement-breakpoint
CREATE TABLE `ebd_enrollments` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`department_id` int NOT NULL,
	`class_id` int NOT NULL,
	`person_id` int NOT NULL,
	`enrolled_at` varchar(40) NOT NULL,
	`status` varchar(80) NOT NULL,
	`left_at` varchar(40),
	`notes` text,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `ebd_enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ebd_meetings` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`department_id` int NOT NULL,
	`meeting_date` varchar(40) NOT NULL,
	`theme` varchar(191),
	`start_time` varchar(40),
	`status` varchar(80) NOT NULL,
	`version` int NOT NULL,
	`created_by_user_id` int NOT NULL,
	`finalized_by_user_id` int,
	`finalized_at` varchar(40),
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `ebd_meetings_id` PRIMARY KEY(`id`),
	CONSTRAINT `ebd_meetings_tenant_department_date_unique` UNIQUE(`tenant_id`,`department_id`,`meeting_date`)
);
--> statement-breakpoint
CREATE TABLE `ebd_student_attendance` (
	`meeting_id` int NOT NULL,
	`class_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`student_id` int NOT NULL,
	`attendance_status` varchar(80) NOT NULL,
	`updated_by_user_id` int NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `ebd_student_attendance_meeting_id_class_id_student_id_pk` PRIMARY KEY(`meeting_id`,`class_id`,`student_id`)
);
--> statement-breakpoint
CREATE TABLE `ebd_student_enrollments` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`department_id` int NOT NULL,
	`class_id` int NOT NULL,
	`student_id` int NOT NULL,
	`enrolled_at` varchar(40) NOT NULL,
	`status` varchar(80) NOT NULL,
	`left_at` varchar(40),
	`notes` text,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `ebd_student_enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ebd_students` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`department_id` int NOT NULL,
	`person_id` int,
	`full_name` varchar(255) NOT NULL,
	`birth_date` varchar(40),
	`sex` varchar(191),
	`cpf` varchar(32),
	`phone` varchar(40),
	`whatsapp` varchar(40),
	`guardian_name` varchar(255),
	`guardian_phone` varchar(40),
	`notes` text,
	`status` varchar(80) NOT NULL,
	`created_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `ebd_students_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ebd_visitors` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`department_id` int NOT NULL,
	`meeting_id` int NOT NULL,
	`class_id` int NOT NULL,
	`person_id` int,
	`name` varchar(255) NOT NULL,
	`phone` varchar(40),
	`age_range` varchar(191),
	`invited_by` varchar(191),
	`notes` text,
	`created_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `ebd_visitors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finance_allocation_configs` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`unit_id` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` varchar(80) NOT NULL DEFAULT 'ATIVA',
	`created_by_user_id` int NOT NULL,
	`updated_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `finance_allocation_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `finance_allocation_configs_unit_unique` UNIQUE(`tenant_id`,`unit_id`)
);
--> statement-breakpoint
CREATE TABLE `finance_allocation_rules` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`config_id` int NOT NULL,
	`recipient_name` varchar(255) NOT NULL,
	`description` text,
	`recipient_type` varchar(80) NOT NULL,
	`rule_type` varchar(80) NOT NULL DEFAULT 'PERCENTUAL',
	`percentage_basis_points` int,
	`fixed_amount_cents` int,
	`financial_destination` varchar(191) NOT NULL DEFAULT 'REPASSAR',
	`destination_unit_id` int,
	`destination_department_id` int,
	`calculation_base` varchar(191) NOT NULL DEFAULT 'RECEITAS_PARTICIPANTES',
	`display_order` int NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `finance_allocation_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finance_contribution_category_defaults` (
	`tenant_id` int NOT NULL,
	`contribution_type` varchar(80) NOT NULL,
	`category_id` int NOT NULL,
	`created_by_user_id` int NOT NULL,
	`updated_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `finance_contribution_category_defaults_tenant_id__7797fab2d67b61` PRIMARY KEY(`tenant_id`,`contribution_type`)
);
--> statement-breakpoint
CREATE TABLE `finance_interunit_repass_events` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`repass_id` int NOT NULL,
	`event_type` varchar(80) NOT NULL,
	`amount_cents` int NOT NULL,
	`account_id` int,
	`movement_id` int,
	`occurred_on` varchar(40) NOT NULL,
	`reason` varchar(191),
	`actor_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `finance_interunit_repass_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `finance_interunit_repass_events_movement_unique` UNIQUE(`tenant_id`,`movement_id`)
);
--> statement-breakpoint
CREATE TABLE `finance_interunit_repasses` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`period_id` int NOT NULL,
	`closure_version` int NOT NULL,
	`rule_display_order` int NOT NULL,
	`source_rule_id` int,
	`source_unit_id` int NOT NULL,
	`destination_unit_id` int NOT NULL,
	`destination_department_id` int,
	`kind` varchar(80) NOT NULL DEFAULT 'NORMAL',
	`payer_unit_id` int NOT NULL,
	`receiver_unit_id` int NOT NULL,
	`recipient_name` varchar(255) NOT NULL,
	`competency` varchar(16) NOT NULL,
	`expected_cents` int NOT NULL,
	`sent_cents` int NOT NULL DEFAULT 0,
	`received_cents` int NOT NULL DEFAULT 0,
	`written_off_cents` int NOT NULL DEFAULT 0,
	`status` varchar(80) NOT NULL DEFAULT 'PENDENTE',
	`superseded_by_id` int,
	`created_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `finance_interunit_repasses_id` PRIMARY KEY(`id`),
	CONSTRAINT `finance_interunit_repasses_version_unique` UNIQUE(`tenant_id`,`period_id`,`closure_version`,`rule_display_order`,`kind`,`payer_unit_id`,`receiver_unit_id`)
);
--> statement-breakpoint
CREATE TABLE `finance_period_allocation_rules` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`period_id` int NOT NULL,
	`source_rule_id` int NOT NULL,
	`recipient_name` varchar(255) NOT NULL,
	`description` text,
	`recipient_type` varchar(80) NOT NULL,
	`rule_type` varchar(80) NOT NULL,
	`percentage_basis_points` int,
	`fixed_amount_cents` int,
	`financial_destination` varchar(191) NOT NULL DEFAULT 'REPASSAR',
	`destination_unit_id` int,
	`destination_department_id` int,
	`calculation_base` varchar(191) NOT NULL,
	`participating_category_ids_json` text NOT NULL DEFAULT ('[]'),
	`display_order` int NOT NULL,
	`snapshot_version` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `finance_period_allocation_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finance_period_reopen_requests` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`period_id` int NOT NULL,
	`unit_id` int NOT NULL,
	`matrix_id` int NOT NULL,
	`branch_id` int,
	`requester_user_id` int NOT NULL,
	`requester_membership_id` int NOT NULL,
	`requested_closure_version` int NOT NULL,
	`reason` varchar(191) NOT NULL,
	`status` varchar(80) NOT NULL DEFAULT 'PENDENTE',
	`requested_at` varchar(40) NOT NULL,
	`expires_at` varchar(40),
	`decided_by_user_id` int,
	`decided_by_membership_id` int,
	`decision_reason` varchar(191),
	`decided_at` varchar(40),
	`used_at` varchar(40),
	`reopened_by_user_id` int,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `finance_period_reopen_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finance_periods` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`unit_id` int NOT NULL,
	`unit_type` varchar(80) NOT NULL,
	`matrix_id` int NOT NULL,
	`branch_id` int,
	`competency` varchar(16) NOT NULL,
	`status` varchar(80) NOT NULL DEFAULT 'ABERTO',
	`lifecycle_state` varchar(191) NOT NULL DEFAULT 'ABERTO',
	`allocation_config_id` int NOT NULL,
	`allocation_config_version` int NOT NULL,
	`opened_at` varchar(40) NOT NULL,
	`opened_by_user_id` int NOT NULL,
	`closed_at` varchar(40),
	`closed_by_user_id` int,
	`reopened_at` varchar(40),
	`reopened_by_user_id` int,
	`reopen_reason` varchar(191),
	`reopen_count` int NOT NULL DEFAULT 0,
	`closure_version` int NOT NULL DEFAULT 0,
	`notes` text,
	`version` int NOT NULL DEFAULT 1,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `finance_periods_id` PRIMARY KEY(`id`),
	CONSTRAINT `finance_periods_unit_competency_unique` UNIQUE(`tenant_id`,`unit_id`,`competency`)
);
--> statement-breakpoint
CREATE TABLE `finance_quick_sessions` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`period_id` int NOT NULL,
	`unit_id` int NOT NULL,
	`user_id` int NOT NULL,
	`account_id` int NOT NULL,
	`default_date` varchar(40) NOT NULL,
	`default_competency` varchar(191) NOT NULL,
	`default_contribution_type` varchar(80) NOT NULL,
	`default_payment_method_id` int,
	`status` varchar(80) NOT NULL DEFAULT 'EM_ANDAMENTO',
	`entry_count` int NOT NULL DEFAULT 0,
	`total_cents` int NOT NULL DEFAULT 0,
	`started_at` varchar(40) NOT NULL,
	`finished_at` varchar(40),
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `finance_quick_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `help_article_reads` (
	`user_id` int NOT NULL,
	`article_id` int NOT NULL,
	`viewed_at` varchar(40) NOT NULL,
	CONSTRAINT `help_article_reads_user_id_article_id_pk` PRIMARY KEY(`user_id`,`article_id`)
);
--> statement-breakpoint
CREATE TABLE `help_articles` (
	`id` int NOT NULL,
	`tenant_id` int,
	`slug` varchar(191) NOT NULL,
	`title` varchar(255) NOT NULL,
	`summary` text NOT NULL,
	`content` text NOT NULL,
	`category` varchar(191) NOT NULL,
	`display_order` int NOT NULL DEFAULT 0,
	`target_profiles` text NOT NULL DEFAULT ('["TODOS"]'),
	`required_permission` varchar(191),
	`related_route` varchar(191),
	`published` boolean NOT NULL DEFAULT true,
	`is_new_feature` boolean NOT NULL DEFAULT false,
	`released_at` varchar(40),
	`version` varchar(191) NOT NULL DEFAULT '1.0',
	`created_by_user_id` int,
	`published_at` varchar(40),
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `help_articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `institution_lookup_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code_fingerprint` varchar(191) NOT NULL,
	`success` boolean NOT NULL,
	`ip_address` varchar(191),
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `institution_lookup_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `login_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`tenant_id` int,
	`identifier_type` varchar(80) NOT NULL,
	`identifier_fingerprint` varchar(191) NOT NULL,
	`success` boolean NOT NULL,
	`failure_reason` varchar(191),
	`ip_address` varchar(191),
	`user_agent` text,
	`device_summary` varchar(191),
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `login_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `matrices` (
	`id` int NOT NULL,
	`convention_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` varchar(80) NOT NULL DEFAULT 'ATIVO',
	CONSTRAINT `matrices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `member_custom_fields` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`normalized_name` varchar(255) NOT NULL,
	`field_type` varchar(80) NOT NULL,
	`help_text` text,
	`required` boolean NOT NULL DEFAULT false,
	`status` varchar(80) NOT NULL DEFAULT 'ATIVO',
	`display_order` int NOT NULL DEFAULT 0,
	`section_name` varchar(255) NOT NULL DEFAULT 'Informações adicionais',
	`show_admin` boolean NOT NULL DEFAULT true,
	`show_public` boolean NOT NULL DEFAULT false,
	`show_print` boolean NOT NULL DEFAULT false,
	`options_json` text,
	`created_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `member_custom_fields_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_custom_fields_tenant_name_unique` UNIQUE(`tenant_id`,`normalized_name`),
	CONSTRAINT `member_custom_fields_id_tenant_unique` UNIQUE(`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `member_custom_values` (
	`person_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`field_id` int NOT NULL,
	`value_text` varchar(191) NOT NULL,
	`updated_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `member_custom_values_person_id_field_id_pk` PRIMARY KEY(`person_id`,`field_id`)
);
--> statement-breakpoint
CREATE TABLE `member_photos` (
	`person_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`image_data` LONGBLOB NOT NULL,
	`mime_type` varchar(80) NOT NULL,
	`byte_size` int NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `member_photos_person_id` PRIMARY KEY(`person_id`)
);
--> statement-breakpoint
CREATE TABLE `member_pre_registration_custom_values` (
	`pre_registration_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`field_id` int NOT NULL,
	`value_text` varchar(191) NOT NULL,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `member_pre_registration_custom_values_pre_registr_21b6d6870321ab` PRIMARY KEY(`pre_registration_id`,`field_id`)
);
--> statement-breakpoint
CREATE TABLE `member_pre_registration_forms` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`token_hash` varchar(191) NOT NULL,
	`token_prefix` varchar(191) NOT NULL,
	`unit_id` int,
	`status` varchar(80) NOT NULL DEFAULT 'ATIVO',
	`expires_at` varchar(40),
	`created_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `member_pre_registration_forms_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_pre_registration_forms_token_hash_unique` UNIQUE(`token_hash`),
	CONSTRAINT `member_pre_registration_forms_id_tenant_unique` UNIQUE(`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `member_pre_registration_photos` (
	`pre_registration_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`image_data` LONGBLOB NOT NULL,
	`mime_type` varchar(80) NOT NULL,
	`byte_size` int NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `member_pre_registration_photos_pre_registration_id` PRIMARY KEY(`pre_registration_id`)
);
--> statement-breakpoint
CREATE TABLE `member_pre_registration_rate_limits` (
	`rate_key` varchar(191) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`window_started_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `member_pre_registration_rate_limits_rate_key` PRIMARY KEY(`rate_key`)
);
--> statement-breakpoint
CREATE TABLE `member_pre_registrations` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`form_id` int NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`birth_date` varchar(40),
	`cpf` varchar(32),
	`phone` varchar(40),
	`whatsapp` varchar(40),
	`email` varchar(254),
	`voter_title` varchar(32),
	`matrix_id` int,
	`branch_id` int,
	`status` varchar(80) NOT NULL DEFAULT 'PENDENTE',
	`payload_json` text NOT NULL,
	`consent_at` varchar(40) NOT NULL,
	`consent_version` varchar(191) NOT NULL,
	`source_hash` varchar(191) NOT NULL,
	`review_reason` varchar(191),
	`reviewed_by_user_id` int,
	`reviewed_at` varchar(40),
	`approved_member_id` int,
	`correction_token_hash` varchar(191),
	`correction_expires_at` varchar(40),
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `member_pre_registrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_pre_registrations_id_tenant_unique` UNIQUE(`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `member_sequences` (
	`tenant_id` int NOT NULL,
	`last_number` int NOT NULL DEFAULT 0,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `member_sequences_tenant_id` PRIMARY KEY(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `membership_permissions` (
	`membership_id` int NOT NULL,
	`permission` varchar(191) NOT NULL,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `membership_permissions_membership_id_permission_pk` PRIMARY KEY(`membership_id`,`permission`)
);
--> statement-breakpoint
CREATE TABLE `notification_recipients` (
	`notification_id` int NOT NULL,
	`user_id` int NOT NULL,
	`read_at` varchar(40),
	`archived_at` varchar(40),
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `notification_recipients_notification_id_user_id_pk` PRIMARY KEY(`notification_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int NOT NULL,
	`tenant_id` int,
	`audience` varchar(191) NOT NULL DEFAULT 'ORGANIZATIONAL',
	`type` varchar(80) NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`priority` varchar(191) NOT NULL DEFAULT 'INFO',
	`internal_route` varchar(191),
	`source_entity` varchar(191),
	`source_entity_id` int,
	`unit_id` int,
	`group_key` varchar(191),
	`metadata_json` text,
	`mandatory` boolean NOT NULL DEFAULT false,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizational_functions` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`normalized_name` varchar(255) NOT NULL,
	`description` text,
	`status` varchar(80) NOT NULL DEFAULT 'ATIVO',
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `organizational_functions_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizational_functions_tenant_name_unique` UNIQUE(`tenant_id`,`normalized_name`),
	CONSTRAINT `organizational_functions_id_tenant_unique` UNIQUE(`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `organizational_units` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`type` varchar(80) NOT NULL,
	`name` varchar(255) NOT NULL,
	`fantasy_name` varchar(255),
	`legal_name` varchar(255),
	`cnpj` varchar(32),
	`uses_parent_cnpj` boolean NOT NULL DEFAULT false,
	`phone` varchar(40),
	`whatsapp` varchar(40),
	`email` varchar(254),
	`postal_code` varchar(20),
	`street` varchar(191),
	`number` varchar(191),
	`complement` varchar(191),
	`district` varchar(191),
	`city` varchar(191),
	`state` varchar(191),
	`responsible_name` varchar(255),
	`foundation_date` varchar(40),
	`notes` text,
	`code` varchar(191) NOT NULL,
	`parent_id` int,
	`status` varchar(80) NOT NULL DEFAULT 'ATIVO',
	`archived_at` varchar(40),
	`archived_by` int,
	`archived_previous_status` varchar(80),
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `organizational_units_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizational_units_code_unique` UNIQUE(`code`),
	CONSTRAINT `organizational_units_id_tenant_unique` UNIQUE(`id`,`tenant_id`),
	CONSTRAINT `organizational_units_hierarchy_scope_unique` UNIQUE(`id`,`parent_id`,`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`member_number` int NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`status` varchar(80) NOT NULL DEFAULT 'MEMBRO_ATIVO',
	`birth_date` varchar(40),
	`sex` varchar(191),
	`cpf` varchar(32),
	`rg` varchar(191),
	`voter_title` varchar(32),
	`birth_city` varchar(191),
	`birth_state` varchar(191),
	`phone` varchar(40),
	`whatsapp` varchar(40),
	`email` varchar(254),
	`mother_name` varchar(255),
	`father_name` varchar(255),
	`marital_status` varchar(80),
	`spouse_name` varchar(255),
	`spouse_person_id` int,
	`children_count` int NOT NULL DEFAULT 0,
	`postal_code` varchar(20),
	`street` varchar(191),
	`address_number` varchar(191),
	`complement` varchar(191),
	`district` varchar(191),
	`city` varchar(191),
	`state` varchar(191),
	`profession` varchar(191),
	`workplace` varchar(191),
	`education_level` varchar(191),
	`theological_education` text,
	`primary_function_id` int,
	`matrix_id` int NOT NULL,
	`branch_id` int,
	`church_entry_date` varchar(40),
	`origin_church` varchar(191),
	`conversion_date` varchar(40),
	`baptism_date` varchar(40),
	`consecration_date` varchar(40),
	`notes` text,
	`linked_auth_user_id` int,
	`created_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `people_id` PRIMARY KEY(`id`),
	CONSTRAINT `people_tenant_member_number_unique` UNIQUE(`tenant_id`,`member_number`),
	CONSTRAINT `people_tenant_cpf_unique` UNIQUE(`tenant_id`,`cpf`),
	CONSTRAINT `people_id_tenant_unique` UNIQUE(`id`,`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `person_functions` (
	`person_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`function_id` int NOT NULL,
	`is_primary` boolean NOT NULL DEFAULT false,
	`started_at` varchar(40),
	`ended_at` varchar(40),
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `person_functions_person_id_function_id_pk` PRIMARY KEY(`person_id`,`function_id`)
);
--> statement-breakpoint
CREATE TABLE `person_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`person_id` int NOT NULL,
	`event_type` varchar(80) NOT NULL,
	`description` text NOT NULL,
	`event_date` varchar(40),
	`previous_values` text,
	`new_values` text,
	`actor_user_id` int NOT NULL,
	`actor_membership_id` int,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `person_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `person_relationships` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`person_id` int NOT NULL,
	`related_person_id` int NOT NULL,
	`relationship_type` varchar(80) NOT NULL,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `person_relationships_id` PRIMARY KEY(`id`),
	CONSTRAINT `person_relationships_unique` UNIQUE(`person_id`,`related_person_id`,`relationship_type`)
);
--> statement-breakpoint
CREATE TABLE `platform_audit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_user_id` int NOT NULL,
	`tenant_id` int,
	`action` varchar(191) NOT NULL,
	`entity_type` varchar(80) NOT NULL,
	`entity_id` int NOT NULL,
	`convention_id` int,
	`unit_id` int,
	`ip_address` varchar(191),
	`user_agent` text,
	`device_summary` varchar(191),
	`details` text,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `platform_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_owners` (
	`singleton_id` int NOT NULL DEFAULT 1,
	`user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `platform_owners_singleton_id` PRIMARY KEY(`singleton_id`),
	CONSTRAINT `platform_owners_user_unique` UNIQUE(`user_id`),
	CONSTRAINT `platform_owners_singleton_check` CHECK(`platform_owners`.`singleton_id` = 1)
);
--> statement-breakpoint
CREATE TABLE `saas_charges` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`subscription_id` int NOT NULL,
	`competence` varchar(16) NOT NULL,
	`description` text NOT NULL,
	`amount_cents` int NOT NULL,
	`issued_date` varchar(40) NOT NULL,
	`due_date` varchar(40) NOT NULL,
	`status` varchar(80) NOT NULL DEFAULT 'PENDENTE',
	`paid_at` varchar(40),
	`payment_method` varchar(191),
	`notes` text,
	`payment_provider` varchar(191) NOT NULL DEFAULT 'MANUAL',
	`provider_charge_id` varchar(191),
	`external_reference` varchar(191),
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `saas_charges_id` PRIMARY KEY(`id`),
	CONSTRAINT `saas_charges_subscription_due_unique` UNIQUE(`subscription_id`,`due_date`)
);
--> statement-breakpoint
CREATE TABLE `saas_payments` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`subscription_id` int NOT NULL,
	`charge_id` int NOT NULL,
	`amount_cents` int NOT NULL,
	`paid_date` varchar(40) NOT NULL,
	`payment_method` varchar(191) NOT NULL,
	`notes` text,
	`payment_provider` varchar(191) NOT NULL DEFAULT 'MANUAL',
	`provider_payment_id` varchar(191),
	`external_reference` varchar(191),
	`created_by` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `saas_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `saas_payments_charge_id_unique` UNIQUE(`charge_id`),
	CONSTRAINT `saas_payments_external_reference_unique` UNIQUE(`external_reference`)
);
--> statement-breakpoint
CREATE TABLE `saas_plans` (
	`id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`price_cents` int NOT NULL,
	`billing_period` varchar(191) NOT NULL,
	`default_grace_days` int NOT NULL DEFAULT 5,
	`default_trial_days` int NOT NULL DEFAULT 15,
	`status` varchar(80) NOT NULL DEFAULT 'ATIVO',
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `saas_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `saas_plans_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `secretary_document_template_versions` (
	`template_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`version` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`header_text` text,
	`footer_text` text,
	`signature_labels_json` text NOT NULL,
	`style_json` text NOT NULL,
	`created_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `secretary_document_template_versions_template_id_version_pk` PRIMARY KEY(`template_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `secretary_document_templates` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`unit_id` int,
	`name` varchar(255) NOT NULL,
	`document_type` varchar(80) NOT NULL,
	`status` varchar(80) NOT NULL,
	`current_version` int NOT NULL,
	`created_by_user_id` int NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `secretary_document_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `secretary_documents` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`unit_id` int NOT NULL,
	`person_id` int NOT NULL,
	`template_id` int NOT NULL,
	`template_version` int NOT NULL,
	`document_type` varchar(80) NOT NULL,
	`document_number` varchar(191) NOT NULL,
	`title_snapshot` varchar(191) NOT NULL,
	`body_snapshot` text NOT NULL,
	`header_snapshot` text,
	`footer_snapshot` text,
	`signatures_snapshot` text NOT NULL,
	`issued_by_user_id` int NOT NULL,
	`issued_at` varchar(40) NOT NULL,
	CONSTRAINT `secretary_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `secretary_requests` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`person_id` int NOT NULL,
	`request_type` varchar(80) NOT NULL,
	`request_direction` varchar(191) NOT NULL DEFAULT 'SAIDA',
	`origin_unit_id` int,
	`destination_unit_id` int,
	`external_church` varchar(191),
	`external_city` varchar(191),
	`external_state` varchar(191),
	`reason` varchar(191),
	`notes` text,
	`status` varchar(80) NOT NULL,
	`department_resolution` text,
	`ebd_resolution` text,
	`version` int NOT NULL,
	`requested_by_user_id` int NOT NULL,
	`reviewed_by_user_id` int,
	`requested_at` varchar(40) NOT NULL,
	`reviewed_at` varchar(40),
	`completed_at` varchar(40),
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `secretary_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `secretary_transfer_search_limits` (
	`tenant_id` int NOT NULL,
	`user_id` int NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`window_started_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `secretary_transfer_search_limits_tenant_id_user_id_pk` PRIMARY KEY(`tenant_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(191) NOT NULL,
	`token_hash` varchar(191) NOT NULL,
	`user_id` int NOT NULL,
	`active_matrix_id` int,
	`active_branch_id` int,
	`previous_login_at` varchar(40),
	`previous_identifier_type` varchar(80),
	`previous_origin_summary` varchar(191),
	`expires_at` varchar(40) NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`last_seen_at` varchar(40) NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `tenant_access_contexts` (
	`token_hash` varchar(191) NOT NULL,
	`tenant_id` int NOT NULL,
	`expires_at` varchar(40) NOT NULL,
	`created_at` varchar(40) NOT NULL,
	`last_used_at` varchar(40) NOT NULL,
	CONSTRAINT `tenant_access_contexts_token_hash` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `tenant_memberships` (
	`id` int NOT NULL,
	`user_id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`display_name` varchar(255) NOT NULL,
	`role_name` varchar(255) NOT NULL,
	`function_id` int,
	`scope` varchar(80) NOT NULL,
	`scope_unit_id` int NOT NULL,
	`status` varchar(80) NOT NULL DEFAULT 'ATIVO',
	`invited_by_membership_id` int,
	`accepted_at` varchar(40),
	`archived_at` varchar(40),
	`archived_by_membership_id` int,
	`archived_previous_status` varchar(80),
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `tenant_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_memberships_user_tenant_unique` UNIQUE(`user_id`,`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_subscriptions` (
	`id` int NOT NULL,
	`tenant_id` int NOT NULL,
	`plan_id` int,
	`contracted_price_cents` int NOT NULL DEFAULT 0,
	`custom_price_cents` int,
	`billing_period` varchar(191) NOT NULL,
	`status` varchar(80) NOT NULL,
	`start_date` varchar(40) NOT NULL,
	`next_due_date` varchar(40),
	`due_day` int,
	`grace_days` int NOT NULL DEFAULT 5,
	`trial_start_date` varchar(40),
	`trial_end_date` varchar(40),
	`access_until` varchar(40),
	`auto_renew` boolean NOT NULL DEFAULT true,
	`notes` text,
	`suspended_reason` varchar(191),
	`payment_provider` varchar(191) NOT NULL DEFAULT 'MANUAL',
	`provider_customer_id` varchar(191),
	`provider_subscription_id` varchar(191),
	`external_reference` varchar(191),
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `tenant_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_subscriptions_tenant_id_unique` UNIQUE(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`access_code` varchar(191) NOT NULL,
	`status` varchar(80) NOT NULL DEFAULT 'ATIVO',
	`created_at` varchar(40) NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `tenants_access_code_unique` UNIQUE(`access_code`)
);
--> statement-breakpoint
CREATE TABLE `unit_logos` (
	`unit_id` int NOT NULL,
	`image_data` LONGBLOB NOT NULL,
	`mime_type` varchar(80) NOT NULL,
	`byte_size` int NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `unit_logos_unit_id` PRIMARY KEY(`unit_id`)
);
--> statement-breakpoint
CREATE TABLE `user_permissions` (
	`user_id` int NOT NULL,
	`permission` varchar(191) NOT NULL,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `user_permissions_user_id_permission_pk` PRIMARY KEY(`user_id`,`permission`)
);
--> statement-breakpoint
CREATE TABLE `user_profile_photos` (
	`user_id` int NOT NULL,
	`image_data` LONGBLOB NOT NULL,
	`mime_type` varchar(80) NOT NULL,
	`byte_size` int NOT NULL,
	`updated_at` varchar(40) NOT NULL,
	CONSTRAINT `user_profile_photos_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `user_unit_links` (
	`user_id` int NOT NULL,
	`unit_id` int NOT NULL,
	`is_primary` boolean NOT NULL DEFAULT true,
	`created_at` varchar(40) NOT NULL,
	CONSTRAINT `user_unit_links_user_id_unit_id_pk` PRIMARY KEY(`user_id`,`unit_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int NOT NULL,
	`convention_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`username` varchar(100) NOT NULL,
	`email` varchar(254) NOT NULL,
	`cpf` varchar(32) NOT NULL,
	`password_salt` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role_name` varchar(255) NOT NULL,
	`scope` varchar(80) NOT NULL,
	`bound_matrix_id` int,
	`bound_branch_id` int,
	`status` varchar(80) NOT NULL DEFAULT 'ATIVO',
	`must_change_password` boolean NOT NULL DEFAULT false,
	`failed_attempts` int NOT NULL DEFAULT 0,
	`blocked_until` varchar(40),
	`last_login_at` varchar(40),
	`last_identifier_type` varchar(80),
	`last_origin_summary` varchar(191),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_cpf_unique` UNIQUE(`cpf`)
);
--> statement-breakpoint
ALTER TABLE `administration_audit` ADD CONSTRAINT `administration_audit_actor_user_id_auth_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administration_audit` ADD CONSTRAINT `administration_audit_actor_membership_id_tenant_m_8c17683fc102e9` FOREIGN KEY (`actor_membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administration_audit` ADD CONSTRAINT `administration_audit_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administration_audit` ADD CONSTRAINT `administration_audit_convention_id_organizational_units_id_fk` FOREIGN KEY (`convention_id`) REFERENCES `organizational_units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `administration_audit` ADD CONSTRAINT `administration_audit_unit_id_organizational_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `organizational_units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_membership_id_tenant_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_selected_unit_id_organizational_units_id_fk` FOREIGN KEY (`selected_unit_id`) REFERENCES `organizational_units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_users` ADD CONSTRAINT `auth_users_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `baptism_candidates` ADD CONSTRAINT `baptism_candidates_event_id_baptism_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `baptism_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `baptism_candidates` ADD CONSTRAINT `baptism_candidates_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `branches` ADD CONSTRAINT `branches_matrix_id_matrices_id_fk` FOREIGN KEY (`matrix_id`) REFERENCES `matrices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `church_movements` ADD CONSTRAINT `church_movements_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commercial_audit` ADD CONSTRAINT `commercial_audit_actor_user_id_auth_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commercial_audit` ADD CONSTRAINT `commercial_audit_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commercial_profiles` ADD CONSTRAINT `commercial_profiles_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consecrations` ADD CONSTRAINT `consecrations_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_export_audit` ADD CONSTRAINT `data_export_audit_actor_user_id_auth_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_export_audit` ADD CONSTRAINT `data_export_audit_actor_membership_id_tenant_memberships_id_fk` FOREIGN KEY (`actor_membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_export_audit` ADD CONSTRAINT `data_export_audit_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_export_audit` ADD CONSTRAINT `data_export_audit_scope_unit_id_organizational_units_id_fk` FOREIGN KEY (`scope_unit_id`) REFERENCES `organizational_units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_access` ADD CONSTRAINT `department_access_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_access` ADD CONSTRAINT `department_access_membership_id_tenant_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_access` ADD CONSTRAINT `department_access_role_id_department_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `department_roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_activities` ADD CONSTRAINT `department_activities_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_activities` ADD CONSTRAINT `department_activities_finalized_by_user_id_auth_users_id_fk` FOREIGN KEY (`finalized_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_activities` ADD CONSTRAINT `department_activities_created_by_user_id_auth_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_attendance` ADD CONSTRAINT `department_attendance_activity_id_department_activities_id_fk` FOREIGN KEY (`activity_id`) REFERENCES `department_activities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_attendance` ADD CONSTRAINT `department_attendance_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_attendance` ADD CONSTRAINT `department_attendance_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_attendance` ADD CONSTRAINT `department_attendance_updated_by_user_id_auth_users_id_fk` FOREIGN KEY (`updated_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_audit` ADD CONSTRAINT `department_audit_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_audit` ADD CONSTRAINT `department_audit_actor_user_id_auth_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_audit` ADD CONSTRAINT `department_audit_actor_membership_id_tenant_memberships_id_fk` FOREIGN KEY (`actor_membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_communications` ADD CONSTRAINT `department_communications_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_communications` ADD CONSTRAINT `department_communications_created_by_user_id_auth_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_events` ADD CONSTRAINT `department_events_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_events` ADD CONSTRAINT `department_events_responsible_person_id_people_id_fk` FOREIGN KEY (`responsible_person_id`) REFERENCES `people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_events` ADD CONSTRAINT `department_events_created_by_user_id_auth_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_participants` ADD CONSTRAINT `department_participants_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_participants` ADD CONSTRAINT `department_participants_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_participants` ADD CONSTRAINT `department_participants_role_id_department_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `department_roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_roles` ADD CONSTRAINT `department_roles_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `departments` ADD CONSTRAINT `departments_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `departments` ADD CONSTRAINT `departments_unit_id_organizational_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `organizational_units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `departments` ADD CONSTRAINT `departments_convention_id_organizational_units_id_fk` FOREIGN KEY (`convention_id`) REFERENCES `organizational_units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `departments` ADD CONSTRAINT `departments_matrix_id_organizational_units_id_fk` FOREIGN KEY (`matrix_id`) REFERENCES `organizational_units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `departments` ADD CONSTRAINT `departments_branch_id_organizational_units_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `organizational_units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `departments` ADD CONSTRAINT `departments_created_by_user_id_auth_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_attendance` ADD CONSTRAINT `ebd_attendance_meeting_id_ebd_meetings_id_fk` FOREIGN KEY (`meeting_id`) REFERENCES `ebd_meetings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_attendance` ADD CONSTRAINT `ebd_attendance_class_id_ebd_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `ebd_classes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_attendance` ADD CONSTRAINT `ebd_attendance_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_attendance` ADD CONSTRAINT `ebd_attendance_updated_by_user_id_auth_users_id_fk` FOREIGN KEY (`updated_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_class_summaries` ADD CONSTRAINT `ebd_class_summaries_meeting_id_ebd_meetings_id_fk` FOREIGN KEY (`meeting_id`) REFERENCES `ebd_meetings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_class_summaries` ADD CONSTRAINT `ebd_class_summaries_class_id_ebd_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `ebd_classes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_class_summaries` ADD CONSTRAINT `ebd_class_summaries_finalized_by_user_id_auth_users_id_fk` FOREIGN KEY (`finalized_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_class_teachers` ADD CONSTRAINT `ebd_class_teachers_class_id_ebd_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `ebd_classes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_class_teachers` ADD CONSTRAINT `ebd_class_teachers_membership_id_tenant_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_class_teachers` ADD CONSTRAINT `ebd_class_teachers_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_classes` ADD CONSTRAINT `ebd_classes_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_closures` ADD CONSTRAINT `ebd_closures_meeting_id_ebd_meetings_id_fk` FOREIGN KEY (`meeting_id`) REFERENCES `ebd_meetings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_closures` ADD CONSTRAINT `ebd_closures_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_closures` ADD CONSTRAINT `ebd_closures_finalized_by_user_id_auth_users_id_fk` FOREIGN KEY (`finalized_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_enrollments` ADD CONSTRAINT `ebd_enrollments_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_enrollments` ADD CONSTRAINT `ebd_enrollments_class_id_ebd_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `ebd_classes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_enrollments` ADD CONSTRAINT `ebd_enrollments_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_meetings` ADD CONSTRAINT `ebd_meetings_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_meetings` ADD CONSTRAINT `ebd_meetings_created_by_user_id_auth_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_meetings` ADD CONSTRAINT `ebd_meetings_finalized_by_user_id_auth_users_id_fk` FOREIGN KEY (`finalized_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_student_attendance` ADD CONSTRAINT `ebd_student_attendance_meeting_id_ebd_meetings_id_fk` FOREIGN KEY (`meeting_id`) REFERENCES `ebd_meetings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_student_attendance` ADD CONSTRAINT `ebd_student_attendance_class_id_ebd_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `ebd_classes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_student_attendance` ADD CONSTRAINT `ebd_student_attendance_student_id_ebd_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `ebd_students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_student_enrollments` ADD CONSTRAINT `ebd_student_enrollments_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_student_enrollments` ADD CONSTRAINT `ebd_student_enrollments_class_id_ebd_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `ebd_classes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_student_enrollments` ADD CONSTRAINT `ebd_student_enrollments_student_id_ebd_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `ebd_students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_students` ADD CONSTRAINT `ebd_students_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_students` ADD CONSTRAINT `ebd_students_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_visitors` ADD CONSTRAINT `ebd_visitors_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_visitors` ADD CONSTRAINT `ebd_visitors_meeting_id_ebd_meetings_id_fk` FOREIGN KEY (`meeting_id`) REFERENCES `ebd_meetings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_visitors` ADD CONSTRAINT `ebd_visitors_class_id_ebd_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `ebd_classes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_visitors` ADD CONSTRAINT `ebd_visitors_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ebd_visitors` ADD CONSTRAINT `ebd_visitors_created_by_user_id_auth_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `help_article_reads` ADD CONSTRAINT `help_article_reads_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `help_article_reads` ADD CONSTRAINT `help_article_reads_article_id_help_articles_id_fk` FOREIGN KEY (`article_id`) REFERENCES `help_articles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `help_articles` ADD CONSTRAINT `help_articles_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `help_articles` ADD CONSTRAINT `help_articles_created_by_user_id_auth_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `login_history` ADD CONSTRAINT `login_history_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `login_history` ADD CONSTRAINT `login_history_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_custom_fields` ADD CONSTRAINT `member_custom_fields_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_custom_fields` ADD CONSTRAINT `member_custom_fields_created_by_user_id_auth_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_custom_values` ADD CONSTRAINT `member_custom_values_updated_by_user_id_auth_users_id_fk` FOREIGN KEY (`updated_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_custom_values` ADD CONSTRAINT `member_custom_values_person_tenant_fk` FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_custom_values` ADD CONSTRAINT `member_custom_values_field_tenant_fk` FOREIGN KEY (`field_id`,`tenant_id`) REFERENCES `member_custom_fields`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_photos` ADD CONSTRAINT `member_photos_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_photos` ADD CONSTRAINT `member_photos_person_tenant_fk` FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_pre_registration_custom_values` ADD CONSTRAINT `pre_registration_values_request_tenant_fk` FOREIGN KEY (`pre_registration_id`,`tenant_id`) REFERENCES `member_pre_registrations`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_pre_registration_custom_values` ADD CONSTRAINT `pre_registration_values_field_tenant_fk` FOREIGN KEY (`field_id`,`tenant_id`) REFERENCES `member_custom_fields`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_pre_registration_forms` ADD CONSTRAINT `member_pre_registration_forms_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_pre_registration_forms` ADD CONSTRAINT `member_pre_registration_forms_created_by_user_id__e97524f26770dc` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_pre_registration_forms` ADD CONSTRAINT `pre_registration_forms_unit_tenant_fk` FOREIGN KEY (`unit_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_pre_registration_photos` ADD CONSTRAINT `pre_registration_photos_request_tenant_fk` FOREIGN KEY (`pre_registration_id`,`tenant_id`) REFERENCES `member_pre_registrations`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_pre_registrations` ADD CONSTRAINT `member_pre_registrations_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_pre_registrations` ADD CONSTRAINT `member_pre_registrations_reviewed_by_user_id_auth_users_id_fk` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_pre_registrations` ADD CONSTRAINT `pre_registrations_form_tenant_fk` FOREIGN KEY (`form_id`,`tenant_id`) REFERENCES `member_pre_registration_forms`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_pre_registrations` ADD CONSTRAINT `pre_registrations_matrix_tenant_fk` FOREIGN KEY (`matrix_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_pre_registrations` ADD CONSTRAINT `pre_registrations_branch_matrix_tenant_fk` FOREIGN KEY (`branch_id`,`matrix_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`parent_id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_pre_registrations` ADD CONSTRAINT `pre_registrations_member_tenant_fk` FOREIGN KEY (`approved_member_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_sequences` ADD CONSTRAINT `member_sequences_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_permissions` ADD CONSTRAINT `membership_permissions_membership_id_tenant_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_recipients` ADD CONSTRAINT `notification_recipients_notification_id_notifications_id_fk` FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_recipients` ADD CONSTRAINT `notification_recipients_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_unit_id_organizational_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `organizational_units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizational_functions` ADD CONSTRAINT `organizational_functions_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizational_units` ADD CONSTRAINT `organizational_units_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizational_units` ADD CONSTRAINT `organizational_units_parent_id_organizational_units_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `organizational_units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `people` ADD CONSTRAINT `people_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `people` ADD CONSTRAINT `people_linked_auth_user_id_auth_users_id_fk` FOREIGN KEY (`linked_auth_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `people` ADD CONSTRAINT `people_created_by_user_id_auth_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `people` ADD CONSTRAINT `people_spouse_tenant_fk` FOREIGN KEY (`spouse_person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `people` ADD CONSTRAINT `people_function_tenant_fk` FOREIGN KEY (`primary_function_id`,`tenant_id`) REFERENCES `organizational_functions`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `people` ADD CONSTRAINT `people_matrix_tenant_fk` FOREIGN KEY (`matrix_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `people` ADD CONSTRAINT `people_branch_matrix_tenant_fk` FOREIGN KEY (`branch_id`,`matrix_id`,`tenant_id`) REFERENCES `organizational_units`(`id`,`parent_id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `person_functions` ADD CONSTRAINT `person_functions_person_tenant_fk` FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `person_functions` ADD CONSTRAINT `person_functions_function_tenant_fk` FOREIGN KEY (`function_id`,`tenant_id`) REFERENCES `organizational_functions`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `person_history` ADD CONSTRAINT `person_history_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `person_history` ADD CONSTRAINT `person_history_actor_user_id_auth_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `person_history` ADD CONSTRAINT `person_history_actor_membership_id_tenant_memberships_id_fk` FOREIGN KEY (`actor_membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `person_history` ADD CONSTRAINT `person_history_person_tenant_fk` FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `person_relationships` ADD CONSTRAINT `person_relationships_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `person_relationships` ADD CONSTRAINT `person_relationships_person_tenant_fk` FOREIGN KEY (`person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `person_relationships` ADD CONSTRAINT `person_relationships_related_tenant_fk` FOREIGN KEY (`related_person_id`,`tenant_id`) REFERENCES `people`(`id`,`tenant_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `platform_audit` ADD CONSTRAINT `platform_audit_actor_user_id_auth_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `platform_audit` ADD CONSTRAINT `platform_audit_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `platform_owners` ADD CONSTRAINT `platform_owners_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_charges` ADD CONSTRAINT `saas_charges_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_charges` ADD CONSTRAINT `saas_charges_subscription_id_tenant_subscriptions_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `tenant_subscriptions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_payments` ADD CONSTRAINT `saas_payments_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_payments` ADD CONSTRAINT `saas_payments_subscription_id_tenant_subscriptions_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `tenant_subscriptions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_payments` ADD CONSTRAINT `saas_payments_charge_id_saas_charges_id_fk` FOREIGN KEY (`charge_id`) REFERENCES `saas_charges`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_payments` ADD CONSTRAINT `saas_payments_created_by_auth_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `secretary_document_template_versions` ADD CONSTRAINT `secretary_document_template_versions_template_id__cb8f1bbd5c8697` FOREIGN KEY (`template_id`) REFERENCES `secretary_document_templates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `secretary_documents` ADD CONSTRAINT `secretary_documents_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `secretary_documents` ADD CONSTRAINT `secretary_documents_template_id_secretary_documen_441d68d3f5f522` FOREIGN KEY (`template_id`) REFERENCES `secretary_document_templates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `secretary_requests` ADD CONSTRAINT `secretary_requests_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `secretary_transfer_search_limits` ADD CONSTRAINT `secretary_transfer_search_limits_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `secretary_transfer_search_limits` ADD CONSTRAINT `secretary_transfer_search_limits_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_access_contexts` ADD CONSTRAINT `tenant_access_contexts_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_function_id_organizational_functions_id_fk` FOREIGN KEY (`function_id`) REFERENCES `organizational_functions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_scope_unit_id_organizational_units_id_fk` FOREIGN KEY (`scope_unit_id`) REFERENCES `organizational_units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_subscriptions` ADD CONSTRAINT `tenant_subscriptions_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_subscriptions` ADD CONSTRAINT `tenant_subscriptions_plan_id_saas_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `saas_plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `unit_logos` ADD CONSTRAINT `unit_logos_unit_id_organizational_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `organizational_units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_profile_photos` ADD CONSTRAINT `user_profile_photos_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_unit_links` ADD CONSTRAINT `user_unit_links_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_unit_links` ADD CONSTRAINT `user_unit_links_unit_id_organizational_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `organizational_units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `baptism_candidates_status_idx` ON `baptism_candidates` (`tenant_id`,`status`,`person_id`);--> statement-breakpoint
CREATE INDEX `baptism_events_date_idx` ON `baptism_events` (`tenant_id`,`unit_id`,`scheduled_date`,`status`);--> statement-breakpoint
CREATE INDEX `church_movements_report_idx` ON `church_movements` (`tenant_id`,`unit_id`,`movement_type`,`effective_date`,`status`);--> statement-breakpoint
CREATE INDEX `consecrations_status_date_idx` ON `consecrations` (`tenant_id`,`unit_id`,`status`,`event_date`);--> statement-breakpoint
CREATE INDEX `data_export_audit_tenant_created_idx` ON `data_export_audit` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `department_access_membership_idx` ON `department_access` (`tenant_id`,`membership_id`,`status`);--> statement-breakpoint
CREATE INDEX `department_attendance_person_idx` ON `department_attendance` (`tenant_id`,`person_id`,`attendance_status`);--> statement-breakpoint
CREATE INDEX `department_audit_department_created_idx` ON `department_audit` (`tenant_id`,`department_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `department_events_department_date_idx` ON `department_events` (`tenant_id`,`department_id`,`event_date`,`status`);--> statement-breakpoint
CREATE INDEX `department_participants_tenant_person_idx` ON `department_participants` (`tenant_id`,`person_id`,`status`);--> statement-breakpoint
CREATE INDEX `departments_tenant_scope_status_idx` ON `departments` (`tenant_id`,`convention_id`,`matrix_id`,`branch_id`,`status`);--> statement-breakpoint
CREATE INDEX `ebd_attendance_person_history_idx` ON `ebd_attendance` (`tenant_id`,`person_id`,`attendance_status`,`meeting_id`);--> statement-breakpoint
CREATE INDEX `ebd_class_summaries_status_idx` ON `ebd_class_summaries` (`tenant_id`,`meeting_id`,`status`);--> statement-breakpoint
CREATE INDEX `ebd_class_teachers_membership_idx` ON `ebd_class_teachers` (`tenant_id`,`membership_id`,`status`);--> statement-breakpoint
CREATE INDEX `ebd_enrollments_class_status_idx` ON `ebd_enrollments` (`tenant_id`,`class_id`,`status`,`person_id`);--> statement-breakpoint
CREATE INDEX `ebd_student_attendance_history_idx` ON `ebd_student_attendance` (`tenant_id`,`student_id`,`attendance_status`,`meeting_id`);--> statement-breakpoint
CREATE INDEX `ebd_student_enrollments_class_idx` ON `ebd_student_enrollments` (`tenant_id`,`class_id`,`status`,`student_id`);--> statement-breakpoint
CREATE INDEX `ebd_students_department_name_idx` ON `ebd_students` (`tenant_id`,`department_id`,`status`,`full_name`);--> statement-breakpoint
CREATE INDEX `finance_allocation_configs_scope_idx` ON `finance_allocation_configs` (`tenant_id`,`unit_id`,`status`);--> statement-breakpoint
CREATE INDEX `finance_allocation_rules_config_idx` ON `finance_allocation_rules` (`tenant_id`,`config_id`,`active`,`display_order`);--> statement-breakpoint
CREATE INDEX `finance_contribution_category_defaults_category_idx` ON `finance_contribution_category_defaults` (`tenant_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `finance_interunit_repass_events_idx` ON `finance_interunit_repass_events` (`tenant_id`,`repass_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `finance_interunit_repasses_scope_idx` ON `finance_interunit_repasses` (`tenant_id`,`payer_unit_id`,`receiver_unit_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `finance_reopen_requests_matrix_status_idx` ON `finance_period_reopen_requests` (`tenant_id`,`matrix_id`,`status`,`requested_at`);--> statement-breakpoint
CREATE INDEX `finance_reopen_requests_requester_idx` ON `finance_period_reopen_requests` (`tenant_id`,`requester_user_id`,`period_id`,`requested_closure_version`);--> statement-breakpoint
CREATE INDEX `finance_periods_scope_competency_idx` ON `finance_periods` (`tenant_id`,`matrix_id`,`branch_id`,`competency`,`status`);--> statement-breakpoint
CREATE INDEX `finance_quick_sessions_resume_idx` ON `finance_quick_sessions` (`tenant_id`,`user_id`,`period_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `help_articles_visibility_idx` ON `help_articles` (`published`,`category`,`display_order`,`released_at`);--> statement-breakpoint
CREATE INDEX `member_custom_fields_tenant_status_order_idx` ON `member_custom_fields` (`tenant_id`,`status`,`display_order`);--> statement-breakpoint
CREATE INDEX `member_pre_registration_forms_tenant_status_idx` ON `member_pre_registration_forms` (`tenant_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `member_pre_registrations_tenant_status_created_idx` ON `member_pre_registrations` (`tenant_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `member_pre_registrations_tenant_cpf_idx` ON `member_pre_registrations` (`tenant_id`,`cpf`);--> statement-breakpoint
CREATE INDEX `notification_recipients_user_unread_idx` ON `notification_recipients` (`user_id`,`read_at`,`notification_id`);--> statement-breakpoint
CREATE INDEX `notification_recipients_user_created_idx` ON `notification_recipients` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_tenant_type_created_idx` ON `notifications` (`tenant_id`,`type`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_group_key_idx` ON `notifications` (`group_key`,`created_at`);--> statement-breakpoint
CREATE INDEX `people_tenant_voter_title_idx` ON `people` (`tenant_id`,`voter_title`);--> statement-breakpoint
CREATE INDEX `secretary_documents_report_idx` ON `secretary_documents` (`tenant_id`,`unit_id`,`document_type`,`issued_at`);--> statement-breakpoint
CREATE INDEX `secretary_requests_queue_idx` ON `secretary_requests` (`tenant_id`,`status`,`request_type`,`requested_at`);--> statement-breakpoint
CREATE INDEX `secretary_requests_pending_destination_idx` ON `secretary_requests` (`tenant_id`,`person_id`,`destination_unit_id`,`status`);--> statement-breakpoint
CREATE INDEX `secretary_transfer_search_limits_window_idx` ON `secretary_transfer_search_limits` (`window_started_at`,`updated_at`);