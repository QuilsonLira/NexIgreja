-- NexIgreja administration module — MySQL 8.0.16+
-- Apply after 001_auth_foundation.sql.

CREATE TABLE user_permissions (
  user_id BIGINT UNSIGNED NOT NULL,
  permission VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, permission),
  KEY idx_user_permissions_user (user_id),
  CONSTRAINT fk_user_permissions_user
    FOREIGN KEY (user_id) REFERENCES auth_users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE administration_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  convention_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  entity_type VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  unit_id BIGINT UNSIGNED NULL,
  ip_address VARCHAR(45) CHARACTER SET ascii COLLATE ascii_bin NULL,
  user_agent VARCHAR(512) NULL,
  device_summary VARCHAR(180) NULL,
  details JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_administration_audit_scope (convention_id, created_at),
  KEY idx_administration_audit_actor (actor_user_id, created_at),
  CONSTRAINT fk_administration_audit_actor
    FOREIGN KEY (actor_user_id) REFERENCES auth_users(id),
  CONSTRAINT fk_administration_audit_convention
    FOREIGN KEY (convention_id) REFERENCES organizational_units(id),
  CONSTRAINT fk_administration_audit_unit
    FOREIGN KEY (unit_id) REFERENCES organizational_units(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO user_permissions (user_id, permission)
SELECT user.id, permission.code
FROM auth_users user
CROSS JOIN (
  SELECT 'USUARIOS_VISUALIZAR' AS code UNION ALL
  SELECT 'USUARIOS_CRIAR' UNION ALL
  SELECT 'USUARIOS_EDITAR' UNION ALL
  SELECT 'USUARIOS_DESATIVAR' UNION ALL
  SELECT 'USUARIOS_REDEFINIR_SENHA' UNION ALL
  SELECT 'UNIDADES_VISUALIZAR' UNION ALL
  SELECT 'UNIDADES_CRIAR' UNION ALL
  SELECT 'UNIDADES_EDITAR' UNION ALL
  SELECT 'ACESSOS_VISUALIZAR'
) permission
WHERE user.scope = 'CONVENCAO' AND user.status = 'ATIVO';
