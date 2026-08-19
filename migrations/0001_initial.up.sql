CREATE TABLE IF NOT EXISTS convencoes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(150) NOT NULL,
  status ENUM('ATIVO', 'INATIVO') NOT NULL DEFAULT 'ATIVO',
  criado_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  atualizado_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  INDEX idx_convencoes_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS matrizes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  convencao_id INT UNSIGNED NOT NULL,
  nome VARCHAR(150) NOT NULL,
  status ENUM('ATIVO', 'INATIVO') NOT NULL DEFAULT 'ATIVO',
  criado_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  atualizado_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_matrizes_convencao FOREIGN KEY (convencao_id) REFERENCES convencoes (id) ON DELETE RESTRICT,
  UNIQUE KEY uq_matrizes_convencao_nome (convencao_id, nome),
  INDEX idx_matrizes_convencao_status (convencao_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS filiais (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  matriz_id INT UNSIGNED NOT NULL,
  nome VARCHAR(150) NOT NULL,
  tipo_unidade VARCHAR(40) NOT NULL DEFAULT 'FILIAL',
  status ENUM('ATIVO', 'INATIVO') NOT NULL DEFAULT 'ATIVO',
  criado_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  atualizado_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_filiais_matriz FOREIGN KEY (matriz_id) REFERENCES matrizes (id) ON DELETE RESTRICT,
  UNIQUE KEY uq_filiais_matriz_nome (matriz_id, nome),
  INDEX idx_filiais_matriz_status (matriz_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  convencao_id INT UNSIGNED NOT NULL,
  nome VARCHAR(150) NOT NULL,
  nome_usuario VARCHAR(50) NOT NULL,
  email VARCHAR(254) NOT NULL,
  cpf_lookup_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  cpf_ultimos_digitos CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  senha_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  funcao VARCHAR(100) NOT NULL,
  status ENUM('ATIVO', 'INATIVO', 'EX_USUARIO', 'BLOQUEADO') NOT NULL DEFAULT 'ATIVO',
  escopo_organizacional ENUM('CONVENCAO', 'MATRIZ', 'FILIAL') NOT NULL,
  matriz_vinculo_id INT UNSIGNED NULL,
  filial_vinculo_id INT UNSIGNED NULL,
  tentativas_falhas SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_ate TIMESTAMP(6) NULL,
  versao_sessao INT UNSIGNED NOT NULL DEFAULT 1,
  troca_senha_obrigatoria BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_login_em TIMESTAMP(6) NULL,
  criado_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  atualizado_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_usuarios_convencao FOREIGN KEY (convencao_id) REFERENCES convencoes (id) ON DELETE RESTRICT,
  CONSTRAINT fk_usuarios_matriz FOREIGN KEY (matriz_vinculo_id) REFERENCES matrizes (id) ON DELETE RESTRICT,
  CONSTRAINT fk_usuarios_filial FOREIGN KEY (filial_vinculo_id) REFERENCES filiais (id) ON DELETE RESTRICT,
  CONSTRAINT chk_usuarios_escopo CHECK (
    (escopo_organizacional = 'CONVENCAO' AND matriz_vinculo_id IS NULL AND filial_vinculo_id IS NULL)
    OR (escopo_organizacional = 'MATRIZ' AND matriz_vinculo_id IS NOT NULL AND filial_vinculo_id IS NULL)
    OR (escopo_organizacional = 'FILIAL' AND matriz_vinculo_id IS NULL AND filial_vinculo_id IS NOT NULL)
  ),
  CONSTRAINT chk_usuarios_nome_publico CHECK (
    nome_usuario NOT LIKE '%@%' AND NOT REGEXP_LIKE(nome_usuario, '^[0-9]{11}$')
  ),
  UNIQUE KEY uq_usuarios_nome_usuario (nome_usuario),
  UNIQUE KEY uq_usuarios_email (email),
  UNIQUE KEY uq_usuarios_cpf_hash (cpf_lookup_hash),
  INDEX idx_usuarios_convencao_status (convencao_id, status),
  INDEX idx_usuarios_escopo (escopo_organizacional, matriz_vinculo_id, filial_vinculo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sessoes_usuario (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  versao_sessao INT UNSIGNED NOT NULL,
  matriz_ativa_id INT UNSIGNED NULL,
  filial_ativa_id INT UNSIGNED NULL,
  ultimo_acesso_anterior_em TIMESTAMP(6) NULL,
  ultimo_acesso_anterior_tipo ENUM('CPF', 'USUARIO', 'EMAIL') NULL,
  ultimo_acesso_anterior_origem VARCHAR(120) NULL,
  ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_agent VARCHAR(500) NOT NULL,
  criado_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  expira_em TIMESTAMP(6) NOT NULL,
  revogado_em TIMESTAMP(6) NULL,
  motivo_revogacao VARCHAR(100) NULL,
  ultimo_uso_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_sessoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE RESTRICT,
  CONSTRAINT fk_sessoes_matriz FOREIGN KEY (matriz_ativa_id) REFERENCES matrizes (id) ON DELETE RESTRICT,
  CONSTRAINT fk_sessoes_filial FOREIGN KEY (filial_ativa_id) REFERENCES filiais (id) ON DELETE RESTRICT,
  CONSTRAINT chk_sessoes_contexto CHECK (filial_ativa_id IS NULL OR matriz_ativa_id IS NOT NULL),
  UNIQUE KEY uq_sessoes_token_hash (token_hash),
  INDEX idx_sessoes_usuario_ativas (usuario_id, revogado_em, expira_em),
  INDEX idx_sessoes_expiracao (expira_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS auditoria_autenticacao (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NULL,
  convencao_id INT UNSIGNED NULL,
  evento ENUM(
    'LOGIN_SUCESSO',
    'LOGIN_RECUSADO',
    'BLOQUEIO_TEMPORARIO',
    'LOGOUT',
    'TROCA_SENHA',
    'REDEFINICAO_SENHA',
    'TROCA_CONTEXTO',
    'ACESSO_FORA_ESCOPO',
    'SESSAO_REVOGADA'
  ) NOT NULL,
  identificador_tipo ENUM('CPF', 'USUARIO', 'EMAIL') NULL,
  identificador_protegido CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  motivo_interno VARCHAR(120) NOT NULL,
  ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  origem_resumo VARCHAR(120) NOT NULL,
  user_agent VARCHAR(500) NOT NULL,
  matriz_id INT UNSIGNED NULL,
  filial_id INT UNSIGNED NULL,
  criado_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT fk_auditoria_convencao FOREIGN KEY (convencao_id) REFERENCES convencoes (id) ON DELETE SET NULL,
  INDEX idx_auditoria_usuario_evento_data (usuario_id, evento, criado_em),
  INDEX idx_auditoria_retencao (criado_em),
  INDEX idx_auditoria_contexto (convencao_id, matriz_id, filial_id, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS autenticacao_tentativas (
  chave_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  tentativas_falhas SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_ate TIMESTAMP(6) NULL,
  ultima_falha_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (chave_hash),
  INDEX idx_tentativas_limpeza (ultima_falha_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS perfis (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  convencao_id INT UNSIGNED NOT NULL,
  nome VARCHAR(100) NOT NULL,
  status ENUM('ATIVO', 'INATIVO') NOT NULL DEFAULT 'ATIVO',
  criado_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_perfis_convencao FOREIGN KEY (convencao_id) REFERENCES convencoes (id) ON DELETE RESTRICT,
  UNIQUE KEY uq_perfis_convencao_nome (convencao_id, nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS permissoes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  descricao VARCHAR(200) NOT NULL,
  criado_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissoes_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS perfil_permissoes (
  perfil_id INT UNSIGNED NOT NULL,
  permissao_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (perfil_id, permissao_id),
  CONSTRAINT fk_perfil_permissoes_perfil FOREIGN KEY (perfil_id) REFERENCES perfis (id) ON DELETE CASCADE,
  CONSTRAINT fk_perfil_permissoes_permissao FOREIGN KEY (permissao_id) REFERENCES permissoes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS usuario_perfis (
  usuario_id INT UNSIGNED NOT NULL,
  perfil_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (usuario_id, perfil_id),
  CONSTRAINT fk_usuario_perfis_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_usuario_perfis_perfil FOREIGN KEY (perfil_id) REFERENCES perfis (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
