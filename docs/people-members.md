# Pessoas e Membros

O módulo de Pessoas/Membros é um domínio eclesiástico independente de `auth_users`.
Uma pessoa cadastrada não recebe acesso ao sistema automaticamente; a coluna
`linked_auth_user_id` existe apenas para uma integração futura e opcional.

## Escopo e autorização

Todo registro possui `tenant_id`, `matrix_id` e, quando aplicável, `branch_id`.
Consultas, alterações, fotos, histórico, funções e relações familiares são
validados novamente no backend:

- Convenção: acessa pessoas de suas Matrizes e Filiais;
- Matriz: acessa pessoas da própria Matriz e de suas Filiais;
- Filial: acessa somente pessoas da própria Filial;
- Platform Owner: precisa primeiro selecionar explicitamente um cliente.

As permissões do módulo são `MEMBROS_VISUALIZAR`, `MEMBROS_CRIAR`,
`MEMBROS_EDITAR`, `MEMBROS_ALTERAR_SITUACAO`, `MEMBROS_TRANSFERIR`,
`MEMBROS_IMPRIMIR`, `MEMBROS_HISTORICO_VISUALIZAR`,
`MEMBROS_OBSERVACOES_VISUALIZAR` e `MEMBROS_OBSERVACOES_EDITAR`.

O CPF é normalizado e validado no servidor, único somente dentro do tenant. A
listagem retorna apenas a versão mascarada; o valor completo é disponibilizado
na ficha ou edição autorizada. O código de membro tem seis dígitos e é gerado
por uma sequência atômica e independente para cada tenant.

## Fotos e endereço

Fotos aceitam JPEG, PNG e WebP. O frontend reduz imagens grandes em canvas e o
backend verifica assinatura real, MIME e limite de 2 MiB. Os bytes ficam no D1,
em `member_photos`, e são servidos somente após autenticação e validação de
escopo. A interface usa `object-fit: cover` e volta ao avatar padrão ao remover.

O CEP é consultado pelo endpoint oficial do ViaCEP. A resposta apenas preenche
logradouro, bairro, cidade e UF; todos os campos permanecem editáveis. CEP não
encontrado, indisponibilidade ou bloqueio externo exibem mensagem amigável e
nunca impedem o preenchimento manual.

## Histórico e limites desta entrega

Criação, situação, transferência, função principal, batismo, consagração e foto
geram histórico ou auditoria com ator e data. Observações internas possuem
permissões separadas e não são apagadas por uma edição feita por operador sem
acesso a elas.

Esta entrega prepara estruturas para funções adicionais e vínculo de cônjuge,
mas não implementa dízimos, ofertas, departamentos, células, frequência,
discipulado ou outros módulos financeiros/eclesiásticos futuros.

Migration: `drizzle/0015_people_members.sql`.
Rollback: `database/rollback/0015_people_members.down.sql`.
