import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Wallet, Plus, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { useStore } from '../data/store'
import {
  calculateUnitCostCents,
  financialStatus,
  openAmountCents,
  type ExpenseCategory,
  type FinancialEntry,
  type FinancialKind,
  type FinancialPayment,
} from '../data/operations'
import { today } from '../lib/clock'
import { brlCents, dateBR, parseDecimal } from '../lib/format'
import { Badge, Button, Card, EmptyState, Field, PageHeader, cx, inputCls } from '../components/ui'

export const Route = createFileRoute('/financeiro')({
  head: () => ({
    meta: [
      { title: 'Financeiro — Qualimix CRM' },
      { name: 'description', content: 'Contas a pagar e receber, despesas por obra e registro auditável de pagamentos.' },
    ],
  }),
  component: Financeiro,
})

const categories: ExpenseCategory[] = ['Mão de obra', 'Material', 'Equipamento', 'Frete', 'Bombeamento', 'Combustível', 'Terceirizado', 'Outros']

const blankExpense = {
  workOrderId: '',
  professionalId: '',
  category: 'Mão de obra' as ExpenseCategory,
  description: '',
  unitRate: '',
  quantity: '1',
  amount: '',
  incurredAt: today,
  dueDate: today,
  method: '',
}

function Financeiro() {
  const {
    financialEntries,
    workOrders,
    clients,
    sites,
    professionals,
    expenses,
    addExpense,
    registerPayment,
    cancelFinancialEntry,
    jobBalance,
    toast,
    currentRole,
    views,
  } = useStore()
  const canEditFinance = currentRole === 'administrador' || currentRole === 'financeiro'
  const [kind, setKind] = useState<'todos' | FinancialKind>('todos')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [expense, setExpense] = useState(blankExpense)
  const [showExpense, setShowExpense] = useState(false)
  const [paymentFor, setPaymentFor] = useState<string | null>(null)
  const [payment, setPayment] = useState({ amount: '', paidAt: today, method: '', note: '' })

  const financeSummaryById = useMemo(() => new Map(views.finance.map((row) => [String(row.id), row])), [views.finance])
  const entries = useMemo(() => financialEntries
    .map((entry) => ({
      ...entry,
      status: financeSummaryById.get(entry.id)?.status_calculado ?? financialStatus(
        entry.amountCents,
        entry.payments.reduce((sum, item) => sum + item.amountCents, 0),
        entry.dueDate,
        today,
        entry.status === 'Cancelado',
      ),
    }))
    .filter((entry) => (kind === 'todos' || entry.kind === kind) && (statusFilter === 'todos' || entry.status === statusFilter))
    .sort((a, b) => (a.dueDate + a.createdAt).localeCompare(b.dueDate + b.createdAt)), [financialEntries, financeSummaryById, kind, statusFilter])

  const receivables = financialEntries.filter((entry) => entry.kind === 'receber')
  const payables = financialEntries.filter((entry) => entry.kind === 'pagar')
  const activeReceivables = receivables.filter((entry) => entry.status !== 'Cancelado')
  const activePayables = payables.filter((entry) => entry.status !== 'Cancelado')
  // Os totais e saldos vêm da view; os lançamentos base continuam carregando o histórico de baixas.
  const hasFinanceView = views.finance.length > 0 || financialEntries.length === 0
  const receivedCents = hasFinanceView
    ? views.finance.filter((row) => row.tipo === 'receber').reduce((sum, row) => sum + Number(row.total_pago_centavos ?? 0), 0)
    : receivables.reduce((sum, entry) => sum + entry.payments.reduce((paid, item) => paid + item.amountCents, 0), 0)
  const payablePaidCents = hasFinanceView
    ? views.finance.filter((row) => row.tipo === 'pagar').reduce((sum, row) => sum + Number(row.total_pago_centavos ?? 0), 0)
    : payables.reduce((sum, entry) => sum + entry.payments.reduce((paid, item) => paid + item.amountCents, 0), 0)
  const receivableOpenCents = hasFinanceView
    ? views.finance.filter((row) => row.tipo === 'receber' && row.status_calculado !== 'Cancelado').reduce((sum, row) => sum + Number(row.saldo_centavos ?? 0), 0)
    : activeReceivables.reduce((sum, entry) => sum + openAmountCents(entry), 0)
  const payableOpenCents = hasFinanceView
    ? views.finance.filter((row) => row.tipo === 'pagar' && row.status_calculado !== 'Cancelado').reduce((sum, row) => sum + Number(row.saldo_centavos ?? 0), 0)
    : activePayables.reduce((sum, entry) => sum + openAmountCents(entry), 0)
  const overdueCents = hasFinanceView
    ? views.finance.filter((row) => row.status_calculado === 'Vencido').reduce((sum, row) => sum + Number(row.saldo_centavos ?? 0), 0)
    : [...activeReceivables, ...activePayables].filter((entry) => entry.dueDate < today && openAmountCents(entry) > 0).reduce((sum, entry) => sum + openAmountCents(entry), 0)

  const submitExpense = async () => {
    const parsed = parseDecimal(expense.amount)
    const rate = parseDecimal(expense.unitRate)
    const quantity = parseDecimal(expense.quantity)
    const selectedProfessional = professionals.find((item) => item.id === expense.professionalId)
    if (!parsed.ok || parsed.value === null || parsed.value <= 0) {
      toast({ tone: 'erro', title: 'Valor inválido', body: 'Informe uma despesa maior que zero.' })
      return
    }
    if (selectedProfessional && (!rate.ok || rate.value === null || rate.value <= 0 || !quantity.ok || quantity.value === null || quantity.value <= 0)) {
      toast({ tone: 'erro', title: 'Custo de mão de obra inválido', body: 'Informe a tarifa unitária e a quantidade para calcular o custo do serviço.' })
      return
    }
    const unitRateCents = selectedProfessional && rate.ok && rate.value !== null ? Math.round(rate.value * 100) : null
    const quantityValue = selectedProfessional && quantity.ok && quantity.value !== null ? quantity.value : null
    const calculatedLaborCents = selectedProfessional && unitRateCents !== null && quantityValue !== null
      ? calculateUnitCostCents(unitRateCents, quantityValue)
      : null
    if (selectedProfessional && calculatedLaborCents !== Math.round(parsed.value * 100)) {
      toast({ tone: 'erro', title: 'Total divergente', body: 'O total da mão de obra deve ser igual à tarifa unitária multiplicada pela quantidade.' })
      return
    }
    const record = {
      id: `desp-${crypto.randomUUID()}`,
      workOrderId: expense.workOrderId,
      professionalId: expense.professionalId || null,
      category: expense.category,
      description: expense.description.trim(),
      amountCents: Math.round(parsed.value * 100),
      unitRateCents,
      quantity: quantityValue,
      rateUnit: selectedProfessional?.rateUnit ?? null,
      incurredAt: expense.incurredAt,
      createdAt: new Date().toISOString(),
      demo: false as const,
    }
    try {
      await addExpense(record, expense.dueDate, expense.method)
      toast({ tone: 'ok', title: 'Despesa registrada', body: 'A despesa foi vinculada à obra e gerou uma conta a pagar.' })
      setExpense(blankExpense)
      setShowExpense(false)
    } catch (error) {
      toast({ tone: 'erro', title: 'Não foi possível registrar a despesa', body: error instanceof Error ? error.message : 'Revise os dados.' })
    }
  }

  const openPayment = (entry: FinancialEntry) => {
    setPaymentFor(entry.id)
    setPayment({ amount: '', paidAt: today, method: entry.method, note: '' })
  }

  const submitPayment = async (entry: FinancialEntry) => {
    const parsed = parseDecimal(payment.amount)
    if (!parsed.ok || parsed.value === null || parsed.value <= 0) {
      toast({ tone: 'erro', title: 'Valor de baixa inválido', body: 'Informe um pagamento maior que zero.' })
      return
    }
    const item: FinancialPayment = {
      id: `pag-${crypto.randomUUID()}`,
      paidAt: payment.paidAt,
      amountCents: Math.round(parsed.value * 100),
      method: payment.method.trim(),
      note: payment.note.trim(),
    }
    try {
      await registerPayment(entry.id, item)
      toast({ tone: 'ok', title: 'Baixa financeira registrada', body: `${entry.description} · ${brlCents(item.amountCents)}` })
      setPaymentFor(null)
    } catch (error) {
      toast({ tone: 'erro', title: 'Não foi possível registrar a baixa', body: error instanceof Error ? error.message : 'Revise os dados.' })
    }
  }

  const linkedOrder = (entry: FinancialEntry) => workOrders.find((order) => order.id === entry.workOrderId)
  const badgeTone = (status: string) => status === 'Pago' ? 'ok' as const : status === 'Vencido' ? 'red' as const : status === 'Parcial' ? 'warn' as const : 'neutral' as const

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Contas a pagar e receber"
        description="Vencimentos, baixas totais ou parciais, vínculo com obras e profissionais. Pix/boleto informado não representa pagamento sem uma baixa registrada."
        actions={canEditFinance ? <Button variant="primary" onClick={() => setShowExpense((value) => !value)}><Plus className="h-4 w-4" /> Lançar despesa</Button> : undefined}
      />

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="A receber" value={brlCents(receivableOpenCents)} sub="Saldo em aberto" />
        <Kpi label="Recebido" value={brlCents(receivedCents)} sub="Baixas confirmadas" />
        <Kpi label="A pagar" value={brlCents(payableOpenCents)} sub="Saldo em aberto" />
        <Kpi label="Pago a fornecedores" value={brlCents(payablePaidCents)} sub="Baixas confirmadas" />
        <Kpi label="Vencido" value={brlCents(overdueCents)} sub="Pagar + receber" danger={overdueCents > 0} />
      </dl>

      {canEditFinance && showExpense && (
        <Card className="mb-6">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-xl font-bold uppercase">Nova despesa da obra</h2>
            <p className="text-sm text-muted">Cada despesa aumenta o custo da obra e cria automaticamente a obrigação em contas a pagar.</p>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Pedido / obra" required className="md:col-span-2 lg:col-span-3">
              {(id) => <select id={id} className={inputCls()} value={expense.workOrderId} onChange={(event) => setExpense((current) => ({ ...current, workOrderId: event.target.value }))}>
                <option value="">Selecione o pedido…</option>
                {workOrders.filter((order) => order.status !== 'Cancelada').map((order) => <option key={order.id} value={order.id}>{order.number} · {clients.find((client) => client.id === order.clientId)?.name ?? 'Cliente'} · {sites.find((site) => site.id === order.siteId)?.name ?? 'Obra'}</option>)}
              </select>}
            </Field>
            <Field label="Categoria">
              {(id) => <select id={id} disabled={!!expense.professionalId} className={inputCls()} value={expense.category} onChange={(event) => setExpense((current) => ({ ...current, category: event.target.value as ExpenseCategory }))}>{categories.map((category) => <option key={category}>{category}</option>)}</select>}
            </Field>
            <Field label="Profissional (opcional)">
              {(id) => <select id={id} className={inputCls()} value={expense.professionalId} onChange={(event) => {
                const professional = professionals.find((item) => item.id === event.target.value)
                const unitRate = professional ? (professional.rateCents / 100).toFixed(2).replace('.', ',') : ''
                setExpense((current) => ({
                  ...current,
                  professionalId: event.target.value,
                  category: professional ? 'Mão de obra' : current.category,
                  description: professional ? (current.description || professional.serviceType) : current.description,
                  unitRate,
                  quantity: professional ? '1' : '',
                  amount: professional ? unitRate : current.amount,
                  method: professional ? professional.paymentMethod : current.method,
                }))
              }}>
                <option value="">Não vincular</option>
                {professionals.filter((professional) => professional.active).map((professional) => <option key={professional.id} value={professional.id}>{professional.name} · {professional.serviceType} · {brlCents(professional.rateCents)}/{professional.rateUnit}</option>)}
              </select>}
            </Field>
            <Field label="Descrição" required>
              {(id) => <input id={id} className={inputCls()} value={expense.description} onChange={(event) => setExpense((current) => ({ ...current, description: event.target.value }))} />}
            </Field>
            {expense.professionalId && (
              <>
                <Field label="Tarifa por unidade (R$)" required>
                  {(id) => <input id={id} inputMode="decimal" className={inputCls()} value={expense.unitRate} onChange={(event) => {
                    const nextRate = event.target.value
                    setExpense((current) => {
                      const rateValue = parseDecimal(nextRate)
                      const quantityValue = parseDecimal(current.quantity)
                      const totalCents = rateValue.ok && rateValue.value !== null && quantityValue.ok && quantityValue.value !== null
                        ? calculateUnitCostCents(Math.round(rateValue.value * 100), quantityValue.value)
                        : null
                      return {
                        ...current,
                        unitRate: nextRate,
                        amount: totalCents === null ? current.amount : (totalCents / 100).toFixed(2).replace('.', ','),
                      }
                    })
                  }} />}
                </Field>
                <Field label={`Quantidade (${professionals.find((item) => item.id === expense.professionalId)?.rateUnit ?? 'unidade'})`} required>
                  {(id) => <input id={id} type="number" min="0.01" step="0.01" className={inputCls()} value={expense.quantity} onChange={(event) => {
                    const nextQuantity = event.target.value
                    setExpense((current) => {
                      const rateValue = parseDecimal(current.unitRate)
                      const quantityValue = parseDecimal(nextQuantity)
                      const totalCents = rateValue.ok && rateValue.value !== null && quantityValue.ok && quantityValue.value !== null
                        ? calculateUnitCostCents(Math.round(rateValue.value * 100), quantityValue.value)
                        : null
                      return {
                        ...current,
                        quantity: nextQuantity,
                        amount: totalCents === null ? current.amount : (totalCents / 100).toFixed(2).replace('.', ','),
                      }
                    })
                  }} />}
                </Field>
              </>
            )}
            <Field label={expense.professionalId ? 'Total da mão de obra (R$)' : 'Valor (R$)'} required>
              {(id) => <input id={id} inputMode="decimal" className={inputCls()} placeholder="0,00" value={expense.amount} onChange={(event) => setExpense((current) => ({ ...current, amount: event.target.value }))} />}
            </Field>
            <Field label="Data da despesa" required>
              {(id) => <input id={id} type="date" className={inputCls()} value={expense.incurredAt} onChange={(event) => setExpense((current) => ({ ...current, incurredAt: event.target.value }))} />}
            </Field>
            <Field label="Vencimento" required>
              {(id) => <input id={id} type="date" className={inputCls()} value={expense.dueDate} onChange={(event) => setExpense((current) => ({ ...current, dueDate: event.target.value }))} />}
            </Field>
            <Field label="Forma de pagamento" required>
              {(id) => <input id={id} className={inputCls()} placeholder="Pix, boleto, transferência…" value={expense.method} onChange={(event) => setExpense((current) => ({ ...current, method: event.target.value }))} />}
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <Button onClick={() => setShowExpense(false)}>Cancelar</Button>
            <Button variant="primary" disabled={!expense.workOrderId || !expense.description.trim() || !expense.amount || !expense.dueDate || !expense.incurredAt || !expense.method.trim()} onClick={submitExpense}>Salvar despesa e conta a pagar</Button>
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div><h2 className="text-xl font-bold uppercase">Lançamentos financeiros</h2><p className="text-sm text-muted">As baixas são registradas com data, valor e forma de pagamento.</p></div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Tipo de lançamento" className={cx(inputCls(), 'w-auto')} value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
              <option value="todos">Pagar e receber</option><option value="receber">A receber</option><option value="pagar">A pagar</option>
            </select>
            <select aria-label="Status financeiro" className={cx(inputCls(), 'w-auto')} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="todos">Todos os status</option><option value="Em aberto">Em aberto</option><option value="Parcial">Parcial</option><option value="Vencido">Vencido</option><option value="Pago">Pago</option><option value="Cancelado">Cancelado</option>
            </select>
          </div>
        </div>
        {entries.length === 0 ? (
          <EmptyState icon={<Wallet className="h-6 w-6" />} title="Nenhum lançamento encontrado">
            Contas a receber são geradas pela conversão de orçamento aceito em pedido. Contas a pagar são geradas ao registrar despesas de uma obra.
            <div className="mt-3 flex justify-center gap-3"><Link to="/pedidos" className="font-semibold text-brand hover:underline">Abrir pedidos</Link><Link to="/profissionais" className="font-semibold text-brand hover:underline">Ver profissionais</Link></div>
          </EmptyState>
        ) : (
          <div className="divide-y divide-line">
            {entries.map((entry) => {
              const order = linkedOrder(entry)
              const client = clients.find((item) => item.id === entry.clientId)
              const professional = professionals.find((item) => item.id === entry.professionalId)
              const orderClient = order ? clients.find((item) => item.id === order.clientId) : undefined
              const orderSite = order ? sites.find((item) => item.id === order.siteId) : undefined
              const financeSummary = financeSummaryById.get(entry.id)
              const openCents = entry.status === 'Cancelado' ? 0 : financeSummary
                ? Number(financeSummary.saldo_centavos ?? 0)
                : openAmountCents(entry)
              const isPaymentOpen = paymentFor === entry.id
              return (
                <article key={entry.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className={cx('mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-md', entry.kind === 'receber' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')}>
                      {entry.kind === 'receber' ? <ArrowDownToLine className="h-5 w-5" /> : <ArrowUpFromLine className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{entry.description}</h3><Badge tone={badgeTone(entry.status)}>{entry.status}</Badge><Badge>{entry.kind === 'receber' ? 'A receber' : 'A pagar'}</Badge></div>
                      <p className="text-sm text-muted">
                        {professional?.name ?? client?.name ?? (order ? 'Despesa vinculada à obra' : 'Sem contraparte')}{order ? ` · ${order.number} · ${orderSite?.name ?? 'Obra'} · Cliente: ${orderClient?.name ?? '—'}` : ''} · Emissão {dateBR(entry.issuedAt)} · Vencimento {dateBR(entry.dueDate)}
                      </p>
                      <p className="text-xs text-muted">{entry.method}{entry.quoteId ? ` · Orçamento ${entry.quoteId}` : ''}{professional ? ` · Profissional: ${professional.name}` : ''}</p>
                    </div>
                    <div className="min-w-[150px] text-right">
                      <p className="font-display text-xl font-bold tabular">{brlCents(entry.amountCents)}</p>
                      <p className="text-xs text-muted">Saldo: <strong className="tabular">{brlCents(openCents)}</strong></p>
                    </div>
                  </div>

                  {entry.payments.length > 0 && (
                    <div className="ml-12 mt-3 rounded-md bg-surface-2 p-3">
                      <p className="mb-1 text-xs font-bold uppercase text-muted">Histórico de baixas</p>
                      <ul className="space-y-1 text-sm">
                        {entry.payments.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2"><span>{dateBR(item.paidAt)} · {item.method}{item.note ? ` · ${item.note}` : ''}</span><strong className="tabular">{brlCents(item.amountCents)}</strong></li>)}
                      </ul>
                    </div>
                  )}

                  {isPaymentOpen && openCents > 0 && (
                    <div className="ml-12 mt-3 grid gap-3 rounded-md border border-line p-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label="Valor da baixa (R$)" required>{(id) => <input id={id} inputMode="decimal" className={inputCls()} value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} />}</Field>
                      <Field label="Data do pagamento" required>{(id) => <input id={id} type="date" className={inputCls()} value={payment.paidAt} onChange={(event) => setPayment((current) => ({ ...current, paidAt: event.target.value }))} />}</Field>
                      <Field label="Forma de pagamento" required>{(id) => <input id={id} className={inputCls()} value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value }))} />}</Field>
                      <Field label="Observação">{(id) => <input id={id} className={inputCls()} value={payment.note} onChange={(event) => setPayment((current) => ({ ...current, note: event.target.value }))} />}</Field>
                      <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-4">
                        <Button size="sm" onClick={() => setPaymentFor(null)}>Cancelar</Button>
                        <Button size="sm" variant="primary" disabled={!payment.amount || !payment.paidAt || !payment.method.trim()} onClick={() => void submitPayment(entry)}>Confirmar baixa</Button>
                      </div>
                    </div>
                  )}

                  <div className="ml-12 mt-3 flex flex-wrap gap-2">
                    {canEditFinance && openCents > 0 && entry.status !== 'Cancelado' && <Button size="sm" onClick={() => isPaymentOpen ? setPaymentFor(null) : openPayment(entry)}>{isPaymentOpen ? 'Fechar baixa' : 'Registrar baixa'}</Button>}
                    {canEditFinance && entry.status !== 'Cancelado' && openCents > 0 && <Button size="sm" variant="danger" onClick={() => { if (confirm('Cancelar este lançamento? A ação não apaga o histórico de pagamentos.')) { void cancelFinancialEntry(entry.id).then(() => toast({ tone: 'info', title: 'Lançamento cancelado', body: entry.description })).catch((error) => toast({ tone: 'erro', title: 'Não foi possível cancelar', body: error instanceof Error ? error.message : 'Revise o lançamento.' })) } }}>Cancelar lançamento</Button>}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </Card>

      <Card>
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-xl font-bold uppercase">Custos por obra</h2>
          <p className="text-sm text-muted">Valor contratado menos despesas lançadas. Contas a pagar e custos são mostrados separadamente para não confundir competência com caixa.</p>
        </div>
        {workOrders.length === 0 ? (
          <EmptyState icon={<Wallet className="h-6 w-6" />} title="Ainda não há obras contratadas">Converta um orçamento aceito em pedido para iniciar o controle de custos.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs text-muted"><tr><th className="px-4 py-3">Pedido / obra</th><th className="px-4 py-3 text-right">Contratado</th><th className="px-4 py-3 text-right">Despesas</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3">Despesas vinculadas</th></tr></thead>
              <tbody>
                {workOrders.map((order) => {
                  const linkedExpenses = expenses.filter((item) => item.workOrderId === order.id)
                  const totalCosts = linkedExpenses.reduce((sum, item) => sum + item.amountCents, 0)
                  return <tr key={order.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3"><strong>{order.number}</strong><span className="block text-xs text-muted">{sites.find((site) => site.id === order.siteId)?.name ?? 'Obra'} · {clients.find((client) => client.id === order.clientId)?.name ?? 'Cliente'}</span></td>
                    <td className="px-4 py-3 text-right tabular">{brlCents(order.contractedCents)}</td>
                    <td className="px-4 py-3 text-right tabular">{brlCents(totalCosts)}</td>
                    <td className={cx('px-4 py-3 text-right font-semibold tabular', (jobBalance(order.id) ?? 0) < 0 && 'text-brand')}>{brlCents(jobBalance(order.id) ?? order.contractedCents)}</td>
                    <td className="px-4 py-3">
                      {linkedExpenses.length} lançamento(s)
                      <span className="block text-xs text-muted">{[...new Set(linkedExpenses.map((item) => item.category))].join(', ') || 'Sem despesas'}</span>
                      {linkedExpenses.filter((item) => item.professionalId).map((item) => (
                        <span key={item.id} className="mt-1 block text-xs text-muted">
                          {professionals.find((professional) => professional.id === item.professionalId)?.name ?? 'Profissional'}: {item.quantity ?? '—'} {item.rateUnit ?? 'un.'} × {brlCents(item.unitRateCents ?? null)}
                        </span>
                      ))}
                    </td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

function Kpi({ label, value, sub, danger }: { label: string; value: string; sub: string; danger?: boolean }) {
  return <div className={cx('min-w-0 rounded-lg border bg-surface p-4', danger && 'border-brand/40')}><dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt><dd className={cx('mt-1 truncate font-display text-2xl font-extrabold tabular', danger && 'text-brand')}>{value}</dd><dd className="mt-0.5 text-xs text-muted">{sub}</dd></div>
}
