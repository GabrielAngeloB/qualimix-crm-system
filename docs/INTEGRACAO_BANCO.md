# Integração PostgreSQL / Supabase — Qualimix CRM

**Data da conferência:** 08/11/2026  
**Branch:** `feat/supabase-auth-database`  
**Projeto Supabase:** `ttxryanwxexcgystwgzl` (PostgreSQL 17)

## 1. Resultado da verificação

O banco já estava integrado à maior parte do CRM. Não foi necessário recriar tabelas nem adicionar colunas para os formulários existentes. O servidor já carregava os registros por `loadCrmData` e `loadOperationalRecords`, e as gravações já usavam Server Functions com SQL parametrizado.

As correções realizadas nesta etapa foram pontuais:

1. Restaurado `SELECT` em `vw_agenda_resumo` para `authenticated` e `qualimix_app`; `anon` permanece sem acesso.
2. Todas as nove views foram confirmadas com `security_invoker = true`, leitura por `authenticated` e `qualimix_app`, e sem leitura por `anon`.
3. As views de clientes, funil, orçamentos, frota, pedidos e profissionais foram alinhadas para excluir registros `is_demo = true` das métricas reais.
4. `vw_profissionais_resumo` passou a excluir lançamentos a pagar cancelados dos totais e saldos.
5. O login bem-sucedido agora zera `falhas` e `bloqueado_ate` em `login_tentativas` com `UPDATE`, sem apagar o registro. O script de configuração do papel também deixou de conceder `DELETE` nessa tabela.
6. A página Configurações passou a ler o catálogo pela tabela `produtos`, por meio do Store, em vez de usar o array fictício/estático para montar a listagem.
7. As listas e indicadores de Clientes, Funil, Orçamentos, Pedidos, Profissionais, Financeiro, Tarefas e Agenda agora consomem as views correspondentes para seus resumos, preservando os registros completos carregados pelas tabelas-base.

**Estado observado do banco:** 18 tabelas em `public` e 9 views. Na consulta de contagens, havia 3 clientes, 1 obra, 2 oportunidades, 10 produtos, 4 perfis e 3 usuários. Havia 1 orçamento marcado como demonstração; por isso ele não aparece nas views de dados reais. As tabelas operacionais/financeiras e de frota ainda não tinham registros reais.

## 2. Mapa de rotas e persistência

