-- NexIgreja auth foundation — MySQL 8.0.16+
-- Execute em um banco vazio de teste antes de usar em produção.

CREATE TABLE organizational_units (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type ENUM('CONVENCAO', 'MATRIZ', 'FILIAL') NOT NULL,
  name VARCHAR(160) NOT NULL,
  code VARCHAR(80) NOT NULL,
  parent_id BIGINT UNSIGNED NULL,
  status ENUM('ATIVO', 'INATIVO') NOT NULL DEFAULT 'ATIVO',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_organizational_units_code (code),
  KEY idx_organizational_units_parent (parent_id, type, status),
  CONSTRAINT fk_organizational_units_parent FOREIGN KEY (parent_id) REFERENCES organizational_units(id),
  CONSTRAINT chk_organizational_units_parent CHECK (
    (type = 'CONVENCAO' AND parent_id IS NULL) OR
    (type IN ('MATRIZ', 'FILIAL') AND parent_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE auth_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(254) NOT NULL,
  cpf CHAR(11) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  password_hash VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  role_name VARCHAR(120) NOT NULL,
  scope ENUM('CONVENCAO', 'MATRIZ', 'FILIAL') NOT NULL,
  status ENUM('ATIVO', 'INATIVO') NOT NULL DEFAULT 'ATIVO',
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  blocked_until DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_users_username (username),
  UNIQUE KEY uq_auth_users_email (email),
  UNIQUE KEY uq_auth_users_cpf (cpf),
  CONSTRAINT chk_auth_users_username_lower CHECK (BINARY username = BINARY LOWER(username)),
  CONSTRAINT chk_auth_users_email_lower CHECK (BINARY email = BINARY LOWER(email)),
  CONSTRAINT chk_auth_users_cpf CHECK (cpf REGEXP '^[0-9]{11}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_unit_links (
  user_id BIGINT UNSIGNED NOT NULL,
  unit_id BIGINT UNSIGNED NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  primary_user_id BIGINT UNSIGNED GENERATED ALWAYS AS (IF(is_primary, user_id, NULL)) STORED,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, unit_id),
  UNIQUE KEY uq_user_unit_primary (primary_user_id),
  KEY idx_user_unit_links_unit (unit_id),
  CONSTRAINT fk_user_unit_links_user FOREIGN KEY (user_id) REFERENCES auth_users(id),
  CONSTRAINT fk_user_unit_links_unit FOREIGN KEY (unit_id) REFERENCES organizational_units(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE auth_sessions (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  token_hash CHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  selected_unit_id BIGINT UNSIGNED NULL,
  previous_login_at DATETIME(3) NULL,
  previous_identifier_type ENUM('CPF', 'USUARIO', 'EMAIL') NULL,
  previous_device_summary VARCHAR(180) NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_sessions_token_hash (token_hash),
  KEY idx_auth_sessions_user (user_id),
  KEY idx_auth_sessions_expiry (expires_at),
  CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES auth_users(id),
  CONSTRAINT fk_auth_sessions_selected_unit FOREIGN KEY (selected_unit_id) REFERENCES organizational_units(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE login_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  identifier_type ENUM('CPF', 'USUARIO', 'EMAIL') NOT NULL,
  identifier_fingerprint CHAR(43) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  success BOOLEAN NOT NULL,
  failure_reason VARCHAR(80) NULL,
  ip_address VARCHAR(45) CHARACTER SET ascii COLLATE ascii_bin NULL,
  user_agent VARCHAR(512) NULL,
  device_summary VARCHAR(180) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_login_history_user_created (user_id, created_at),
  KEY idx_login_history_fingerprint_created (identifier_fingerprint, created_at),
  KEY idx_login_history_ip_created (ip_address, created_at),
  CONSTRAINT fk_login_history_user FOREIGN KEY (user_id) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
