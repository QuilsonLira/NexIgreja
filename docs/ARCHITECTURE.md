# Arquitetura do NexIgreja

## Estrutura encontrada

O repositorio estava vazio. Por isso, foi criada uma aplicacao web monolitica em Next.js e TypeScript, com APIs e interface no mesmo projeto e MySQL como banco definitivo.

Essa escolha reduz a quantidade de partes que o proprietario precisa administrar no inicio, mas mantem dominio, servicos e banco separados por pastas para permitir crescimento.

## Organizacao principal

| Area | Responsabilidade |
|---|---|
| `app/` | Paginas e rotas HTTP |
| `components/` | Interface de login, painel, contexto e senha |
| `lib/auth/` | Identificacao, senha, sessao, auditoria e escopos |
| `lib/admin/` | Permissoes, regras administrativas, consultas e gravacoes seguras |
| `lib/db/` | Conexao e transacoes MySQL |
| `migrations/` | Estrutura reversivel do banco |
| `scripts/` | Migracao, administrador inicial, rollback e retencao |
| `tests/` | Testes unitarios de seguranca e isolamento |

## Modelagem do alcance organizacional

O sistema inclui `convencoes`, `matrizes` e `filiais`. Cada usuario pertence obrigatoriamente a uma Convencao.

Os vinculos ficaram diretamente na tabela `usuarios` porque o usuario tem exatamente um escopo principal. Assim o MySQL consegue aplicar uma `CHECK CONSTRAINT`:

| Escopo | `matriz_vinculo_id` | `filial_vinculo_id` |
|---|---:|---:|
| `CONVENCAO` | nulo | nulo |
| `MATRIZ` | obrigatorio | nulo |
| `FILIAL` | nulo | obrigatorio |

Para `FILIAL`, a matriz e sempre derivada da propria filial. Isso evita guardar duas informacoes contraditorias.

A funcao `canAccessUnit()` em `lib/auth/scope.ts` e o ponto central de autorizacao. Os IDs recebidos do navegador nunca sao aceitos sem nova consulta ao banco.

### Escopo CONVENCAO

- Lista somente matrizes ativas da Convencao do usuario.
- Acessa a propria matriz ou uma filial ativa vinculada a ela.
- Pode trocar matriz e filial durante a sessao.

### Escopo MATRIZ

- Matriz fixa e obrigatoria.
- Lista somente filiais ativas dessa matriz.
- Nao aceita outra matriz, ainda que o ID seja alterado manualmente.

### Escopo FILIAL

- Filial fixa e obrigatoria.
- Contexto definido automaticamente no login.
- A rota de troca de contexto recusa toda chamada e registra auditoria.

## Autenticacao

1. O identificador recebe somente remocao de espacos externos.
2. CPF e classificado por formato, normalizado para 11 digitos e validado pelos digitos verificadores.
3. E-mail e usuario sao comparados em minusculas e por igualdade exata.
4. Somente a coluna classificada e consultada. Nao ha consulta com `OR` nem pesquisa parcial.
5. O hash Argon2id e verificado sem alterar nenhum caractere da senha.
6. Status, bloqueio temporario e vinculo organizacional sao validados no servico.
7. O ultimo login bem-sucedido e lido antes de registrar o acesso atual.
8. Um token aleatorio e enviado em cookie `HttpOnly`; somente seu HMAC fica no banco.

CPF completo nao e armazenado no cadastro de usuario. O banco guarda um HMAC para busca exata e somente os dois ultimos digitos para eventual exibicao mascarada. A unicidade inclui contas ativas e historicas.

## Sessao e auditoria

A sessao contem apenas usuario seguro, vinculo, contexto atual e resumo do acesso anterior. Troca de senha incrementa `versao_sessao` e revoga todas as sessoes existentes.

A auditoria usa HMAC para IP e identificador. Nao armazena senha, hash de senha, cookie ou token. A retencao inicial e de 90 dias.

## Permissoes administrativas

Escopo organizacional e permissao funcional permanecem separados:

- **Escopo:** onde o usuario pode acessar.
- **Permissao:** o que o usuario pode fazer.

As permissoes existentes nesta versao sao cadastradas pela migration `0002_administration.up.sql`. A atribuicao individual usa `usuario_permissoes_diretas`; os perfis continuam compativeis e suas permissoes sao combinadas na leitura.

O servico administrativo aplica quatro verificacoes antes de uma operacao:

1. sessao valida e usuario ativo;
2. troca da senha temporaria concluida;
3. permissao funcional exigida;
4. alcance organizacional do alvo consultado novamente no banco.

Um administrador nunca pode conceder uma permissao que ele proprio nao possui. Alteracoes de escopo ou permissoes revogam as sessoes do usuario afetado.

### Limite superior da Convencao

Um usuario `CONVENCAO` administra somente sua propria Convencao. Ele pode editar esse registro e cadastrar matrizes e filiais subordinadas, mas nao pode criar outra Convencao. A criacao de um novo tenant exigira no futuro um escopo de plataforma separado, que nao foi inventado nesta etapa.

## Auditoria administrativa

`auditoria_autenticacao` registra entradas e eventos de sessao. `auditoria_administracao` registra o ator, a acao, o alvo, o contexto, o dispositivo e os campos de seguranca alterados, sem armazenar senha, hash, token ou CPF aberto.

## Caixa

Nao havia banco nem estrutura de caixa no repositorio vazio. Portanto, a inicializacao de caixa nao foi inventada nesta etapa. Quando o modulo financeiro for migrado, a consulta de caixa aberto devera usar conjuntamente `filial_id`, `numero_caixa` e `status`.
