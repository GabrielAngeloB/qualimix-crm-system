import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ClipboardList, CalendarDays, Wallet, Plus, Pencil, Save, X, XCircle } from 'lucide-react'
import { useStore } from '../data/store'
import { today } from '../lib/clock'
import { brlCents, dateBR, parseDecimal } from '../lib/format'
import { Badge, Button, Card, EmptyState, Field, PageHeader, cx, inputCls } from '../components/ui'

export const Route = createFileRoute('/pedidos')({
  head: () => ({
    meta: [
      { title: 'Pedidos — Qualimix CRM' },
      { name: 'description', content: 'Converta orçamentos aceitos em pedidos operacionais e financeiros.' },
    ],
  }),
  component: Pedidos,
})

function Pedidos() {
  const { quotes, clients, sites, workOrders, createWorkOrderFromQuote, updateWorkOrderAmount, cancelWorkOrder, jobBalance, toast, currentRole, views } = useStore()
  const canCreateOrder = currentRole === 'administrador' || currentRole === 'comercial'
  const canEditOrderAmount = currentRole === 'administrador' || currentRole === 'comercial'
  const canViewOrderCosts = ['admin', 'administrador', 'operacao', 'financeiro', 'consulta'].includes(currentRole)
  const [dueDates, setDueDates] = useState<Record<string, string>>({})
  const [methods, setMethods] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [amountDraft, setAmountDraft] = useState('')

  const orderSummaryById = useMemo(() => new Map(views.orders.map((row) => [String(row.id), row])), [views.orders])
  const accepted = useMemo(
    () => quotes.filter((quote) => !quote.demo && quote.status === 'Aceito' && !workOrders.some((order) => order.quoteId === quote.id)),
    [quotes, workOrders],
  )

  const startEditAmount = (orderId: string, amountCents: number) => {
    setEditingOrderId(orderId)
    setAmountDraft((amountCents / 100).toFixed(2).replace('.', ','))
  }

  const saveOrderAmount = async (orderId: string) => {
    const parsed = parseDecimal(amountDraft)
    if (!parsed.ok || parsed.value === null || parsed.value <= 0) {
      toast({ tone: 'erro', title: 'Valor contratado inválido', body: 'Informe um valor maior que zero.' })
      return
    }
    try {
      await updateWorkOrderAmount(orderId, Math.round(parsed.value * 100))
      toast({ tone: 'ok', title: 'Valor da obra atualizado', body: 'O contrato, a conta a receber vinculada e o saldo da obra foram atualizados.' })
      setEditingOrderId(null)
      setAmountDraft('')
    } catch (error) {
      toast({ tone: 'erro', title: 'Não foi possível atualizar o valor', body: error instanceof Error ? error.message : 'Revise o financeiro do pedido.' })
    }
  }

  const cancelOrder = async (orderId: string, orderNumber: string) => {
    const reason = window.prompt(`Informe o motivo do cancelamento do pedido ${orderNumber}:`)
    if (reason === null) return
    if (reason.trim().length < 5) {
      toast({ tone: 'erro', title: 'Motivo obrigatório', body: 'Descreva o motivo com pelo menos 5 caracteres.' })
      return
    }
    if (!window.confirm('Confirmar cancelamento? O recebível sem pagamentos será cancelado e as programações pendentes serão marcadas como canceladas.')) return
    try {
      await cancelWorkOrder(orderId, reason.trim())
      toast({ tone: 'info', title: 'Pedido cancelado', body: orderNumber + ' · histórico preservado.' })
    } catch (error) {
      toast({ tone: 'erro', title: 'Não foi possível cancelar o pedido', body: error instanceof Error ? error.message : 'Revise o financeiro e a situação operacional.' })
    }
  }

  const createOrder = async (quoteId: string) => {
    setBusy(quoteId)
    try {
      const order = await createWorkOrderFromQuote(quoteId, dueDates[quoteId] ?? '', methods[quoteId] ?? '')
      toast({ tone: 'ok', title: 'Pedido criado', body: `${order.number} vinculado ao orçamento e à conta a receber.` })
    } catch (error) {
      toast({ tone: 'erro', title: 'Não foi possível converter', body: error instanceof Error ? error.message : 'Revise os dados.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Pedidos"
        description="Cada pedido nasce de um orçamento real aceito. A conversão cria o vínculo operacional e a primeira conta a receber, sem duplicar o mesmo orçamento."
        actions={
          <>
            <Link to="/agenda" className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-4 font-semibold hover:bg-surface-2"><CalendarDays className="h-4 w-4" /> Agenda</Link>
            <Link to="/financeiro" className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-4 font-semibold hover:bg-surface-2"><Wallet className="h-4 w-4" /> Financeiro</Link>
          </>
        }
      />

      {canCreateOrder && <Card className="mb-6">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-xl font-bold uppercase">Orçamentos aceitos aguardando pedido</h2>
          <p className="text-sm text-muted">Confirme o vencimento e a forma de pagamento antes da conversão.</p>
        </div>
        {accepted.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Nenhum orçamento pronto para conversão">
            Registre um orçamento real, atualize seu status para “Aceito” e ele aparecerá aqui. Orçamentos de demonstração não geram pedidos reais.
            <div className="mt-3"><Link to="/orcamentos" className="font-semibold text-brand hover:underline">Abrir orçamentos</Link></div>
          </EmptyState>
        ) : (
          <div className="divide-y divide-line">
            {accepted.map((quote) => (
              <div key={quote.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_180px_220px_auto] lg:items-end">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="font-display text-xl">{quote.number}</strong>
                    <Badge tone="ok">Aceito</Badge>
                  </div>
                  <p className="truncate font-semibold">{clients.find((client) => client.id === quote.clientId)?.name ?? 'Cliente não localizado'}</p>
                  <p className="truncate text-sm text-muted">{sites.find((site) => site.id === quote.siteId)?.name ?? 'Obra não localizada'} · {brlCents(quote.result.totalCents)}</p>
                </div>
                <Field label="Vencimento inicial" required>
                  {(id) => <input id={id} type="date" className={inputCls()} min={today} value={dueDates[quote.id] ?? ''} onChange={(event) => setDueDates((current) => ({ ...current, [quote.id]: event.target.value }))} />}
                </Field>
                <Field label="Forma de pagamento" required>
                  {(id) => <input id={id} className={inputCls()} placeholder="Ex.: Pix, boleto, faturado" value={methods[quote.id] ?? ''} onChange={(event) => setMethods((current) => ({ ...current, [quote.id]: event.target.value }))} />}
                </Field>
                <Button variant="primary" disabled={busy === quote.id || !dueDates[quote.id] || !methods[quote.id]?.trim()} onClick={() => void createOrder(quote.id)}>
                  <Plus className="h-4 w-4" /> Converter em pedido
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>}

      <Card>
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-xl font-bold uppercase">Pedidos registrados</h2>
          <p className="text-sm text-muted">Valor contratado menos despesas vinculadas à obra.</p>
        </div>
        {workOrders.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Nenhum pedido registrado">
            Os pedidos serão exibidos aqui depois da conversão de um orçamento aceito.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Cliente / obra</th>
                  <th className="px-4 py-3 text-right">Contratado</th>
                  {canViewOrderCosts && <th className="px-4 py-3 text-right">Custos</th>}
                  {canViewOrderCosts && <th className="px-4 py-3 text-right">Saldo da obra</th>}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Origem</th>
                  {canEditOrderAmount && <th className="px-4 py-3 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {workOrders.map((order) => {
                  const client = clients.find((item) => item.id === order.clientId)
                  const site = sites.find((item) => item.id === order.siteId)
                  const summary = orderSummaryById.get(order.id)
                  const balance = summary
                    ? Number(summary.saldo_obra_centavos ?? order.contractedCents)
                    : jobBalance(order.id) ?? order.contractedCents
                  const costCents = summary
                    ? Number(summary.total_custos_centavos ?? 0)
                    : order.contractedCents - balance
                  return (
                    <tr key={order.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <strong className="font-display text-lg">{order.number}</strong>
                        <span className="block text-xs text-muted">{dateBR(order.createdAt.slice(0, 10))}</span>
                      </td>
                      <td className="px-4 py-3">
                        <strong className="block">{client?.name ?? '—'}</strong>
                        <span className="text-xs text-muted">{site?.name ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular">
                        {editingOrderId === order.id ? (
                          <div className="flex min-w-[190px] items-center justify-end gap-1">
                            <span className="text-muted">R$</span>
                            <input
                              aria-label={`Novo valor contratado de ${order.number}`}
                              inputMode="decimal"
                              className={cx(inputCls(), 'h-9 w-28 text-right')}
                              value={amountDraft}
                              onChange={(event) => setAmountDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') void saveOrderAmount(order.id)
                                if (event.key === 'Escape') setEditingOrderId(null)
                              }}
                            />
                            <Button size="sm" variant="primary" className="h-8 w-8 px-0" aria-label="Salvar valor" onClick={() => void saveOrderAmount(order.id)}><Save className="h-4 w-4" /></Button>
                            <Button size="sm" className="h-8 w-8 px-0" aria-label="Cancelar edição" onClick={() => setEditingOrderId(null)}><X className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <strong>{brlCents(order.contractedCents)}</strong>
                            {canEditOrderAmount && order.status !== 'Cancelada' && (
                              <button type="button" aria-label={`Editar valor de ${order.number}`} title="Editar valor contratado" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink" onClick={() => startEditAmount(order.id, order.contractedCents)}>
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                        {order.valueHistory && order.valueHistory.length > 0 && <span className="block text-xs text-muted">{order.valueHistory.length} alteração(ões) de valor</span>}
                      </td>
                      {canViewOrderCosts && <td className="px-4 py-3 text-right tabular">{brlCents(costCents)}</td>}
                      {canViewOrderCosts && <td className={cx('px-4 py-3 text-right font-semibold tabular', balance < 0 && 'text-brand')}>{brlCents(balance)}</td>}
                      <td className="px-4 py-3"><Badge>{order.status}</Badge>{order.cancellationReason && <span className="mt-1 block max-w-[220px] text-xs text-muted" title={order.cancellationReason}>Motivo: {order.cancellationReason}</span>}</td>
                      <td className="px-4 py-3"><Link to="/orcamentos" className="text-brand hover:underline">{order.quoteId}</Link></td>
                      {canEditOrderAmount && <td className="px-4 py-3 text-right">{order.status !== 'Cancelada' && <Button size="sm" variant="danger" onClick={() => void cancelOrder(order.id, order.number)}><XCircle className="h-4 w-4" /> Cancelar pedido</Button>}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
