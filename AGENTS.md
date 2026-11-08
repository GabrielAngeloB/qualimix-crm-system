<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

# AGENTS.md — Qualimix CRM

CRM da Qualimix (concreto usinado, concretagens, pisos). Toda a interface é em pt-BR, com BRL e datas DD/MM/AAAA. **Continue a partir de [PLAN.md](./PLAN.md)**. A persistência multiusuário deve usar o projeto Supabase já indicado para este CRM, após confirmar o schema pelo fluxo Lovable; não criar um banco paralelo com Drizzle nem editar migrations manualmente.

## Arquitetura

- TanStack Start + React 19 + TypeScript + Tailwind 4. Rotas em arquivo em `src/routes/`; `src/routeTree.gen.ts` é gerado no build.
- `src/routes/__root.tsx`: documento, fontes (Barlow / Barlow Condensed), script de tema sem piscar, `StoreProvider` e `AppShell`.
- Telas: `index.tsx` (painel), `orcamentos.index.tsx`, `orcamentos.novo.tsx` (aceita `?origem=<id>` para duplicar), `clientes.tsx` (`?id=` abre o cliente, `?novo=1` abre o cadastro), `funil.tsx`, `configuracoes.tsx`.
- Arquivos de rota exportam apenas `Route`. Componentes compartilhados ficam em `src/components/` (`ui.tsx` primitivos, `bits.tsx`, `table.tsx`, `Charts.tsx`, `QuoteBuilder.tsx`, `MeasureCalculator.tsx`, `ProposalDocument.tsx`, `QuoteShare.tsx`).

## Lógica de negócio (pura, testada)

- `src/lib/quote.ts`: motor de orçamentos. `computeElement` / `summarizeMeasures` (volume = C × L × E(cm)/100 × N; área = C × L × N) e `computeQuote` (itens, frete, bombeamento, estadia, volume mínimo, descontos, aprovações e bloqueios). Dinheiro em **centavos inteiros**; precisão total nas medições; arredondamento só na quantidade cobrada (`quantityDecimals`) e nos centavos da linha. **Será reutilizado no servidor para validar antes de salvar.**
- `src/lib/format.ts`: formatação pt-BR, `parseDecimal` (aceita "1.234,56" e "12.5"; vazio = null), `roundHalfUp`, `toCents`.
- `src/lib/documents.ts`: CPF/CNPJ, telefone e links `wa.me`.
- `src/data/metrics.ts`: indicadores do painel (deduplica versões por número).

## Dados

- `src/data/fixtures.ts` é a **única fonte de dados fictícios** (todos com `demo: true`). No Marco 2, troque pelo banco mantendo os tipos.
- `src/data/settings.ts`: catálogo, regras oficiais (todas `null` = pendentes) e regras/preços de demonstração (fictícios), formas de pagamento, dados institucionais (`null` até o admin preencher), origens, regiões e etapas.
- `src/data/derived.ts`: avalia orçamentos com o contexto correto (`quoteContext(demoMode)`) e deriva as contas a receber dos totais calculados, para que todas as telas mostrem os mesmos valores.
- `src/data/store.tsx`: estado da sessão (modo demonstração, clientes criados, oportunidades, toasts). Inclusões ainda não persistem no servidor.
- O rascunho do orçamento é salvo em `localStorage` (`qmx-orcamento-rascunho-v1`) apenas para não perder dados do formulário.

## Regras que não podem ser quebradas

- Nunca inventar preços, CNPJ, endereço, telefone ou capacidades da Qualimix. Valor ausente é `null` → "Pendente", **nunca R$ 0,00**.
- Proposta definitiva é bloqueada com preço pendente, regra não configurada ou cobrança duplicada; preço manual e descontos acima do limite exigem aprovação.
- Abrir o WhatsApp não marca o orçamento como enviado; gerar/enviar não fecha a oportunidade; Pix/boleto não marca conta como paga.
- Dados de demonstração sempre identificados e separáveis dos reais.

## Convenções

- Tokens de cor em `src/styles.css` (`bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-brand`, `ok/warn/info`), com tema claro e escuro (`data-theme`). Títulos com `font-display` em caixa alta.
- APIs do navegador apenas em efeitos ou handlers (SSR).
- Impressão: a proposta é renderizada em `.print-portal` (portal no `body`); o CSS de impressão oculta todo o resto.
- Testes: `npm test` (Vitest, `src/**/*.test.ts`) e `npm run test:browser` (Playwright, `tests/`). O build não faz checagem de tipos.
- TypeScript fica na versão 6 (a versão 6 é a versão atualmente validada pelo projeto; reavaliar upgrades com a suíte de testes).

## Lovable migration notes

- Root layout keeps Lovable's QueryClient router context, error reporting and `styles.css?url` link alongside the app's StoreProvider/AppShell; why: the template's router and SSR setup depend on them.
- The template's shadcn kit (`src/components/ui/`) was removed; the app's own primitives live in `src/components/ui.tsx`; why: same import name and its color tokens are not defined here.
- TanStack, Vite and TypeScript versions follow the Lovable template, not the source repo; why: the hosted build pins them.