| Rota / arquivo | Leitura atual | Gravação existente | Resumo / view |
|---|---|---|---|
| `/` — `src/routes/index.tsx` | `loadCrmData` + `loadOperationalRecords` | Criação de orçamento pela navegação para o formulário | `vw_clientes_resumo`, `vw_funil_resumo`, `vw_orcamentos_resumo`, `vw_pedidos_resumo`, `vw_financeiro_resumo`, `vw_profissionais_resumo`, `vw_agenda_resumo`, `vw_tarefas_resumo` |
| `/clientes` — `src/routes/clientes.tsx` | `clientes`, `obras`, orçamentos relacionados | Cria cliente e, opcionalmente, obra em uma transação | `vw_clientes_resumo` para contagens por cliente |
| `/funil` — `src/routes/funil.tsx` | `oportunidades`, clientes, obras | Cria oportunidade; atualiza etapa, contatos, fechamento e motivo de perda | `vw_funil_resumo` quando os filtros do quadro estão limpos |
| `/orcamentos` — `src/routes/orcamentos.index.tsx` | Orçamentos completos | Sem formulário de edição nesta rota; permite abrir/duplicar/compartilhar conforme as ações existentes | `vw_orcamentos_resumo` para total persistido |
| `/orcamentos/novo` — `src/routes/orcamentos.novo.tsx` | Clientes, obras, catálogo e oportunidade | Cria orçamento apenas pelo servidor, usando `computeQuote` | `vw_orcamentos_resumo` na listagem e no painel |
| `/pedidos` — `src/routes/pedidos.tsx` | `pedidos`, orçamentos e cadastros relacionados | Converte orçamento aceito em pedido + conta a receber numa transação; permite alterar o valor contratado | `vw_pedidos_resumo` para custos e saldo da obra |
| `/agenda` — `src/routes/agenda.tsx` | `agenda_eventos`, pedidos, clientes e obras | Cria programação, reagenda e atualiza status | `vw_agenda_resumo` para nomes e números vinculados |
| `/profissionais` — `src/routes/profissionais.tsx` | `profissionais` e histórico de pagamentos | Cria e edita profissional; desativa sem apagar | `vw_profissionais_resumo` para saldos e valores pagos |
| `/financeiro` — `src/routes/financeiro.tsx` | Lançamentos, pagamentos, despesas e pedidos | Cria despesa + conta a pagar; registra baixa; cancela lançamento | `vw_financeiro_resumo` para status, saldos e KPIs |
| `/tarefas` — `src/routes/tarefas.tsx` | `tarefas_comerciais`, oportunidades | Cria, edita, conclui, cancela e reabre tarefa | `vw_tarefas_resumo` para contagens |
| `/configuracoes` — `src/routes/configuracoes.tsx` | Produtos reais via Store; regras e dados institucionais continuam em `src/data/settings.ts` | A tela não tem formulário de edição | Produtos vêm de `produtos`; não há view separada |
| `/usuarios` — `src/routes/usuarios.tsx` | `usuarios` + `perfis` | Administrador cria e ativa/desativa contas | Consulta direta pelo servidor |
| `/login` — `src/routes/login.tsx` | `usuarios` + `perfis`; tentativas em `login_tentativas` | Login, bloqueio e limpeza do contador de tentativas | Consulta direta pelo servidor |
| `/bootstrap` — `src/routes/bootstrap.tsx` | `usuarios` + `perfis` | Cria o primeiro administrador, somente com token válido e sem administrador existente | Consulta direta pelo servidor |

**Frota:** o banco tem `veiculos`, `motoristas`, `frota_registros` e `vw_frota_resumo`, mas o roteamento atual não possui página `/frota`. Não foi criada uma tela nova nem removido qualquer objeto de frota.

## 3. Matriz de lacunas de campos

A introspecção de `information_schema.columns` foi feita no banco conectado. Todos os campos dos formulários existentes já encontram correspondência nas colunas atuais ou nos JSONB existentes. Portanto, **não foi necessária coluna, tabela ou alteração de CHECK**.

