import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Bell, Check, ClipboardList, Plus, RotateCcw, XCircle } from 'lucide-react'
import { useStore } from '../data/store'
import {
  commercialTaskTiming,
  type CommercialTask,
  type CommercialTaskPriority,
  type CommercialTaskStatus,
} from '../data/operations'
import { today } from '../lib/clock'
import { dateBR } from '../lib/format'
import { Badge, Button, Card, CardHeader, EmptyState, Field, PageHeader, cx, inputCls } from '../components/ui'

export const Route = createFileRoute('/tarefas')({
  validateSearch: (search: Record<string, unknown>) => ({
    oportunidade: typeof search.oportunidade === 'string' ? search.oportunidade : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Tarefas e retornos — Qualimix CRM' },
      { name: 'description', content: 'Acompanhe tarefas comerciais, prazos e retornos de oportunidades.' },
    ],
  }),
  component: Tarefas,
})

type Filter = 'pendentes' | 'todas' | 'concluidas' | 'canceladas'

const blankForm = {
  title: '',
  opportunityId: '',
  dueDate: today,
  dueTime: '',
  priority: 'Normal' as CommercialTaskPriority,
  notes: '',
}

function Tarefas() {
  const search = Route.useSearch()
  const { tasks, opportunities, clients, saveTask, toast } = useStore()
  const initialOpportunity = opportunities.find((item) => item.id === search.oportunidade)
  const [form, setForm] = useState(() => ({
    ...blankForm,
    title: initialOpportunity
      ? (initialOpportunity.nextAction && initialOpportunity.nextAction !== '—'
          ? initialOpportunity.nextAction
          : 'Retornar: ' + initialOpportunity.title)
      : '',
    opportunityId: initialOpportunity?.id ?? '',
    dueDate: initialOpportunity?.nextContact ?? today,
  }))
  const [showForm, setShowForm] = useState(Boolean(initialOpportunity))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('pendentes')

  const counts = useMemo(() => ({
    pending: tasks.filter((task) => task.status === 'Pendente').length,
    overdue: tasks.filter((task) => task.status === 'Pendente' && task.dueDate < today).length,
    today: tasks.filter((task) => task.status === 'Pendente' && task.dueDate === today).length,
    completed: tasks.filter((task) => task.status === 'Concluída').length,
  }), [tasks])

  const visibleTasks = useMemo(() => tasks
    .filter((task) => {
      if (filter === 'pendentes') return task.status === 'Pendente'
      if (filter === 'concluidas') return task.status === 'Concluída'
      if (filter === 'canceladas') return task.status === 'Cancelada'
      return true
    })
    .sort((a, b) => (a.dueDate + (a.dueTime ?? '23:59')).localeCompare(b.dueDate + (b.dueTime ?? '23:59'))), [tasks, filter])

  const resetForm = () => {
    setForm(blankForm)
    setEditingId(null)
    setShowForm(false)
  }

  const editTask = (task: CommercialTask) => {
    setEditingId(task.id)
    setForm({
      title: task.title,
      opportunityId: task.opportunityId ?? '',
      dueDate: task.dueDate,
      dueTime: task.dueTime ?? '',
      priority: task.priority,
      notes: task.notes,
    })
    setShowForm(true)
  }

  const submitTask = () => {
    const existing = tasks.find((task) => task.id === editingId)
    const task: CommercialTask = {
      id: editingId ?? 'task-' + crypto.randomUUID(),
      opportunityId: form.opportunityId || null,
      title: form.title.trim(),
      notes: form.notes.trim(),
      dueDate: form.dueDate,
      dueTime: form.dueTime || null,
      priority: form.priority,
      status: existing?.status ?? 'Pendente',
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      completedAt: existing?.completedAt ?? null,
      demo: false,
    }
    try {
      saveTask(task)
      toast({ tone: 'ok', title: editingId ? 'Tarefa atualizada' : 'Tarefa agendada', body: task.title })
      resetForm()
    } catch (error) {
      toast({ tone: 'erro', title: 'Não foi possível salvar', body: error instanceof Error ? error.message : 'Revise os dados da tarefa.' })
    }
  }

  const changeStatus = (task: CommercialTask, status: CommercialTaskStatus) => {
    try {
      saveTask({
        ...task,
        status,
        completedAt: status === 'Concluída' ? new Date().toISOString() : null,
      })
      toast({
        tone: 'ok',
        title: status === 'Concluída' ? 'Tarefa concluída' : status === 'Cancelada' ? 'Tarefa cancelada' : 'Tarefa reaberta',
        body: task.title,
      })
    } catch (error) {
      toast({ tone: 'erro', title: 'Não foi possível atualizar', body: error instanceof Error ? error.message : 'Revise a tarefa.' })
    }
  }

  const relatedOpportunity = (task: CommercialTask) =>
    opportunities.find((opportunity) => opportunity.id === task.opportunityId)
  const stateLabel = (task: CommercialTask) => {
    const state = commercialTaskTiming(task, today)
    if (state === 'Atrasada') return 'Atrasada'
    if (state === 'Hoje') return 'Hoje'
    if (state === 'Futura') return 'Agendada'
    return state
  }
  const stateTone = (task: CommercialTask) => {
    const state = commercialTaskTiming(task, today)
    return state === 'Atrasada' ? 'red' : state === 'Hoje' ? 'warn' : state === 'Concluída' ? 'ok' : 'neutral'
  }

  return (
    <>
      <PageHeader
        eyebrow="Comercial"
        title="Tarefas e retornos"
        description="Organize os próximos passos, acompanhe prazos e mantenha o histórico de retorno das oportunidades."
        actions={<Button variant="primary" onClick={() => { setEditingId(null); setForm(blankForm); setShowForm((value) => !value) }}><Plus className="h-4 w-4" /> Nova tarefa</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs font-bold uppercase text-muted">Pendentes</p>
          <p className="mt-1 font-display text-3xl font-extrabold tabular">{counts.pending}</p>
        </div>
        <div className="rounded-lg border border-brand/30 bg-surface p-4">
          <p className="text-xs font-bold uppercase text-brand">Atrasadas</p>
          <p className="mt-1 font-display text-3xl font-extrabold tabular">{counts.overdue}</p>
        </div>
        <div className="rounded-lg border border-warn/30 bg-surface p-4">
          <p className="text-xs font-bold uppercase text-warn">Para hoje</p>
          <p className="mt-1 font-display text-3xl font-extrabold tabular">{counts.today}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs font-bold uppercase text-muted">Concluídas</p>
          <p className="mt-1 font-display text-3xl font-extrabold tabular">{counts.completed}</p>
        </div>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader title={editingId ? 'Editar tarefa' : 'Nova tarefa'} subtitle="A tarefa pode ser geral ou vinculada a uma oportunidade do funil." />
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="Descrição da tarefa" required className="md:col-span-2">
              {(id) => <input id={id} className={inputCls()} maxLength={120} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Ligar para confirmar o orçamento" />}
            </Field>
            <Field label="Oportunidade vinculada">
              {(id) => (
                <select id={id} className={inputCls()} value={form.opportunityId} onChange={(event) => setForm((current) => ({ ...current, opportunityId: event.target.value }))}>
                  <option value="">Tarefa geral, sem oportunidade</option>
                  {opportunities.map((opportunity) => {
                    const client = clients.find((item) => item.id === opportunity.clientId)
                    return <option key={opportunity.id} value={opportunity.id}>{opportunity.title}{client ? ' · ' + client.name : ''}</option>
                  })}
                </select>
              )}
            </Field>
            <Field label="Prioridade">
              {(id) => <select id={id} className={inputCls()} value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as CommercialTaskPriority }))}>
                <option value="Baixa">Baixa</option>
                <option value="Normal">Normal</option>
                <option value="Alta">Alta</option>
              </select>}
            </Field>
            <Field label="Data de vencimento" required>
              {(id) => <input id={id} type="date" className={inputCls()} value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />}
            </Field>
            <Field label="Horário (opcional)">
              {(id) => <input id={id} type="time" className={inputCls()} value={form.dueTime} onChange={(event) => setForm((current) => ({ ...current, dueTime: event.target.value }))} />}
            </Field>
            <Field label="Observações" className="md:col-span-2">
              {(id) => <textarea id={id} rows={3} className={cx(inputCls(), 'h-auto py-2')} maxLength={2000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />}
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <Button onClick={resetForm}>Cancelar</Button>
            <Button variant="primary" disabled={form.title.trim().length < 3 || !form.dueDate} onClick={submitTask}>Salvar tarefa</Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Tarefas registradas"
          subtitle={visibleTasks.length + ' tarefa(s) nesta visualização'}
          action={
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant={filter === 'pendentes' ? 'primary' : 'secondary'} onClick={() => setFilter('pendentes')}>Pendentes</Button>
              <Button size="sm" variant={filter === 'todas' ? 'primary' : 'secondary'} onClick={() => setFilter('todas')}>Todas</Button>
              <Button size="sm" variant={filter === 'concluidas' ? 'primary' : 'secondary'} onClick={() => setFilter('concluidas')}>Concluídas</Button>
              <Button size="sm" variant={filter === 'canceladas' ? 'primary' : 'secondary'} onClick={() => setFilter('canceladas')}>Canceladas</Button>
            </div>
          }
        />
        {visibleTasks.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Nenhuma tarefa nesta lista">
            Agende um retorno pelo funil ou crie uma tarefa geral para organizar a rotina comercial.
          </EmptyState>
        ) : (
          <div className="divide-y divide-line">
            {visibleTasks.map((task) => {
              const opportunity = relatedOpportunity(task)
              const client = opportunity ? clients.find((item) => item.id === opportunity.clientId) : undefined
              const tone = stateTone(task)
              return (
                <article key={task.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{task.title}</h3>
                      <Badge tone={tone}>{stateLabel(task)}</Badge>
                      <Badge tone={task.priority === 'Alta' ? 'warn' : 'neutral'}>Prioridade {task.priority.toLowerCase()}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {dateBR(task.dueDate)}{task.dueTime ? ' · ' + task.dueTime : ' · Sem horário definido'}
                      {opportunity ? ' · ' + opportunity.title : ' · Tarefa geral'}
                      {client ? ' · ' + client.name : ''}
                    </p>
                    {task.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{task.notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {task.status === 'Pendente' && (
                      <>
                        <Button size="sm" onClick={() => editTask(task)}>Editar</Button>
                        <Button size="sm" variant="primary" onClick={() => changeStatus(task, 'Concluída')}><Check className="h-4 w-4" /> Concluir</Button>
                        <Button size="sm" variant="danger" onClick={() => changeStatus(task, 'Cancelada')}><XCircle className="h-4 w-4" /> Cancelar</Button>
                      </>
                    )}
                    {task.status === 'Concluída' && <Button size="sm" onClick={() => changeStatus(task, 'Pendente')}><RotateCcw className="h-4 w-4" /> Reabrir</Button>}
                    {opportunity && <Link to="/funil" className="inline-flex h-8 items-center px-2 text-sm font-semibold text-brand hover:underline">Ver funil</Link>}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </Card>

      {!showForm && counts.pending === 0 && (
        <div className="mt-5 rounded-lg border border-line bg-surface p-4 text-sm text-muted">
          <Bell className="mr-2 inline h-4 w-4" /> Os avisos de prazo aparecem nesta tela e no painel enquanto o CRM estiver sendo utilizado. Notificações externas ainda não estão configuradas.
        </div>
      )}
    </>
  )
}
