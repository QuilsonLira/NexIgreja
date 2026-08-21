-- NexIgreja MySQL 8
-- Índices compostos existentes na estrutura D1 real e necessários para
-- referências (id, tenant_id) usadas pelas tabelas financeiras suplementares.

ALTER TABLE `organizational_units`
  ADD UNIQUE KEY `uq_compat_org_units_id_tenant` (`id`, `tenant_id`);

ALTER TABLE `people`
  ADD UNIQUE KEY `uq_compat_people_id_tenant` (`id`, `tenant_id`);

ALTER TABLE `departments`
  ADD UNIQUE KEY `uq_compat_departments_id_tenant` (`id`, `tenant_id`);

ALTER TABLE `finance_periods`
  ADD UNIQUE KEY `uq_compat_finance_periods_id_tenant` (`id`, `tenant_id`);

ALTER TABLE `finance_allocation_configs`
  ADD UNIQUE KEY `uq_compat_fin_alloc_configs_id_tenant` (`id`, `tenant_id`);