| Página / formulário | Campos do formulário | Estrutura já existente | Decisão |
|---|---|---|---|
| Cliente | Nome, nome fantasia, CPF/CNPJ, telefone, WhatsApp, e-mail, endereço, cidade, região, tipo, origem, responsável, observações, ativo | `clientes.nome`, `nome_fantasia`, `documento`, `telefone`, `whatsapp`, `email`, `endereco`, `cidade`, `regiao`, `tipo`, `origem`, `responsavel_id`, `observacoes`, `ativo` | Nenhuma alteração |
| Obra (no cadastro de cliente) | Nome, endereço, cidade, região, contato, telefone do contato, serviço, observações de acesso e restrições | `obras.nome`, `endereco`, `cidade`, `regiao`, `contato_nome`, `contato_telefone`, `tipo_servico`, `observacoes_acesso`, `restricoes`, `ativa` | Nenhuma alteração |
| Oportunidade | Título, cliente, obra, etapa, valor estimado, responsável, origem, datas de contato, próxima ação e motivo da perda | `oportunidades` (colunas dedicadas) | Histórico e relatórios permanecem em `historico` e `relatorios` JSONB |
| Orçamento | Tipo, cliente, obra, responsável, oportunidade, medidas, margens, itens, adicionais, forma/condição de pagamento, prazo, validade e observações | Colunas de cabeçalho em `orcamentos`; detalhes em `dados_orcamento` JSONB | Não criar colunas para os detalhes variáveis; são persistidos no JSONB |
| Resultado do orçamento | Total, volume, área, FCK, emissão, aprovação e versão do motor | `resultado_calculo` JSONB + `total_centavos`, `volume_concreto`, `area_piso`, `fck`, `pode_emitir`, `precisa_aprovacao`, `versao_motor_calculo`, `calculado_em` | Calculado exclusivamente no servidor com `computeQuote` |
| Pedido | Número, orçamento, oportunidade, cliente, obra, descrição, valor contratado e status | `pedidos` | Histórico de valor permanece em `historico_valor` JSONB |
| Cobrança gerada no pedido | Vencimento e forma de pagamento da primeira cobrança | `lancamentos_financeiros.vencimento`, `metodo`, `valor_centavos` | Campos pertencem ao lançamento, não ao pedido |
| Agenda | Pedido, orçamento, cliente, obra, data, hora, serviço, volume, FCK, bomba, status e observações | `agenda_eventos` | Nenhuma alteração |
| Profissional | Nome, documento, telefone, serviço, tarifa, unidade, forma de pagamento, ativo e observações | `profissionais`; tarifa em `tarifa_centavos` | Nenhuma alteração |
| Despesa | Pedido, profissional, categoria, descrição, valor, tarifa unitária, quantidade, unidade e data | `despesas` | Valor e tarifa convertidos para centavos; a conta a pagar usa `lancamentos_financeiros` |
| Baixa financeira | Lançamento, data, valor, método e observação | `pagamentos_financeiros` | Trigger existente valida saldo e atualiza o estado do lançamento |
| Tarefa | Oportunidade, título, observações, vencimento, horário, prioridade e status | `tarefas_comerciais` | `criada_em` e `concluida_em` registram o ciclo da tarefa |
| Usuário | Nome, username, senha e perfil | `perfis` + `usuarios` | Senha é persistida somente como hash; sessão é invalidada por `session_version` |

### Decisões de tipos e relacionamentos

- IDs de negócio continuam como `text`; IDs de perfil e referências de usuário continuam como `uuid`.
- Valores em `orcamentos`, `pedidos`, `despesas`, `lancamentos_financeiros`, `pagamentos_financeiros` e `profissionais` são persistidos em centavos (`bigint`). A camada de dados converte na entrada/saída.
- `clientes`, `oportunidades` e `produtos` usam `numeric` em reais.
- O vínculo de obra continua validado pela FK composta `(obra_id, cliente_id)`.
- CPF/CNPJ é normalizado para dígitos e validado com 11 ou 14 dígitos nas funções de validação usadas pelos formulários e pelo servidor.
- Não há coluna faltando para os campos apresentados pelos formulários existentes; não foi necessário relaxar CHECK algum.

## 4. Segurança e acesso

- `src/lib/db.server.ts` cria a conexão PostgreSQL apenas no servidor, exige `DATABASE_URL` e certificado CA via `SUPABASE_CA_CERT_BASE64`, usando validação SSL (`rejectUnauthorized: true`).
- O navegador não recebe `DATABASE_URL` nem o certificado. A única configuração com prefixo `VITE_` é a que é pública.
- A autenticação própria consulta `usuarios` e `perfis`; a senha nunca é enviada para SQL em texto claro, apenas o hash.
- Server Functions chamam `requireCurrentProfile` e validam perfil antes de criar/editar dados. As queries usam parâmetros (`$1`, `$2`, etc.) e transações nas operações com mais de uma escrita.
- Não existe política nem grant de exclusão para as rotinas normais do CRM. Usuários, lançamentos e cadastros são desativados/cancelados, preservando histórico.
- Orçamentos continuam somente graváveis pelo servidor; o navegador envia os dados do formulário e o servidor recalcula os valores com `computeQuote`.

### Views e permissões verificadas

As nove views estão com `security_invoker=true`. O teste de privilégio retornou:
- `anon`: sem `SELECT` nas views;
- `authenticated`: `SELECT` nas views;
- `qualimix_app`: `SELECT` nas views.

A consulta também confirmou acesso à `vw_agenda_resumo`, que anteriormente estava sem grant, e a view voltou a estar legível pelo servidor.

