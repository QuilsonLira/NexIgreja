# Central de Notificações

A Central de Notificações é um recurso transversal do NexIgreja. O sino no topo exibe a quantidade não lida, abre os avisos recentes e dá acesso ao histórico completo em `/painel/notificacoes`.

## Modelo e isolamento

`notifications` guarda o evento uma única vez. `notification_recipients` registra os destinatários e o estado de leitura individual. Uma notificação organizacional sempre possui `tenant_id`; uma notificação de plataforma nunca possui. Essa separação é reforçada por restrição no banco e por filtros no backend.

O destinatário só consulta registros associados diretamente ao seu usuário e visíveis no contexto atual. Marcar como lida, inclusive em massa, atualiza somente esse destinatário. A leitura não remove o item do histórico.

## Evento inicial: pré-cadastro

O primeiro evento real é `MEMBRO_PRECADASTRO_RECEBIDO`. O pré-cadastro e seus destinatários são gravados no mesmo lote atômico.

Para receber o aviso, o vínculo deve estar ativo, pertencer ao mesmo tenant e possuir simultaneamente `PRECADASTROS_VISUALIZAR` e `PRECADASTROS_ANALISAR`. O alcance segue a hierarquia:

- formulário geral: somente vínculos da Convenção;
- formulário da Convenção: vínculos daquela Convenção;
- formulário da Matriz: Convenção e aquela Matriz;
- formulário da Filial: Convenção, Matriz responsável e aquela Filial.

A ação aponta somente para uma rota interna validada, como `/painel/membros/pre-cadastros?abrir=123`. A notificação não inclui CPF nem outros dados sensíveis.

## Tipos, prioridade e agrupamento

Os tipos ficam centralizados em `lib/notifications/types.ts`. O modelo já prevê avisos de assinatura e novidades do sistema, quatro prioridades (`INFO`, `ATENCAO`, `IMPORTANTE` e `CRITICA`), `group_key` para agrupamentos futuros e audiência organizacional ou de plataforma.

Novos disparos devem passar pelo serviço em `lib/server/notifications.ts`; módulos de negócio não devem inserir notificações com lógica própria. Toda nova funcionalidade que possua eventos relevantes para o usuário deve avaliar e documentar sua integração com a Central de Notificações.

## Atualização e evolução

O cliente consulta a contagem a cada 45 segundos enquanto a aba está visível. Não há e-mail nem push nesta etapa. `metadata_json`, `mandatory`, `archived_at` e `group_key` permitem evoluir para agrupamento, retenção e novos canais sem alterar a leitura individual existente.
