import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { CalendarDays, Plus, ClipboardList } from 'lucide-react'
import { useStore } from '../data/store'
import { today } from '../lib/clock'
import type { ScheduleEvent, ScheduleStatus } from '../data/operations'
import { dateBR } from '../lib/format'
import { Button, Card, EmptyState, Field, PageHeader, cx, inputCls } from '../components/ui'

export const Route = createFileRoute('/agenda')({
  head: () => ({
    meta: [
      { title: 'Agenda operacional — Qualimix CRM' },
      { name: 'description', content: 'Programação e acompanhamento de concretagens e serviços vinculados aos pedidos.' },
    ],
  }),
  component: Agenda,
})

const statuses: ScheduleStatus[] = ['Planejada', 'Confirmada', 'Em preparação', 'Em execução', 'Concluída', 'Reagendada', 'Cancelada']

function Agenda() {
  const { workOrders, scheduleEvents, quotes, clients, sites, addScheduleEvent, toast, currentRole, views } = useStore()
  const canEditSchedule = currentRole === 'administrador' || currentRole === 'operacao'
  const [orderId, setOrderId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [dateEdits, setDateEdits] = useState<Record<string, string>>({})
  const [timeEdits, setTimeEdits] = useState<Record<string, string>>({})

  const scheduleSummaryById = useMemo(() => new Map(views.schedule.map((row) => [String(row.id), row])), [views.schedule])
  const plannedOrders = useMemo(() => workOrders.filter((order) => order.status !== 'Cancelada'), [workOrders])
  const sortedEvents = useMemo(() => [...scheduleEvents].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), [scheduleEvents])

  const saveSchedule = async () => {
    const order = workOrders.find((item) => item.id === orderId)
    const quote = order ? quotes.find((item) => item.id === order.quoteId) : undefined
    if (!order || !quote) {
      toast({ tone: 'erro', title: 'Pedido inválido', body: 'Selecione um pedido e confira o vínculo com o orçamento.' })
      return
    }
    const client = clients.find((item) => item.id === order.clientId)
    const site = sites.find((item) => item.id === order.siteId)
    const event: ScheduleEvent = {
      id: `ag-${crypto.randomUUID()}`,
      workOrderId: order.id,
      quoteId: order.quoteId,
      clientId: order.clientId,
      siteId: order.siteId,
      date,
      time,
      service: quote.type === 'concreto' ? 'Concreto usinado' : quote.type === 'piso' ? 'Execução de piso' : 'Concreto e piso',
      volumeM3: quote.result.concreteVolume,
      fck: quote.fck,
      pump: quote.extras.pumping.mode !== 'nao',
      status: 'Planejada',
      notes: [client?.name, site?.name, notes.trim()].filter(Boolean).join(' · '),
      demo: false,
    }
    try {
      await addScheduleEvent(event)
      toast({ tone: 'ok', title: 'Serviço agendado', body: `${dateBR(date)} às ${time}` })
      setOrderId('')
      setDate('')
      setTime('')
      setNotes('')
      setShowForm(false)
    } catch (error) {
      toast({ tone: 'erro', title: 'Não foi possível agendar', body: error instanceof Error ? error.message : 'Revise a programação.' })
    }
  }

  const saveReschedule = async (event: ScheduleEvent) => {
    const nextDate = dateEdits[event.id] ?? event.date
    const nextTime = timeEdits[event.id] ?? event.time
    try {
      await addScheduleEvent({ ...event, date: nextDate, time: nextTime, status: 'Reagendada' })
      toast({ tone: 'ok', title: 'Serviço reagendado', body: `${dateBR(nextDate)} às ${nextTime}` })
      setDateEdits((current) => ({ ...current, [event.id]: nextDate }))
      setTimeEdits((current) => ({ ...current, [event.id]: nextTime }))
    } catch (error) {
      toast({ tone: 'erro', title: 'Não foi possível reagendar', body: error instanceof Error ? error.message : 'Revise a data e o horário.' })
    }
  }

  const changeStatus = async (event: ScheduleEvent, status: ScheduleStatus) => {
    try {
      await addScheduleEvent({ ...event, status })
      toast({ tone: 'ok', title: 'Status operacional atualizado', body: `${dateBR(event.date)} · ${status}` })
    } catch (error) {
      toast({ tone: 'erro', title: 'Não foi possível atualizar', body: error instanceof Error ? error.message : 'Revise os dados.' })
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Agenda de serviços"
        description="Programação de concretagens e serviços com cliente, obra, orçamento, pedido, data, horário e status operacional."
        actions={
          <>
            <Link to="/pedidos" className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-4 font-semibold hover:bg-surface-2"><ClipboardList className="h-4 w-4" /> Pedidos</Link>
            {canEditSchedule && <Button variant="primary" onClick={() => setShowForm((value) => !value)}><Plus className="h-4 w-4" /> Agendar serviço</Button>}
          </>
        }
      />

      {canEditSchedule && showForm && (
        <Card className="mb-6">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-xl font-bold uppercase">Nova programação</h2>
            <p className="text-sm text-muted">A agenda sempre parte de um pedido existente para manter os vínculos comerciais e operacionais.</p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Pedido / obra" required className="sm:col-span-2 lg:col-span-3">
              {(id) => (
                <select id={id} className={inputCls()} value={orderId} onChange={(event) => setOrderId(event.target.value)}>
                  <option value="">Selecione um pedido…</option>
                  {plannedOrders.map((order) => {
                    const client = clients.find((item) => item.id === order.clientId)
                    const site = sites.find((item) => item.id === order.siteId)
                    return <option key={order.id} value={order.id}>{order.number} · {client?.name ?? 'Cliente'} · {site?.name ?? 'Obra'}</option>
                  })}
                </select>
              )}
            </Field>
            <Field label="Data" required>
              {(id) => <input id={id} type="date" min={today} className={inputCls()} value={date} onChange={(event) => setDate(event.target.value)} />}
            </Field>
            <Field label="Horário" required>
              {(id) => <input id={id} type="time" className={inputCls()} value={time} onChange={(event) => setTime(event.target.value)} />}
            </Field>
            <Field label="Observações" className="sm:col-span-2 lg:col-span-3">
              {(id) => <textarea id={id} className={cx(inputCls(), 'h-auto py-2')} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />}
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <Button onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button variant="primary" disabled={!orderId || !date || !time} onClick={() => void saveSchedule()}>Salvar programação</Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-xl font-bold uppercase">Programações registradas</h2>
          <p className="text-sm text-muted">{views.schedule.length || scheduleEvents.length} serviço(s) no calendário.</p>
        </div>
        {sortedEvents.length === 0 ? (
          <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="Agenda vazia">
            Converta um orçamento aceito em pedido e agende a primeira concretagem.
            <div className="mt-3"><Link to="/pedidos" className="font-semibold text-brand hover:underline">Ir para pedidos</Link></div>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="px-4 py-3">Data / horário</th>
                  <th className="px-4 py-3">Cliente / obra</th>
                  <th className="px-4 py-3">Serviço</th>
                  <th className="px-4 py-3">Volume / FCK</th>
                  <th className="px-4 py-3">Pedido / orçamento</th>
                      <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedEvents.map((event) => {
                  const order = workOrders.find((item) => item.id === event.workOrderId)
                  const client = clients.find((item) => item.id === event.clientId)
                  const site = sites.find((item) => item.id === event.siteId)
                  const scheduleSummary = scheduleSummaryById.get(event.id)
                  return (
                    <tr key={event.id} className="border-b border-line last:border-0 align-top">
                      <td className="px-4 py-3">
                        {canEditSchedule ? (
                          <div className="grid min-w-[150px] gap-1">
                            <input aria-label={`Data de ${event.service}`} type="date" className={cx(inputCls(), 'h-8 text-xs')} value={dateEdits[event.id] ?? event.date} onChange={(change) => setDateEdits((current) => ({ ...current, [event.id]: change.target.value }))} />
                            <input aria-label={`Horário de ${event.service}`} type="time" className={cx(inputCls(), 'h-8 text-xs')} value={timeEdits[event.id] ?? event.time} onChange={(change) => setTimeEdits((current) => ({ ...current, [event.id]: change.target.value }))} />
                            {((dateEdits[event.id] ?? event.date) !== event.date || (timeEdits[event.id] ?? event.time) !== event.time) && <Button size="sm" onClick={() => void saveReschedule(event)}>Salvar reagendamento</Button>}
                          </div>
                        ) : <div className="min-w-[150px] py-2 font-medium tabular">{dateBR(event.date)} · {event.time}</div>}
                      </td>
                      <td className="px-4 py-3"><strong className="block">{scheduleSummary?.cliente_nome ?? client?.name ?? '—'}</strong><span className="text-xs text-muted">{scheduleSummary?.obra_nome ?? site?.name ?? '—'}</span></td>
                      <td className="px-4 py-3">{event.service}<span className="block text-xs text-muted">{event.pump ? 'Com bombeamento' : 'Sem bombeamento'}</span>{event.notes && <span className="mt-1 block max-w-[220px] text-xs text-muted">{event.notes}</span>}</td>
                      <td className="px-4 py-3 tabular">{event.volumeM3 > 0 ? `${event.volumeM3.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m³` : '—'}<span className="block text-xs text-muted">{event.fck ? `FCK ${event.fck}` : '—'}</span></td>
                      <td className="px-4 py-3"><strong>{scheduleSummary?.pedido_numero ?? order?.number ?? '—'}</strong><span className="block text-xs text-muted">{scheduleSummary?.orcamento_numero ?? event.quoteId}</span></td>
                              <td className="px-4 py-3">
                        {canEditSchedule
                          ? <select aria-label={`Status de ${event.service} em ${event.date}`} className={cx(inputCls(), 'h-9 min-w-[150px] text-xs')} value={event.status} onChange={(change) => void changeStatus(event, change.target.value as ScheduleStatus)}>
                              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                          : <span className="inline-flex rounded-md border border-line px-2 py-1 text-xs font-medium">{event.status}</span>}
                      </td>
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
