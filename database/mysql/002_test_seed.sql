-- Dados exclusivamente fictícios. Troque/inative antes do uso real.

INSERT INTO organizational_units (id, type, name, code, parent_id) VALUES
  (1, 'CONVENCAO', 'Convenção Amazônica', 'CONV-AMAZONICA', NULL),
  (2, 'MATRIZ', 'Matriz — Breu Branco', 'MATRIZ-BREU-BRANCO', 1),
  (3, 'MATRIZ', 'Matriz — Tucuruí', 'MATRIZ-TUCURUI', 1),
  (4, 'FILIAL', 'IPAD Sede Breu Branco', 'FILIAL-SEDE-BREU-BRANCO', 2),
  (5, 'FILIAL', 'Congregação Fonte de Luz', 'FILIAL-FONTE-DE-LUZ', 2),
  (6, 'FILIAL', 'Congregação Nova Jerusalém', 'FILIAL-NOVA-JERUSALEM', 2),
  (7, 'FILIAL', 'Congregação Central', 'FILIAL-CENTRAL-TUCURUI', 3);

INSERT INTO auth_users (id, name, username, email, cpf, password_hash, role_name, scope) VALUES
  (1, 'Quilson Lira', 'quilson', 'admin@nexigreja.com.br', '52998224725', '$2b$12$vKBgQEcWT09ZrxcVGupu6es0b5ZQsEWCDXFcVku9sAglTJPxSlIlm', 'Administrador da Convenção', 'CONVENCAO'),
  (2, 'Gestor da Matriz', 'gestor.matriz', 'matriz@nexigreja.com.br', '16899535009', '$2b$12$naI090qiCEpj24vZDmFbWetGWqTH4eT7dXiuYD/.HfqGiHY4X3PCu', 'Administrador da Matriz', 'MATRIZ'),
  (3, 'Gestor da Filial', 'gestor.filial', 'filial@nexigreja.com.br', '11144477735', '$2b$12$mJRoZkBp9omVTiSdqF1eGOhojXF8d9bD1GZKgV5ryBZMvIa2eCOD.', 'Administrador da Filial', 'FILIAL');

INSERT INTO user_unit_links (user_id, unit_id, is_primary) VALUES
  (1, 1, TRUE),
  (2, 2, TRUE),
  (3, 4, TRUE);
