ALTER TABLE auditoria_autenticacao
  ADD COLUMN ip_endereco VARCHAR(45) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER ip_hash;

CREATE TABLE IF NOT EXISTS usuario_permissoes_diretas (
  usuario_id INT UNSIGNED NOT NULL,
  permissao_id INT UNSIGNED NOT NULL,
  concedida_por_usuario_id INT UNSIGNED NULL,
  concedida_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (usuario_id, permissao_id),
  CONSTRAINT fk_usuario_permissoes_diretas_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_usuario_permissoes_diretas_permissao
    FOREIGN KEY (permissao_id) REFERENCES permissoes (id) ON DELETE CASCADE,
  CONSTRAINT fk_usuario_permissoes_diretas_concedente
    FOREIGN KEY (concedida_por_usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL,
  INDEX idx_usuario_permissoes_diretas_concedente (concedida_por_usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS auditoria_administracao (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ator_usuario_id INT UNSIGNED NULL,
  convencao_id INT UNSIGNED NOT NULL,
  acao VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  entidade_tipo VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  entidade_id INT UNSIGNED NOT NULL,
  matriz_id INT UNSIGNED NULL,
  filial_id INT UNSIGNED NULL,
  detalhes JSON NULL,
  ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ip_endereco VARCHAR(45) CHARACTER SET ascii COLLATE ascii_bin NULL,
  origem_resumo VARCHAR(120) NOT NULL,
  user_agent VARCHAR(500) NOT NULL,
  criado_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_auditoria_administracao_ator
    FOREIGN KEY (ator_usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT fk_auditoria_administracao_convencao
    FOREIGN KEY (convencao_id) REFERENCES convencoes (id) ON DELETE RESTRICT,
  INDEX idx_auditoria_administracao_ator_data (ator_usuario_id, criado_em),
  INDEX idx_auditoria_administracao_escopo (convencao_id, matriz_id, filial_id, criado_em),
  INDEX idx_auditoria_administracao_entidade (entidade_tipo, entidade_id, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO permissoes (codigo, descricao) VALUES
  ('USUARIOS_VISUALIZAR', 'Visualizar usuarios'),
  ('USUARIOS_CRIAR', 'Criar usuarios'),
  ('USUARIOS_EDITAR', 'Editar usuarios'),
  ('USUARIOS_DESATIVAR', 'Ativar ou desativar usuarios'),
  ('USUARIOS_REDEFINIR_SENHA', 'Redefinir senha e encerrar sessoes de usuarios'),
  ('UNIDADES_VISUALIZAR', 'Visualizar unidades organizacionais'),
  ('UNIDADES_CRIAR', 'Criar matrizes e filiais dentro do proprio escopo'),
  ('UNIDADES_EDITAR', 'Editar, ativar ou desativar unidades'),
  ('ACESSOS_VISUALIZAR', 'Visualizar historico de acessos')
ON DUPLICATE KEY UPDATE descricao = VALUES(descricao);

INSERT IGNORE INTO usuario_permissoes_diretas (
  usuario_id, permissao_id, concedida_por_usuario_id
)
SELECT u.id, p.id, u.id
FROM usuarios u
CROSS JOIN permissoes p
WHERE u.escopo_organizacional = 'CONVENCAO'
  AND u.status = 'ATIVO'
  AND p.codigo IN (
    'USUARIOS_VISUALIZAR',
    'USUARIOS_CRIAR',
    'USUARIOS_EDITAR',
    'USUARIOS_DESATIVAR',
    'USUARIOS_REDEFINIR_SENHA',
    'UNIDADES_VISUALIZAR',
    'UNIDADES_CRIAR',
    'UNIDADES_EDITAR',
    'ACESSOS_VISUALIZAR'
  );
