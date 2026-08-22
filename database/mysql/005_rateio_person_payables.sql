ALTER TABLE `finance_allocation_rules`
  ADD COLUMN `person_id` BIGINT NULL,
  ADD COLUMN `beneficiary_type` VARCHAR(80) NULL,
  ADD COLUMN `payable_description` TEXT NULL,
  ADD COLUMN `due_day` BIGINT NULL;

ALTER TABLE `finance_period_allocation_rules`
  ADD COLUMN `person_id` BIGINT NULL,
  ADD COLUMN `beneficiary_type` VARCHAR(80) NULL,
  ADD COLUMN `payable_description` TEXT NULL,
  ADD COLUMN `due_day` BIGINT NULL;

ALTER TABLE `finance_obligations`
  ADD COLUMN `generated_by_rateio` BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN `rateio_period_id` BIGINT NULL,
  ADD COLUMN `rateio_closure_version` BIGINT NULL,
  ADD COLUMN `rateio_rule_id` BIGINT NULL,
  ADD COLUMN `rateio_rule_order` BIGINT NULL,
  ADD COLUMN `beneficiary_cpf_snapshot` VARCHAR(32) NULL,
  ADD COLUMN `rateio_gross_cents` BIGINT NULL,
  ADD COLUMN `rateio_advance_cents` BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN `rateio_adjustment_cents` BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN `rateio_adjustment_reason` TEXT NULL,
  ADD COLUMN `rateio_cancel_reason` TEXT NULL;

CREATE UNIQUE INDEX `finance_obligations_rateio_version_rule_uq`
  ON `finance_obligations` (`tenant_id`,`rateio_period_id`,`rateio_closure_version`,`rateio_rule_order`);

CREATE INDEX `finance_obligations_rateio_person_history_idx`
  ON `finance_obligations` (`tenant_id`,`person_id`,`rateio_period_id`,`rateio_closure_version`);

CREATE INDEX `finance_allocation_rules_person_idx`
  ON `finance_allocation_rules` (`tenant_id`,`person_id`);

CREATE INDEX `finance_period_allocation_rules_person_idx`
  ON `finance_period_allocation_rules` (`tenant_id`,`period_id`,`person_id`);
