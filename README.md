# Qualimix CRM

CRM e sistema de gestão da Qualimix (concreto usinado, concretagens e pisos de concreto). Interface em português do Brasil, moeda BRL e datas DD/MM/AAAA.

## O que já funciona

- **Painel gerencial**: leads, orçamentos criados, enviados e aceitos, taxa de conversão, valor orçado × contratado, m³ e m² vendidos, vendas por FCK, desempenho por origem, orçamentos aguardando retorno, próximas concretagens e contas a receber (cobrado × recebido × vencido). Filtros por período e responsável.
- **Novo orçamento**: calculadoras de volume e área com vários elementos, margem de segurança e volume informado; itens do catálogo ou itens livres; frete (fixo, por km, por região), bombeamento (fixo, por m³, por hora, mínimo, parceiro), estadia, volume mínimo e descontos; validações em tempo real; bloqueio de proposta definitiva com preço pendente; proposta A4 imprimível/salvável em PDF; WhatsApp com mensagem editável; rascunho salvo automaticamente no navegador.
- **Orçamentos**: pesquisa, filtros, ordenação, paginação, visualização da proposta e duplicação com preços atuais.
- **Clientes e obras**: pesquisa por nome, CPF/CNPJ ou telefone; cadastro rápido com validação de documento e alerta de duplicidade; visão consolidada com obras, orçamentos, contratado, em aberto e histórico.
- **Funil comercial**: colunas e tabela, mudança de etapa, motivo de perda obrigatório, fechamento explícito, follow-ups e histórico.
- **Configurações**: pendências que dependem da Qualimix (preços, regras, dados institucionais, formas de pagamento) e perfis de acesso previstos.

Nenhum preço, dado institucional ou capacidade operacional da Qualimix foi inventado. Os valores exibidos vêm de **dados de demonstração fictícios**, identificados na interface e que podem ser ocultados no menu lateral.

## Tecnologias

- TanStack Start (React 19 + TypeScript), Vite, Tailwind CSS 4
- Chart.js (gráficos), lucide-react (ícones)
- Vitest (testes de regras) e Playwright (teste de navegador)
- Hospedagem na Netlify. Próximas etapas: Netlify Database (Postgres + Drizzle), Netlify Identity e Netlify Blobs

## Executar localmente

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # testes de cálculo, regras e indicadores
```

Ou, com emulação da plataforma Netlify: `netlify dev`.

Ainda não há variáveis de ambiente obrigatórias. Banco, autenticação e armazenamento serão provisionados pela Netlify nos próximos marcos.

## Roteiro

Veja [PLAN.md](./PLAN.md). Próximos marcos: banco de dados e persistência, autenticação e permissões, configurações editáveis, ciclo completo do orçamento (versões, aprovação, PDF no servidor com link seguro), pedidos e agenda, financeiro, notificações agendadas.
