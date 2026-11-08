import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Users, Plus, Wallet } from 'lucide-react'
import { useStore } from '../data/store'
import type { Professional, ProfessionalRateUnit } from '../data/operations'
import { today } from '../lib/clock'
import { brlCents, dateBR, parseDecimal } from '../lib/format'
import { Badge, Button, Card, EmptyState, Field, PageHeader, cx, inputCls } from '../components/ui'

export const Route = createFileRoute('/profissionais')({
  head: () => ({
    meta: [
      { title: 'Profissionais — Qualimix CRM' },
      { name: 'description', content: 'Cadastro de profissionais, custos por serviço e histórico de pagamentos.' },
    ],
  }),
  component: Profissionais,
})

const units: ProfessionalRateUnit[] = ['serviço', 'hora', 'diária', 'm²', 'm³']

const blank = {
  name: '',
  document: '',
  phone: '',
  serviceType: '',
  rate: '',
  rateUnit: 'serviço' as ProfessionalRateUnit,
  paymentMethod: '',
  notes: '',
  active: true,
}

function Profissionais() {
  const { professionals, financialEntries, saveProfessional, toast, currentRole } = useStore()
  const canEditProfessionals = ['administrador', 'operacao', 'financeiro'].includes(currentRole)
  const [form, setForm] = useState(blank)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'ativos' | 'todos' | 'inativos'>('ativos')

  const rows = useMemo(
    () => professionals.filter((professional) => filter === 'todos' || (filter === 'ativos' ? professional.active : !professional.active)),
    [professionals, filter],
  )

  const edit = (professional: Professional) => {
    setEditingId(professional.id)
    setForm({
      name: professional.name,
      document: professional.document,
      phone: professional.phone,
      serviceType: professional.serviceType,
      rate: (professional.rateCents / 100).toFixed(2).replace('.', ','),
      rateUnit: professional.rateUnit,
      paymentMethod: professional.paymentMethod,
      notes: professional.notes,
      active: professional.active,
    })
  }

  const save = async () => {
    const parsed = parseDecimal(form.rate)
    if (!parsed.ok || parsed.value === null || parsed.value <= 0) {
      toast({ tone: 'erro', title: 'Custo inválido', body: 'Informe um custo padrão maior que zero.' })
      return
    }
    const professional: Professional = {
      id: editingId ?? `prof-${crypto.randomUUID()}`,
      name: form.name.trim(),
      document: form.document.replace(/\D/g, ''),
      phone: form.phone.trim(),
      serviceType: form.serviceType.trim(),
      rateCents: Math.round(parsed.value * 100),
      rateUnit: form.rateUnit,
      paymentMethod: form.paymentMethod.trim(),
      active: form.active,
      notes: form.notes.trim(),
      createdAt: editingId ? professionals.find((item) => item.id === editingId)?.createdAt ?? today : today,
      demo: false,
    }
    try {
      await saveProfessional(professional)
      toast({ tone: 'ok', title: editingId ? 'Profissional atualizado' : 'Profissional cadastrado', body: professional.name })
      setForm(blank)
      setEditingId(null)
    } catch (error) {
      toast({ tone: 'erro', title: 'Não foi possível salvar', body: error instanceof Error ? error.message : 'Revise os dados.' })
    }
  }

  const paymentHistory = (professionalId: string) =>
    financialEntries
      .filter((entry) => entry.kind === 'pagar' && entry.professionalId === professionalId)
      .flatMap((entry) => entry.payments.map((payment) => ({ ...payment, description: entry.description })))
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt))

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Profissionais"
        description="Cadastre equipes e prestadores, defina custo de referência por serviço e consulte pagamentos efetivamente baixados."
        actions={<Link to="/financeiro" className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-4 font-semibold hover:bg-surface-2"><Wallet className="h-4 w-4" /> Financeiro</Link>}
      />

      {canEditProfessionals && <Card className="mb-6">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-xl font-bold uppercase">{editingId ? 'Editar profissional' : 'Novo profissional'}</h2>
          <p className="text-sm text-muted">O custo de referência não cria despesas automaticamente. Cada pagamento precisa estar ligado a um custo/serviço registrado na obra.</p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome do profissional" required>
            {(id) => <input id={id} className={inputCls()} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />}
          </Field>
          <Field label="CPF/CNPJ (opcional)">
            {(id) => <input id={id} inputMode="numeric" className={inputCls()} value={form.document} onChange={(event) => setForm((current) => ({ ...current, document: event.target.value }))} />}
          </Field>
          <Field label="Telefone">
            {(id) => <input id={id} className={inputCls()} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />}
          </Field>
          <Field label="Serviço / especialidade" required>
            {(id) => <input id={id} className={inputCls()} placeholder="Ex.: lançamento, acabamento de piso" value={form.serviceType} onChange={(event) => setForm((current) => ({ ...current, serviceType: event.target.value }))} />}
          </Field>
          <Field label="Custo de referência (R$)" required>
            {(id) => <input id={id} inputMode="decimal" className={inputCls()} placeholder="0,00" value={form.rate} onChange={(event) => setForm((current) => ({ ...current, rate: event.target.value }))} />}
          </Field>
          <Field label="Unidade do custo">
            {(id) => <select id={id} className={inputCls()} value={form.rateUnit} onChange={(event) => setForm((current) => ({ ...current, rateUnit: event.target.value as ProfessionalRateUnit }))}>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>}
          </Field>
          <Field label="Forma de pagamento preferida">
            {(id) => <input id={id} className={inputCls()} placeholder="Pix, transferência, dinheiro…" value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))} />}
          </Field>
          <Field label="Observações" className="md:col-span-2">
            {(id) => <input id={id} className={inputCls()} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />}
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /> Profissional ativo</label>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          {editingId && <Button onClick={() => { setEditingId(null); setForm(blank) }}>Cancelar edição</Button>}
          <Button variant="primary" onClick={() => void save()}><Plus className="h-4 w-4" /> {editingId ? 'Salvar alterações' : 'Cadastrar profissional'}</Button>
        </div>
      </Card>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div><h2 className="text-xl font-bold uppercase">Equipe cadastrada</h2><p className="text-sm text-muted">{professionals.length} profissional(is) registrados.</p></div>
          <select aria-label="Filtrar profissionais" className={cx(inputCls(), 'w-auto')} value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="ativos">Ativos</option><option value="inativos">Inativos</option><option value="todos">Todos</option>
          </select>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="Nenhum profissional cadastrado">
            Cadastre prestadores e profissionais para vincular mão de obra e custos às obras.
          </EmptyState>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((professional) => {
              const entries = financialEntries.filter((entry) => entry.kind === 'pagar' && entry.professionalId === professional.id && entry.status !== 'Cancelado')
              const payments = paymentHistory(professional.id)
              const openCents = entries.reduce((sum, entry) => sum + Math.max(0, entry.amountCents - entry.payments.reduce((paid, payment) => paid + payment.amountCents, 0)), 0)
              return (
                <article key={professional.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{professional.name}</h3><Badge tone={professional.active ? 'ok' : 'neutral'}>{professional.active ? 'Ativo' : 'Inativo'}</Badge></div>
                      <p className="text-sm text-muted">{professional.serviceType} · {professional.document || 'Documento não informado'} · {professional.phone || 'Sem telefone'}</p>
                      <p className="mt-1 font-semibold tabular">{brlCents(professional.rateCents)} / {professional.rateUnit} <span className="font-normal text-muted">· pagamento preferido: {professional.paymentMethod || 'não informado'}</span></p>
                    </div>
                    {canEditProfessionals && <Button size="sm" onClick={() => edit(professional)}>Editar cadastro</Button>}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md bg-surface-2 p-3 text-sm"><p className="text-xs font-semibold uppercase text-muted">Em aberto a pagar</p><p className="font-display text-2xl font-bold tabular">{brlCents(openCents)}</p></div>
                    <div className="rounded-md bg-surface-2 p-3 text-sm"><p className="text-xs font-semibold uppercase text-muted">Pagamentos baixados</p><p className="font-display text-2xl font-bold tabular">{brlCents(payments.reduce((sum, payment) => sum + payment.amountCents, 0))}</p></div>
                  </div>
                  {payments.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-bold uppercase text-muted">Histórico de pagamentos</p>
                      <ul className="space-y-1 text-sm">
                        {payments.map((payment) => <li key={payment.id} className="flex flex-wrap justify-between gap-2"><span>{dateBR(payment.paidAt)} · {payment.method} · {payment.description}</span><strong className="tabular">{brlCents(payment.amountCents)}</strong></li>)}
                      </ul>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </Card>
    </>
  )
}
