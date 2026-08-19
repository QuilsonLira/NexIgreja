# API do NexIgreja

Todas as respostas de autenticacao usam `Cache-Control: no-store`. As operacoes que alteram estado validam a origem da requisicao.

## `POST /api/auth/login`

Entrada:

```json
{
  "identifier": "cpf, usuario ou e-mail",
  "password": "senha sem qualquer alteracao"
}
```

Cria uma sessao por cookie seguro. A resposta inclui somente o usuario seguro, vinculo, contexto ativo e ultimo acesso anterior.

## `GET /api/auth/me`

Consulta e revalida a sessao atual. Nunca devolve senha, hash, CPF, e-mail da credencial ou dados internos de bloqueio.

## `POST /api/auth/logout`

Revoga a sessao no banco, registra auditoria e remove o cookie.

## `POST /api/auth/change-password`

Entrada:

```json
{
  "currentPassword": "senha atual",
  "newPassword": "nova senha",
  "confirmPassword": "nova senha"
}
```

Exige a senha atual, grava novo Argon2id e revoga todas as sessoes.

## `GET /api/session/available-contexts`

Lista somente matrizes e filiais permitidas pelo escopo do usuario autenticado.

## `POST /api/session/context`

Entrada:

```json
{
  "matrixId": 1,
  "branchId": 3
}
```

`branchId` pode ser nulo para trabalhar na propria matriz. A validacao acontece novamente no servidor. Usuario `FILIAL` nao pode usar esta operacao.

## Respostas de erro

Falhas de login usam mensagem generica para nao confirmar a existencia de uma conta. O motivo real fica somente na auditoria interna.

## Administracao

Todas as rotas abaixo exigem sessao valida. Cada operacao consulta no backend a permissao funcional e o escopo `CONVENCAO`, `MATRIZ` ou `FILIAL`. IDs enviados pelo navegador nunca definem autorizacao.

### Inicializacao

- `GET /api/admin/bootstrap`: permissoes efetivas, unidades disponiveis e opcoes permitidas para os formularios.

### Unidades

- `GET /api/admin/units`: pesquisa, filtros por tipo/status e paginacao.
- `POST /api/admin/units`: cadastra Matriz ou Filial dentro do escopo.
- `GET /api/admin/units/:type/:id`: consulta uma unidade autorizada.
- `PATCH /api/admin/units/:type/:id`: edita nome e, quando permitido, a matriz de uma Filial.
- `POST /api/admin/units/:type/:id/status`: ativa ou desativa com validacao da hierarquia.

Um usuario da Convencao pode editar sua propria Convencao, mas nao criar outra Convencao. Isso preserva o limite do tenant.

### Usuarios

- `GET /api/admin/users`: pesquisa, filtros por escopo/status e paginacao.
- `POST /api/admin/users`: cadastra usuario, vinculo, senha temporaria e permissoes.
- `GET /api/admin/users/:id`: consulta cadastro e permissoes.
- `PATCH /api/admin/users/:id`: edita cadastro, vinculo e permissoes.
- `POST /api/admin/users/:id/status`: ativa ou desativa e revoga sessoes quando necessario.
- `POST /api/admin/users/:id/reset-password`: define senha temporaria, exige troca no proximo acesso e revoga sessoes.
- `DELETE /api/admin/users/:id/sessions`: encerra todas as sessoes ativas do usuario.

CPF completo e senha nunca sao devolvidos. Na edicao, o CPF aparece apenas mascarado e so muda quando um novo CPF valido e informado.

### Historico

- `GET /api/admin/access-history`: pesquisa, filtros por resultado, metodo e periodo, com paginacao e isolamento por escopo.

O retorno mostra metodo de login, dispositivo, IP quando disponivel, unidade e evento. Nunca mostra o identificador digitado, senha ou token.
