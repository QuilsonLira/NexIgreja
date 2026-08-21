# Departamentos, Ministérios e Escola Bíblica

O módulo usa o cadastro central de Pessoas/Membros e os usuários organizacionais já existentes. Uma pessoa pode participar de vários departamentos sem duplicação, enquanto cada líder, secretário e professor usa seu próprio login. Não há credencial compartilhada por departamento ou classe.

## Autorização e isolamento

Toda consulta combina `tenant_id`, escopo Convenção/Matriz/Filial e a permissão funcional global. Usuários que não administram o escopo também precisam de um registro ativo em `department_access`, com permissões locais para aquele departamento. Na EBD, professores veem e alteram apenas as classes atribuídas; Secretaria e administradores autorizados acompanham todas as classes.

As chaves estrangeiras compostas impedem vínculos entre tenants. Mudanças relevantes ficam em `department_audit`, incluindo antes/depois, ator, motivo de correção e fechamento excepcional.

## Fluxos disponíveis

- departamentos, ministérios, grupos, equipes e EBD por unidade;
- funções internas, participantes existentes, liderança e acessos individuais;
- agenda, responsáveis, frequência geral e comunicação por copiar/compartilhar;
- classes, professores, matrículas e transferências com histórico preservado;
- matrícula recomendada por vínculo com Pessoa ou cadastro mínimo somente na EBD, sem CPF obrigatório;
- sugestão de possíveis Pessoas por nome/CPF/telefone, vínculo posterior e criação de Pessoa sem perder chamadas;
- encontro da EBD, chamada parcial, visitantes, Bíblias, assistências, oferta e observações;
- fechamento por classe com controle de versão e fechamento geral calculado no servidor;
- relatórios por período, percentuais calculados e alertas configuráveis de faltas consecutivas;
- modo de leitura em tela cheia e interface de chamada otimizada para celular;
- relatório específico de alunos ainda sem vínculo e exportação administrativa agregada em Excel, CSV ou JSON.

## Integridade, desempenho e evolução

Totais e percentuais são derivados do histórico para evitar dados redundantes. Listagens e seletores têm limites, pesquisas paginadas e índices por tenant, departamento, data, classe e pessoa. A chamada aceita até mil registros por operação e mantém rascunho no banco; operações finalizadas exigem permissão de correção e motivo.

A oferta da EBD é um registro informativo em centavos, separado de caixa, contabilidade e conciliação. Uma integração financeira futura deve consumir o fechamento auditado sem transformar este módulo em fonte contábil.

As migrações incrementais são `drizzle/0019_departments_ebd.sql` e `drizzle/0020_ebd_students_secretary.sql`; os rollbacks estruturais estão em `database/rollback/`. A evolução de alunos copia matrículas e frequências antigas para o novo identificador de aluno e não duplica Pessoas/Membros existentes.