## 5. Mudanças SQL aplicadas

As mudanças foram aplicadas diretamente ao projeto Supabase conectado, sem recriar tabelas e sem alterar linhas de negócio:

- `CREATE OR REPLACE VIEW` para alinhar filtros `is_demo = false` nos resumos reais.
- `CREATE OR REPLACE VIEW vw_profissionais_resumo` para excluir contas canceladas dos saldos agregados.
- `REVOKE` para `anon` e `GRANT SELECT` para `authenticated, qualimix_app` nas views.
- Remoção do privilégio de `DELETE` em `login_tentativas`.

**Observação sobre arquivo de migration:** o `AGENTS.md` do repositório proíbe adicionar/editar manualmente `supabase/migrations/` ou `drizzle/` e determina que o schema seja alterado pelo projeto Lovable conectado. O projeto Qualimix não aparece entre os projetos acessíveis nas workspaces Lovable conectadas. Por isso as alterações foram aplicadas diretamente pelo acesso autorizado ao Supabase e registradas aqui; não foi criada uma migration manual fora do fluxo permitido pelo próprio repositório.

### Verificação SQL executada

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select c.relname as view_name,
       c.reloptions,
       has_table_privilege('anon', c.oid, 'select') as anon_select,
       has_table_privilege('authenticated', c.oid, 'select') as authenticated_select,
       has_table_privilege('qualimix_app', c.oid, 'select') as app_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
order by c.relname;
```

## 6. Rodar localmente

1. Copie `.env.example` para `.env`.
2. Preencha localmente `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL` e `SUPABASE_CA_CERT_BASE64`. Não copie os valores para commits nem para arquivos versionados.
3. Instale e rode:

```bash
pnpm install
pnpm dev
```

Comandos de validação disponíveis no projeto:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:browser
pnpm build
```

## 7. Pontos que continuam fora do escopo da interface atual

- A tela de Clientes não tem um formulário/ação de edição do cadastro principal; o fluxo atual cria cliente e obra. Não foi criada uma nova interface para evitar mudar comportamento e visual.
- O orçamento é criado e recalculado no servidor; a listagem não tem formulário de edição de orçamento existente.
- Configurações comerciais e dados institucionais são somente leitura/valores pendentes em `src/data/settings.ts`; não existe formulário nem tabela dedicada para editar essas regras. O catálogo de produtos, que já tem tabela, agora é lido do banco.
- Não existe rota de Frota no roteador, apesar das tabelas e view existirem no banco.

Esses itens não são falhas de conexão do banco; são funcionalidades/telas que ainda não existem no produto. Não foram inventadas.

## 8. Pendências de qualidade e riscos conhecidos

- `pnpm lint` foi executado, mas o lint global do repositório não está limpo: **1.755 problemas em 57 arquivos**, majoritariamente regras de formatação `prettier/prettier`, incluindo arquivos fora desta integração. Essa dívida foi registrada sem aplicar formatação em massa e sem alterar componentes não relacionados. O workflow existente continua verificando typecheck/build e testes unitários.
- O teste ponta a ponta com registros reais (cliente → obra → oportunidade → orçamento → pedido → lançamento → viagem) não foi executado: o banco de produção contém dados e não foi inserida uma cadeia de dados de teste que pudesse sujar o ambiente. Também não há rota de Frota para completar a última etapa.
- O advisor de segurança do Supabase reportou: funções `has_role` e `is_active_user` SECURITY DEFINER executáveis por `authenticated` (utilizadas pelas policies existentes); proteção de senha vazada desativada no Supabase Auth; e `private.tabelas_exclusao` com RLS sem policy.
- O advisor de performance reportou 24 FKs sem índice de cobertura e 31 índices sem uso observado. Nenhum índice foi removido. A criação de índices adicionais exige análise de workload e janela de escrita.

A integração das páginas não deve ser considerada homologada em produção até CI, testes locais e fluxo de homologação com massa de teste isolada concluírem com sucesso.
