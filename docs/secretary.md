# Secretaria Eclesiástica

A Secretaria usa o cadastro único de `people`: não cria uma segunda ficha de membro. Transferências, recebimentos, batismos, consagrações, alterações de situação e documentos emitidos acrescentam histórico e auditoria, sem apagar a Pessoa.

## Fluxos e integridade

- transferências internas passam por solicitação, análise e aprovação com versão otimista; uma restrição única impede concluir duas movimentações para a mesma solicitação;
- a aprovação atualiza Matriz/Filial em lote atômico e aplica a decisão informada para vínculos ativos de Departamentos e EBD;
- recebimentos externos pesquisam Pessoas antes do registro; transferências externas preservam a ficha e mudam somente a situação;
- conclusão de batismo atualiza a data na Pessoa, alerta sobre valor anterior e registra o antes/depois;
- conclusão de consagração usa uma função estruturada do tenant, atualiza a função principal e encerra o vínculo anterior;
- afastamento, retorno, desligamento e falecimento são estados e movimentos históricos, nunca exclusões;
- modelos aceitam apenas texto e variáveis de uma lista segura. HTML, tags e variáveis desconhecidas são recusados;
- cada alteração de modelo cria uma versão. O documento emitido guarda número, versão e snapshots imutáveis do conteúdo.

## Segurança e escopo

Permissões `SECRETARIA_*` separam consulta, movimentação, transferência, batismo, consagração, emissão, modelos, relatórios e configuração. Todas as consultas e mutações validam `tenant_id`, Convenção/Matriz/Filial e a unidade do registro no servidor. Seletores são limitados, dados de outro escopo respondem como não encontrados e as ações relevantes entram em `secretary_audit` e `person_history`.

Os documentos são texto institucional e impressão A4; o módulo não executa HTML nem JavaScript. A Secretaria também não lança caixa, receita, despesa ou conciliação financeira.

## Operação e evolução

O painel oferece visão geral, filas, histórico, filtros, impressão/PDF pelo navegador e exportação administrativa. Índices cobrem tenant, unidade, pessoa, tipo, situação e data. A migração incremental é `drizzle/0020_ebd_students_secretary.sql`; o rollback estrutural de contingência está em `database/rollback/0020_ebd_students_secretary.down.sql`.

