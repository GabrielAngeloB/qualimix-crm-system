import { createFileRoute } from '@tanstack/react-router'
import { QuoteBuilder } from '../components/QuoteBuilder'

export const Route = createFileRoute('/orcamentos/novo')({
  validateSearch: (s: Record<string, unknown>): { origem?: string } => ({
    origem: typeof s.origem === 'string' ? s.origem : undefined,
  }),
  head: () => ({ meta: [{ title: 'Novo orçamento — Qualimix CRM' }] }),
  component: NovoOrcamento,
})

function NovoOrcamento() {
  const { origem } = Route.useSearch()
  return <QuoteBuilder key={origem ?? 'novo'} origin={origem} />
}
