# Comercial, assinatura e licença SaaS

O domínio comercial controla a contratação do **NexIgreja pelo tenant**. Ele é
independente da estrutura organizacional e, principalmente, do futuro financeiro
interno das igrejas.

```text
Tenant
├── Estrutura organizacional: Convenção → Matriz → Filial
└── Assinatura SaaS
    ├── Plano
    ├── Teste e carência
    ├── Cobranças
    ├── Pagamentos
    └── Licença de acesso
```

Uma mensalidade do NexIgreja nunca é dízimo, oferta, entrada, saída ou movimento
de caixa da igreja. As tabelas, serviços, endpoints, permissões e telas do módulo
comercial usam nomes próprios (`saas_*`, `commercial_*` e
`tenant_subscriptions`) para preservar essa separação.

## Modelo de dados

| Tabela | Responsabilidade |
|---|---|
| `commercial_profiles` | Dados comerciais e de cobrança do tenant |
| `saas_plans` | Catálogo de planos e padrões de teste/carência |
| `tenant_subscriptions` | Contrato, preço efetivo, datas e estado da licença |
| `saas_charges` | Cobranças internas manuais por competência e vencimento |
| `saas_payments` | Recebimentos manuais, um por cobrança |
| `billing_settings` | Avisos, Pix, conta, instruções e suporte |
| `commercial_audit` | Histórico imutável das operações por tenant |

O tenant possui um perfil comercial e uma assinatura. A assinatura pode usar o
preço do plano ou um valor personalizado. Cobranças e pagamentos sempre carregam
`tenant_id` e `subscription_id`; constraints e consultas impedem que a situação
de um tenant altere outro.

## Estados e acesso

| Estado | Regra de acesso |
|---|---|
| `TESTE` | Liberado até o último dia do teste, inclusive |
| `ATIVA` | Liberado até o vencimento, inclusive |
| `AGUARDANDO_PAGAMENTO` | Bloqueado quando ainda não há vencimento válido |
| `EM_CARENCIA` | Liberado com aviso até o último dia da carência |
| `SUSPENSA` | Somente assinatura, instruções de pagamento, suporte e logout |
| `CANCELADA` / `ENCERRADA` | Módulos organizacionais bloqueados |
| `ISENTA` | Cortesia; não suspende por falta de cobrança |

A verificação ocorre no backend em `administrativeSession`, portanto ocultar um
botão não contorna a licença. O Platform Owner ignora esse bloqueio para poder
administrar e reativar clientes suspensos. No tenant, detalhes comerciais ficam
restritos ao escopo Convenção ou à permissão `ASSINATURA_VISUALIZAR`; alterações
comerciais continuam exclusivas do Platform Owner.

## Verificação automática e datas

O ambiente atual não expõe scheduler/cron. Por isso a estratégia é
**lazy e idempotente**: cada criação da sessão segura e cada consulta comercial
recalcula teste, vencimento e carência; atualiza a assinatura somente se o estado
real mudou; marca cobranças vencidas; e cria a cobrança do vencimento com chave
única `(subscription_id, due_date)`. Assim, nenhuma intervenção manual é
necessária para descobrir um vencimento e repetir a verificação não duplica
cobranças ou transições.

Datas comerciais são armazenadas como `YYYY-MM-DD` e comparadas como datas civis,
sem conversão para meia-noite UTC. O “hoje” usa `America/Belem`, consistente com
a operação inicial no Brasil. O dia 31 é ajustado para o último dia em meses mais
curtos.

## Pagamento e renovação

O pagamento é manual. Ao registrá-lo, o backend:

1. confirma que a cobrança pertence ao mesmo tenant e à assinatura;
2. recusa nova renovação se a cobrança já estiver paga;
3. exige confirmação explícita se o valor recebido diferir da cobrança;
4. grava o recebimento e marca a cobrança como `PAGA` numa operação em lote;
5. ativa a assinatura, remove suspensão/carência e calcula o próximo vencimento.

Para pagamento atrasado, a nova competência parte da data efetiva do pagamento,
mantém o dia contratual e avança uma periodicidade completa. Essa política evita
reativar o cliente já vencido. Reativação sem pagamento exige motivo e nova data.

## Preparação para provedor externo

Nesta versão, `payment_provider` é `MANUAL` e não há integração com Asaas,
Mercado Pago, banco, Pix Automático, boleto ou cartão. Os identificadores
`provider_customer_id`, `provider_subscription_id`, `provider_charge_id`,
`provider_payment_id` e `external_reference` já isolam o domínio de um futuro
adaptador.

Uma integração futura deve automatizar criação de cobrança, QR Code, webhook,
confirmação, renovação e reativação. Plano, teste, vencimento, carência, suspensão
e autorização permanecem no núcleo independente de provedor.

## Migração e compatibilidade

A migration incremental `0014_manual_billing.sql` cria o domínio sem alterar
migrations antigas. Tenants existentes recebem uma assinatura de cortesia
(`ISENTA`) para preservar o acesso atual. Novos tenants começam com teste de 15
dias e podem ser configurados pelo Platform Owner. O rollback remove apenas as
tabelas comerciais criadas nessa etapa.
