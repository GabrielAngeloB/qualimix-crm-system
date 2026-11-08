import { createFileRoute } from '@tanstack/react-router'
import { QuoteBuilder } from '../components/QuoteBuilder'

export const Route = createFileRoute('/orcamentos/novo')({
  validateSearch: (s: Record<string, unknown>): { origem?: string; oportunidade?: string; editar?: string } => ({
    origem: typeof s.origem === 'string' ? s.origem : undefined,
    oportunidade: typeof s.oportunidade === 'string' ? s.oportunidade : undefined,
    editar: typeof s.editar === 'string' ? s.editar : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Novo orçamento — Qualimix CRM' },
      { name: 'description', content: 'Calcule volume e área, frete, bombeamento e descontos e gere a proposta em PDF ou WhatsApp.' },
      { property: 'og:title', content: 'Novo orçamento — Qualimix CRM' },
      { property: 'og:description', content: 'Monte um orçamento de concreto com cálculo automático e proposta pronta.' },
    ],
  }),
  component: NovoOrcamento,
})

function NovoOrcamento() {
  const { origem, oportunidade, editar } = Route.useSearch()
  return <QuoteBuilder key={editar ?? oportunidade ?? origem ?? 'novo'} origin={origem} opportunityId={oportunidade} editQuoteId={editar} />
}
