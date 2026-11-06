import { createFileRoute } from '@tanstack/react-router'
import { CircleCheck, Lock, TriangleAlert } from 'lucide-react'
import { catalog, categoryLabel, company, demoRules, funnelStages, leadSources, officialRules, paymentMethods, pendingSettings, regions } from '../data/settings'
import { brl, num } from '../lib/format'
import { Badge, Card, CardHeader, PageHeader } from '../components/ui'

export const Route = createFileRoute('/configuracoes')({
  head: () => ({ meta: [{ title: 'Configurações — Qualimix CRM' }] }),
  component: Configuracoes,
})

const v = (x: number | null, fmt: (n: number) => string = brl) => (x === null ? <Badge tone="warn">Pendente</Badge> : <span className="tabular">{fmt(x)}</span>)

const permissions: [string, string[]][] = [
  ['Administrador', ['Preços e regras comerciais', 'Usuários e permissões', 'Todos os módulos']],
  ['Comercial', ['Clientes, obras e leads', 'Funil e orçamentos', 'Descontos dentro do limite']],
  ['Operação', ['Consulta de pedidos', 'Agenda de concretagens', 'Caminhões e viagens']],
  ['Financeiro', ['Contas a receber', 'Registro de pagamentos', 'Relatórios financeiros']],
  ['Consulta', ['Somente leitura']],
]

function Configuracoes() {
  const pend = pendingSettings()
  const ruleRows: [string, number | null, number | null, ((n: number) => string)?][] = [
    ['Frete — valor fixo', officialRules.freight.fixed, demoRules.freight.fixed],
    ['Frete — por km', officialRules.freight.perKm, demoRules.freight.perKm],
    ...officialRules.freight.regions.map((r, i): [string, number | null, number | null] => [`Frete — ${r.name}`, r.price, demoRules.freight.regions[i]?.price ?? null]),
    ['Bombeamento — fixo', officialRules.pumping.fixed, demoRules.pumping.fixed],
    ['Bombeamento — por m³', officialRules.pumping.perM3, demoRules.pumping.perM3],
    ['Bombeamento — por hora', officialRules.pumping.perHour, demoRules.pumping.perHour],
    ['Bombeamento — mínimo', officialRules.pumping.minimum, demoRules.pumping.minimum],
    ['Volume mínimo (m³)', officialRules.minVolume.m3, demoRules.minVolume.m3, (n) => `${num(n, 1)} m³`],
    ['Estadia — tolerância', officialRules.stay.toleranceMin, demoRules.stay.toleranceMin, (n) => `${n} min`],
    ['Estadia — por hora', officialRules.stay.perHour, demoRules.stay.perHour],
    ['Piso — área mínima', officialRules.floor.minArea, demoRules.floor.minArea, (n) => `${num(n, 0)} m²`],
    ['Desconto sem aprovação', officialRules.maxDiscountPctWithoutApproval, demoRules.maxDiscountPctWithoutApproval, (n) => `${n}%`],
    ['Validade padrão', officialRules.validityDays, demoRules.validityDays, (n) => `${n} dias`],
  ]

  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" description="O que precisa ser confirmado com a Qualimix antes de emitir propostas com valores oficiais. Nenhum preço, dado institucional ou capacidade foi presumido." />

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Pendências para operação" subtitle="Obrigatórias para propostas definitivas com valores oficiais." />
          <ul className="space-y-2 p-5 text-sm">
            {pend.map((p) => (
              <li key={p} className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-warn" /> {p}</li>
            ))}
            {!pend.length && <li className="flex items-center gap-2 text-ok"><CircleCheck className="h-4 w-4" /> Tudo configurado</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Dados institucionais" subtitle="Usados no cabeçalho das propostas em PDF." />
          <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 p-5 text-sm">
            {([['Nome comercial', company.tradeName], ['Razão social', company.legalName], ['CNPJ', company.cnpj], ['Endereço', company.address], ['Telefone', company.phone], ['E-mail', company.email], ['Logo', company.logoUrl]] as [string, string | null][]).map(([k, val]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd>{val ?? <Badge tone="warn">A preencher</Badge>}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Catálogo de produtos e serviços" subtitle="Os preços oficiais ficam pendentes até a confirmação. O preço de demonstração é fictício e só aparece com os dados de demonstração ativos." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3 text-right">Preço oficial</th>
                <th className="px-4 py-3 text-right">Demonstração</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-4 py-3">{categoryLabel[c.category]}</td>
                  <td className="px-4 py-3">{c.unit}</td>
                  <td className="px-4 py-3 text-right">{v(c.basePrice)}</td>
                  <td className="px-4 py-3 text-right text-muted">{v(c.demoPrice)}</td>
                  <td className="px-4 py-3"><Badge tone={c.active ? 'ok' : 'neutral'}>{c.active ? 'Ativo' : 'Inativo'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Regras comerciais" subtitle="Cada regra é independente. A coluna de demonstração é fictícia." />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-2">Regra</th><th className="px-4 py-2 text-right">Oficial</th><th className="px-4 py-2 text-right">Demo</th></tr>
              </thead>
              <tbody>
                {ruleRows.map(([k, o, d, f]) => (
                  <tr key={k} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">{k}</td>
                    <td className="px-4 py-2 text-right">{v(o, f)}</td>
                    <td className="px-4 py-2 text-right text-muted">{v(d, f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Formas de pagamento" subtitle="Habilite apenas as modalidades aceitas pela Qualimix." />
            <ul className="flex flex-wrap gap-2 p-5">
              {paymentMethods.map((m) => (
                <li key={m.id}><Badge tone={m.enabledOfficial ? 'ok' : 'warn'}>{m.label}: {m.enabledOfficial === null ? 'a confirmar' : m.enabledOfficial ? 'aceita' : 'não aceita'}</Badge></li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Cadastros de apoio" />
            <div className="space-y-3 p-5 text-sm">
              <p><strong>Origens de lead:</strong> {leadSources.join(', ')}</p>
              <p><strong>Regiões atendidas:</strong> {regions.join(', ')}</p>
              <p><strong>Etapas do funil:</strong> {funnelStages.map((s) => s.label).join(' → ')}</p>
              <p><strong>Numeração de orçamentos:</strong> ORC-AAAA-NNNN, sequencial e única</p>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Usuários e permissões" subtitle="Perfis previstos. As permissões serão aplicadas no servidor e no banco de dados, não apenas na interface." action={<Lock className="h-5 w-5 text-brand" />} />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {permissions.map(([role, items]) => (
            <div key={role} className="rounded-md border border-line p-3">
              <p className="font-display text-lg font-bold uppercase">{role}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted">
                {items.map((i) => <li key={i}>• {i}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
