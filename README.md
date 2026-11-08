# Qualimix CRM

CRM e sistema de gestão da Qualimix (concreto usinado, concretagens e pisos de concreto). Interface em português do Brasil, moeda BRL e datas DD/MM/AAAA.

## O que já funciona

- **Novo orçamento**: calculadoras de volume e área com vários elementos, margem de segurança e volume informado; itens do catálogo ou itens livres; frete (fixo, por km, por região), bombeamento (fixo, por m³, por hora, mínimo, parceiro), estadia, volume mínimo e descontos; validações em tempo real; bloqueio de proposta definitiva com preço pendente; proposta A4 imprimível/salvável em PDF; WhatsApp com mensagem editável; rascunho salvo automaticamente no navegador.
- **Orçamentos**: pesquisa, filtros, ordenação, paginação, visualização da proposta e duplicação com preços atuais.
- **Clientes e obras**: pesquisa por nome, CPF/CNPJ ou telefone; cadastro rápido com validação de documento e alerta de duplicidade; visão consolidada com obras, orçamentos, contratado, em aberto e histórico.
- **Funil comercial**: colunas e tabela, cadastro de oportunidades reais associadas a clientes/obras, mudança de etapa, motivo de perda obrigatório, follow-ups, histórico e vínculo com orçamento.
- **Tarefas e retornos**: tarefas vinculadas a oportunidades, prazo e horário, prioridade, conclusão/cancelamento e alertas visuais de atrasos e tarefas do dia no painel. Agendamento externo, e-mail e notificações push ainda não estão configurados.
- **Pedidos**: conversão de orçamento real aceito em pedido, com vínculo à oportunidade, cliente e obra e geração da primeira conta a receber.
- **Agenda operacional**: criação, reagendamento e mudança de status de serviços, com vínculos operacionais com vínculos a pedido, orçamento, cliente e obra.
- **Profissionais**: cadastro, custo de referência por serviço/unidade, forma de pagamento preferida e histórico de baixas associadas.
- **Financeiro**: despesas por obra gerando contas a pagar, contas a receber originadas pelos pedidos, vencimentos, baixas parciais, cancelamentos e histórico.
- **Resultado por obra**: valor contratado menos despesas efetivamente lançadas.
- **Painel gerencial**: leads e funil, orçamentos, conversão, contratado, agenda futura, contas a pagar, despesas de obras e saldo após custos. Os filtros comerciais continuam aplicados aos indicadores de venda; os totais operacionais são agregados dos registros visíveis.
- **Configurações**: pendências que dependem da Qualimix (preços, regras, dados institucionais, formas de pagamento) e perfis de acesso previstos.

> **Estado atual da integração:** clientes, obras, oportunidades, orçamentos e os módulos operacionais/financeiros usam PostgreSQL no projeto Supabase conectado, por Server Functions no servidor. A autenticação é própria do CRM (`usuarios` + `perfis` + cookie HTTP-only). As tabelas operacionais, views e políticas RLS já foram aplicadas no projeto conectado. A conexão final da hospedagem ainda exige definir a senha do papel restrito `qualimix_app` e atualizar `DATABASE_URL` e `SUPABASE_CA_CERT_BASE64` no ambiente server-only; até concluir isso e testar os fluxos no ambiente publicado, não trate a versão como pronta para produção.

A base inicial não carrega clientes, obras, oportunidades, orçamentos ou atividades fictícias. Preços e regras comerciais ainda não confirmados permanecem como **Pendente**; não são substituídos por valores de demonstração.

## Tecnologias

- TanStack Start (React 19 + TypeScript), Vite, Tailwind CSS 4
- Chart.js (gráficos), lucide-react (ícones)
- Vitest (testes de regras e indicadores)
- Hospedagem: runtime compatível com TanStack Start e SSR. A persistência final deve usar o projeto Supabase já indicado para o CRM, com políticas de acesso no banco e autenticação configurada no fluxo do projeto.

## Executar localmente

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # testes de cálculo, regras e indicadores
```


Ainda não há conexão Supabase implementada no código desta branch. Não há cliente de banco, carregamento remoto, políticas RLS verificadas ou autenticação integrada. As credenciais devem existir somente como variáveis de ambiente/segredos do ambiente e nunca ser adicionadas ao repositório. O armazenamento local é provisório e serve apenas para validar os fluxos da interface.

## Roteiro

Veja [PLAN.md](./PLAN.md). Próximos marcos: integrar o armazenamento atual ao Supabase existente, validar políticas de acesso, adicionar autenticação e auditoria no servidor, implementar versões/aprovações de orçamento e notificações agendadas.
