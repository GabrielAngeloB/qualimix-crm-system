import { createServerFn } from '@tanstack/react-start'
import { randomUUID } from 'node:crypto'
import type {
  WorkOrder, ScheduleEvent, Professional, JobExpense, FinancialEntry, FinancialPayment, CommercialTask,
  ExpenseCategory, ProfessionalRateUnit,
} from '../data/operations'
import {
  calculateUnitCostCents, validateCommercialTask, validateDate, validateMoneyCents, validateTime,
} from '../data/operations'
import { assertSameOrigin, requireCurrentProfile } from './auth.server'
import { getPool, withTransaction } from './db.server'
import { todayInSaoPaulo } from './clock'

const isoDate = (value: unknown): string => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10)
const isoDateTime = (value: unknown): string => value instanceof Date ? value.toISOString() : String(value ?? '')
const idText = (value: unknown, label: string, max = 100): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(label + ' inválido.')
  return value.trim()
}
const text = (value: unknown, label: string, max: number, required = false): string => {
  if (value == null && !required) return ''
  if (typeof value !== 'string') throw new Error(label + ' inválido.')
  const result = value.trim()
  if ((required && !result) || result.length > max) throw new Error(label + ' inválido.')
  return result
}
const safeCents = (value: unknown, label: string): number => {
  const amount = Number(value)
  if (!validateMoneyCents(amount)) throw new Error(label + ' precisa ser maior que zero e caber em centavos inteiros.')
  return amount
}
const roles = {
  commercial: ['comercial'],
  operations: ['operacao'],
  finance: ['financeiro'],
}
function assertRole(profile: Awaited<ReturnType<typeof requireCurrentProfile>>, allowed: string[]) {
  if (profile.perfil === 'admin' || profile.role === 'administrador' || profile.role === 'admin') return
  if (!allowed.includes(profile.role)) throw new Error('Seu perfil não tem permissão para executar esta operação.')
}
const workOrderStatuses = ['Aguardando programação','Programada','Em execução','Concluída','Cancelada']
const scheduleStatuses = ['Planejada','Confirmada','Em preparação','Em execução','Concluída','Reagendada','Cancelada']
const expenseCategories: ExpenseCategory[] = ['Mão de obra','Material','Equipamento','Frete','Bombeamento','Combustível','Terceirizado','Outros']
const rateUnits: ProfessionalRateUnit[] = ['serviço','hora','diária','m²','m³']

function mapWorkOrder(r: any): WorkOrder {
  return {
    id: String(r.id), number: String(r.numero), quoteId: String(r.orcamento_id),
    opportunityId: r.oportunidade_id == null ? null : String(r.oportunidade_id),
    clientId: String(r.cliente_id), siteId: String(r.obra_id), description: String(r.descricao),
    contractedCents: Number(r.valor_contratado_centavos), status: r.status,
    createdAt: isoDateTime(r.created_at), cancellationReason: r.motivo_cancelamento ?? null,
    cancelledAt: r.cancelado_em ? isoDateTime(r.cancelado_em) : null,
    valueHistory: Array.isArray(r.historico_valor) ? r.historico_valor : [],
    demo: false,
  }
}
function mapSchedule(r: any): ScheduleEvent {
  return {
    id: String(r.id), workOrderId: String(r.pedido_id), quoteId: String(r.orcamento_id),
    clientId: String(r.cliente_id), siteId: String(r.obra_id), date: isoDate(r.data),
    time: String(r.hora).slice(0, 5), service: String(r.servico), volumeM3: Number(r.volume_m3 ?? 0),
    fck: r.fck == null ? null : Number(r.fck), pump: Boolean(r.bomba),
    truck: r.caminhao ?? '', status: r.status, notes: r.observacoes ?? '', demo: false,
  }
}
function mapProfessional(r: any): Professional {
  return {
    id: String(r.id), name: r.nome, document: r.documento ?? '', phone: r.telefone ?? '',
    serviceType: r.tipo_servico, rateCents: Number(r.tarifa_centavos), rateUnit: r.unidade,
    paymentMethod: r.forma_pagamento ?? '', active: Boolean(r.ativo), notes: r.observacoes ?? '',
    createdAt: isoDateTime(r.created_at), demo: false,
  }
}
function mapExpense(r: any): JobExpense {
  return {
    id: String(r.id), workOrderId: String(r.pedido_id),
    professionalId: r.profissional_id == null ? null : String(r.profissional_id),
    category: r.categoria, description: r.descricao, amountCents: Number(r.valor_centavos),
    unitRateCents: r.tarifa_unitaria_centavos == null ? null : Number(r.tarifa_unitaria_centavos),
    quantity: r.quantidade == null ? null : Number(r.quantidade), rateUnit: r.unidade ?? null,
    incurredAt: isoDate(r.data_despesa), createdAt: isoDateTime(r.created_at), demo: false,
  }
}
function mapPayment(r: any): FinancialPayment {
  return {
    id: String(r.id), paidAt: isoDate(r.pago_em), amountCents: Number(r.valor_centavos),
    method: r.metodo, note: r.observacao ?? '',
  }
}
function mapFinancial(r: any): FinancialEntry {
  return {
    id: String(r.id), kind: r.tipo, workOrderId: r.pedido_id == null ? null : String(r.pedido_id),
    quoteId: r.orcamento_id == null ? null : String(r.orcamento_id),
    clientId: r.cliente_id == null ? null : String(r.cliente_id),
    professionalId: r.profissional_id == null ? null : String(r.profissional_id),
    description: r.descricao, amountCents: Number(r.valor_centavos),
    issuedAt: isoDate(r.emitido_em), dueDate: isoDate(r.vencimento), method: r.metodo,
    status: r.cancelado_em ? 'Cancelado' : r.status,
    payments: Array.isArray(r.pagamentos) ? r.pagamentos.map(mapPayment) : [],
    createdAt: isoDateTime(r.created_at), demo: false,
  }
}
function mapTask(r: any): CommercialTask {
  return {
    id: String(r.id), opportunityId: r.oportunidade_id == null ? null : String(r.oportunidade_id),
    title: r.titulo, notes: r.observacoes ?? '', dueDate: isoDate(r.vencimento),
    dueTime: r.horario == null ? null : String(r.horario).slice(0, 5),
    priority: r.prioridade, status: r.status, createdAt: isoDateTime(r.criada_em),
    completedAt: r.concluida_em == null ? null : isoDateTime(r.concluida_em), demo: false,
  }
}

export type OperationalRecords = {
  workOrders: WorkOrder[]
  scheduleEvents: ScheduleEvent[]
  professionals: Professional[]
  expenses: JobExpense[]
  financialEntries: FinancialEntry[]
  tasks: CommercialTask[]
  views: {
    finance: any[]
    orders: any[]
    professionals: any[]
    schedule: any[]
    tasks: any[]
  }
}

export const loadOperationalRecords = createServerFn({ method: 'GET' })
  .handler(async (): Promise<OperationalRecords> => {
    const profile = await requireCurrentProfile()
    const isAdmin = profile.perfil === 'admin' || profile.role === 'administrador'
    const canViewSales = isAdmin || profile.role === 'comercial' || profile.role === 'consulta'
    const canViewOperations = isAdmin || profile.role === 'operacao' || profile.role === 'consulta'
    const canViewFinance = isAdmin || profile.role === 'financeiro' || profile.role === 'consulta'
    const result = await getPool().query<{
      orders: any[]; schedule: any[]; professionals: any[]; expenses: any[];
      financial: any[]; tasks: any[]; financeView: any[]; ordersView: any[];
      professionalsView: any[]; scheduleView: any[]; tasksView: any[];
    }>(`
      select
        coalesce((select json_agg(to_jsonb(x) order by x.created_at desc,x.numero desc)
          from (select * from public.pedidos where is_demo=false) x),'[]'::json) as orders,
        coalesce((select json_agg(to_jsonb(x) order by x.data,x.hora,x.id)
          from (select * from public.agenda_eventos where is_demo=false) x),'[]'::json) as schedule,
        coalesce((select json_agg(to_jsonb(x) order by x.nome,x.id)
          from (select * from public.profissionais where is_demo=false) x),'[]'::json) as professionals,
        coalesce((select json_agg(to_jsonb(x) order by x.data_despesa desc,x.created_at desc)
          from (select * from public.despesas where is_demo=false) x),'[]'::json) as expenses,
        coalesce((select json_agg(to_jsonb(x) order by x.vencimento,x.created_at)
          from (
            select l.*,
              coalesce((select json_agg(json_build_object(
                'id',pg.id,'pago_em',pg.pago_em,'valor_centavos',pg.valor_centavos,
                'metodo',pg.metodo,'observacao',pg.observacao
              ) order by pg.pago_em,pg.created_at)
                from public.pagamentos_financeiros pg where pg.lancamento_id=l.id),'[]'::json) as pagamentos
            from public.lancamentos_financeiros l where l.is_demo=false
          ) x),'[]'::json) as financial,
        coalesce((select json_agg(to_jsonb(x) order by x.vencimento,x.horario nulls last,x.id)
          from (select * from public.tarefas_comerciais where is_demo=false) x),'[]'::json) as tasks,
        coalesce((select json_agg(to_jsonb(x) order by x.vencimento,x.created_at)
          from (select * from public.vw_financeiro_resumo) x),'[]'::json) as "financeView",
        coalesce((select json_agg(to_jsonb(x) order by x.created_at desc,x.numero desc)
          from (select * from public.vw_pedidos_resumo) x),'[]'::json) as "ordersView",
        coalesce((select json_agg(to_jsonb(x) order by x.nome)
          from (select * from public.vw_profissionais_resumo) x),'[]'::json) as "professionalsView",
        coalesce((select json_agg(to_jsonb(x) order by x.data,x.hora)
          from (select * from public.vw_agenda_resumo) x),'[]'::json) as "scheduleView",
        coalesce((select json_agg(to_jsonb(x) order by x.status,x.prioridade)
          from (select * from public.vw_tarefas_resumo) x),'[]'::json) as "tasksView"
    `)
    const row = result.rows[0]
    if (!row) throw new Error('O banco não retornou os registros operacionais.')
    return {
      workOrders: row.orders.map(mapWorkOrder),
      scheduleEvents: canViewOperations ? row.schedule.map(mapSchedule) : [],
      professionals: canViewOperations || canViewFinance ? row.professionals.map(mapProfessional) : [],
      expenses: canViewOperations || canViewFinance ? row.expenses.map(mapExpense) : [],
      financialEntries: canViewFinance ? row.financial.map(mapFinancial) : [],
      tasks: canViewSales ? row.tasks.map(mapTask) : [],
      views: {
        finance: canViewFinance ? row.financeView : [],
        orders: row.ordersView,
        professionals: canViewOperations || canViewFinance ? row.professionalsView : [],
        schedule: canViewOperations ? row.scheduleView : [],
        tasks: canViewSales ? row.tasksView : [],
      },
    }
  })

export const createWorkOrderFromQuoteOnServer = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Dados da conversão inválidos.')
    const x = input as Record<string, unknown>
    const quoteId = idText(x.quoteId, 'Orçamento', 100)
    const dueDate = text(x.dueDate, 'Vencimento', 10, true)
    const method = text(x.method, 'Forma de pagamento', 120, true)
    if (!validateDate(dueDate)) throw new Error('Informe uma data de vencimento válida.')
    return { quoteId, dueDate, method }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile = await requireCurrentProfile()
    assertRole(profile, roles.commercial)
    return withTransaction(async (tx) => {
      try {
        const q = await tx.query<any>(
          `select id,numero,status,tipo,cliente_id,obra_id,oportunidade_id,total_centavos,is_demo
           from public.orcamentos where id=$1`, [data.quoteId])
        const quote = q.rows[0]
        if (!quote || quote.is_demo) throw new Error('Orçamento real não encontrado.')
        if (quote.status !== 'Aceito') throw new Error('Somente orçamentos aceitos podem gerar pedidos.')

        // pedidos.orcamento_id tem UNIQUE. A constraint, não um lock no orçamento,
        // arbitra duas conversões concorrentes sem exigir UPDATE em orcamentos.
        const existing = await tx.query('select id from public.pedidos where orcamento_id=$1 limit 1', [data.quoteId])
        if (existing.rowCount) throw new Error('Este orçamento já foi convertido em pedido.')

        const amount = safeCents(quote.total_centavos, 'Total contratado')
        const numberResult = await tx.query<{ numero: string }>(
          `select 'PED-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.pedido_numero_seq')::text,4,'0') as numero`)
        const id = 'ped-' + randomUUID()
        const orderResult = await tx.query<any>(
          `insert into public.pedidos
            (id,numero,orcamento_id,oportunidade_id,cliente_id,obra_id,descricao,
             valor_contratado_centavos,status,created_by,is_demo)
           values($1,$2,$3,$4,$5,$6,$7,$8,'Aguardando programação',$9,false)
           returning *`,
          [id,numberResult.rows[0].numero,quote.id,quote.oportunidade_id,quote.cliente_id,
           quote.obra_id,'Pedido originado do orçamento '+quote.numero,amount,profile.id])
        await tx.query(
          `insert into public.lancamentos_financeiros
            (id,tipo,pedido_id,orcamento_id,cliente_id,descricao,valor_centavos,
             emitido_em,vencimento,metodo,status,created_by,is_demo)
           values($1,'receber',$2,$3,$4,$5,$6,current_date,$7,$8,'Em aberto',$9,false)`,
          ['fin-'+randomUUID(),id,quote.id,quote.cliente_id,'Conta a receber · pedido '+numberResult.rows[0].numero,
           amount,data.dueDate,data.method,profile.id])
        return mapWorkOrder(orderResult.rows[0])
      } catch (error) {
        if ((error as { code?: string; constraint?: string })?.code === '23505' &&
            (error as { constraint?: string })?.constraint === 'pedidos_orcamento_id_key') {
          throw new Error('Este orçamento já foi convertido em pedido.')
        }
        throw error
      }
    })
  })

export const updateWorkOrderAmountOnServer = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Alteração de contrato inválida.')
    const x = input as Record<string, unknown>
    return { id: idText(x.id,'Pedido'), amountCents: safeCents(x.amountCents,'Valor contratado') }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile = await requireCurrentProfile()
    assertRole(profile, ['comercial'])
    await withTransaction(async (tx) => {
      const r = await tx.query<any>('select * from public.pedidos where id=$1 for update',[data.id])
      const order = r.rows[0]
      if (!order || order.is_demo) throw new Error('Pedido não encontrado.')
      if (order.status === 'Cancelada') throw new Error('Pedido cancelado não pode ter o valor alterado.')
      const fr = await tx.query<any>(
        `select * from public.lancamentos_financeiros where pedido_id=$1 and tipo='receber' for update`,[data.id])
      const entry = fr.rows[0]
      if (!entry || entry.cancelado_em) throw new Error('A conta a receber deste pedido não existe ou está cancelada.')
      const paid = await tx.query<{ total: string|number }>(
        'select coalesce(sum(valor_centavos),0)::bigint as total from public.pagamentos_financeiros where lancamento_id=$1',[entry.id])
      const paidCents = Number(paid.rows[0]?.total ?? 0)
      if (data.amountCents < paidCents) throw new Error('O novo valor não pode ficar abaixo do total já recebido.')
      const previous = Number(order.valor_contratado_centavos)
      if (previous === data.amountCents) return
      const at = new Date().toISOString()
      const history = [...(Array.isArray(order.historico_valor) ? order.historico_valor : []),
        { at, fromCents: previous, toCents: data.amountCents }]
      await tx.query(
        'update public.pedidos set valor_contratado_centavos=$2,historico_valor=$3::jsonb where id=$1',
        [data.id,data.amountCents,JSON.stringify(history)])
      const status = paidCents >= data.amountCents ? 'Pago' : paidCents > 0 ? 'Parcial' :
        String(entry.vencimento).slice(0,10) < todayInSaoPaulo() ? 'Vencido' : 'Em aberto'
      await tx.query('update public.lancamentos_financeiros set valor_centavos=$2,status=$3 where id=$1',
        [entry.id,data.amountCents,status])
    })
  })

export const cancelWorkOrderOnServer = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Pedido inválido.')
    const x = input as Record<string, unknown>
    const id = idText(x.id, 'Pedido')
    const reason = text(x.reason, 'Motivo do cancelamento', 500, true)
    if (reason.length < 5) throw new Error('Descreva o motivo do cancelamento com ao menos 5 caracteres.')
    return { id, reason }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile = await requireCurrentProfile()
    assertRole(profile, ['comercial'])
    await withTransaction(async (tx) => {
      const orderResult = await tx.query<any>(
        'select id,status,is_demo from public.pedidos where id=$1 for update',
        [data.id],
      )
      const order = orderResult.rows[0]
      if (!order || order.is_demo) throw new Error('Pedido não encontrado.')
      if (order.status === 'Cancelada') return
      if (order.status === 'Em execução' || order.status === 'Concluída') {
        throw new Error('Um pedido em execução ou concluído não pode ser cancelado por esta rotina.')
      }

      const schedule = await tx.query<{ status: string }>(
        'select status from public.agenda_eventos where pedido_id=$1 for update',
        [data.id],
      )
      if (schedule.rows.some((row) => row.status === 'Em execução' || row.status === 'Concluída')) {
        throw new Error('Este pedido possui serviço em execução ou concluído. Faça a conferência operacional antes de cancelar.')
      }

      const receivables = await tx.query<any>(
        "select id,valor_centavos from public.lancamentos_financeiros where pedido_id=$1 and tipo='receber' and cancelado_em is null for update",
        [data.id],
      )
      for (const entry of receivables.rows) {
        const paid = await tx.query<{ total: string | number }>(
          'select coalesce(sum(valor_centavos),0)::bigint as total from public.pagamentos_financeiros where lancamento_id=$1',
          [entry.id],
        )
        if (Number(paid.rows[0]?.total ?? 0) > 0) {
          throw new Error('O pedido já possui recebimentos registrados. Não é seguro cancelá-lo automaticamente; regularize o financeiro antes.')
        }
      }

      for (const entry of receivables.rows) {
        await tx.query(
          `update public.lancamentos_financeiros
              set cancelado_em=now(),cancelado_por=$2,status='Cancelado'
            where id=$1`,
          [entry.id,profile.id],
        )
      }

      await tx.query(
        "update public.agenda_eventos set status='Cancelada' where pedido_id=$1 and status not in ('Cancelada','Concluída')",
        [data.id],
      )
      await tx.query(
        `update public.pedidos
            set status='Cancelada',cancelado_em=now(),cancelado_por=$2,motivo_cancelamento=$3
          where id=$1`,
        [data.id,profile.id,data.reason],
      )
    })
    return { success: true }
  })

export type ExpenseInput = JobExpense & { dueDate: string; method: string }
export const addExpenseOnServer = createServerFn({ method: 'POST' })
  .validator((input: unknown): ExpenseInput => {
    if (!input || typeof input !== 'object') throw new Error('Dados da despesa inválidos.')
    const x = input as Record<string, unknown>
    const category = String(x.category) as ExpenseCategory
    if (!expenseCategories.includes(category)) throw new Error('Categoria de despesa inválida.')
    const amountCents = safeCents(x.amountCents,'Valor da despesa')
    const incurredAt = text(x.incurredAt,'Data da despesa',10,true)
    const dueDate = text(x.dueDate,'Vencimento',10,true)
    if (!validateDate(incurredAt) || !validateDate(dueDate)) throw new Error('Informe datas válidas para a despesa e o vencimento.')
    const professionalId = x.professionalId == null ? null : idText(x.professionalId,'Profissional')
    const unitRateCents = x.unitRateCents == null ? null : safeCents(x.unitRateCents,'Tarifa unitária')
    const quantity = x.quantity == null ? null : Number(x.quantity)
    const rateUnit = x.rateUnit == null ? null : String(x.rateUnit) as ProfessionalRateUnit
    if (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000)) throw new Error('Quantidade inválida.')
    if (rateUnit !== null && !rateUnits.includes(rateUnit)) throw new Error('Unidade de tarifa inválida.')
    if (professionalId && (!unitRateCents || !quantity || !rateUnit || calculateUnitCostCents(unitRateCents,quantity)!==amountCents)) {
      throw new Error('Total de mão de obra deve ser igual à tarifa unitária multiplicada pela quantidade.')
    }
    return {
      id: idText(x.id,'Despesa'), workOrderId: idText(x.workOrderId,'Pedido'),
      professionalId, category, description: text(x.description,'Descrição',300,true),
      amountCents, unitRateCents, quantity, rateUnit, incurredAt,
      createdAt: new Date().toISOString(), demo: false, dueDate, method: text(x.method,'Forma de pagamento',120,true),
    }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile = await requireCurrentProfile()
    assertRole(profile, ['operacao','financeiro'])
    await withTransaction(async (tx) => {
      const order = await tx.query<any>('select id,cliente_id,status from public.pedidos where id=$1 and is_demo=false for update',[data.workOrderId])
      if (!order.rows[0] || order.rows[0].status === 'Cancelada') throw new Error('Pedido inexistente ou cancelado.')
      if (data.professionalId) {
        const p = await tx.query<any>('select id,ativo from public.profissionais where id=$1 for share',[data.professionalId])
        if (!p.rows[0] || !p.rows[0].ativo) throw new Error('Profissional não encontrado ou inativo.')
      }
      await tx.query(
        `insert into public.despesas
          (id,pedido_id,profissional_id,categoria,descricao,valor_centavos,
           tarifa_unitaria_centavos,quantidade,unidade,data_despesa,created_by,is_demo)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false)`,
        [data.id,data.workOrderId,data.professionalId,data.category,data.description,data.amountCents,
         data.unitRateCents ?? null,data.quantity ?? null,data.rateUnit ?? null,data.incurredAt,profile.id])
      await tx.query(
        `insert into public.lancamentos_financeiros
          (id,tipo,pedido_id,despesa_id,cliente_id,profissional_id,descricao,valor_centavos,
           emitido_em,vencimento,metodo,status,created_by,is_demo)
         values($1,'pagar',$2,$3,$4,$5,$6,$7,$8,$9,$10,'Em aberto',$11,false)`,
        ['fin-'+randomUUID(),data.workOrderId,data.id,order.rows[0].cliente_id,
         data.professionalId,data.description,data.amountCents,data.incurredAt,data.dueDate,data.method,profile.id])
    })
  })

export const registerPaymentOnServer = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Baixa financeira inválida.')
    const x = input as Record<string, unknown>
    const paidAt = text(x.paidAt,'Data do pagamento',10,true)
    if (!validateDate(paidAt)) throw new Error('Data de pagamento inválida.')
    return {
      entryId: idText(x.entryId,'Lançamento'), id: idText(x.id,'Pagamento'),
      paidAt, amountCents: safeCents(x.amountCents,'Valor da baixa'),
      method: text(x.method,'Forma de pagamento',120,true),
      note: text(x.note,'Observação',500),
    }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile = await requireCurrentProfile()
    assertRole(profile, ['financeiro'])
    await withTransaction(async (tx) => {
      const r = await tx.query<any>(
        'select * from public.lancamentos_financeiros where id=$1 for update',[data.entryId])
      const entry = r.rows[0]
      if (!entry || entry.cancelado_em) throw new Error('Lançamento não encontrado ou cancelado.')
      const p = await tx.query<{total: string|number}>(
        'select coalesce(sum(valor_centavos),0)::bigint as total from public.pagamentos_financeiros where lancamento_id=$1',[data.entryId])
      const paid = Number(p.rows[0]?.total ?? 0)
      const open = Number(entry.valor_centavos)-paid
      if (data.amountCents > open) throw new Error('A baixa não pode ser maior que o saldo em aberto.')
      await tx.query(
        `insert into public.pagamentos_financeiros
          (id,lancamento_id,pago_em,valor_centavos,metodo,observacao,created_by)
         values($1,$2,$3,$4,$5,$6,$7)`,
        [data.id,data.entryId,data.paidAt,data.amountCents,data.method,data.note,profile.id])
    })
  })

export const cancelFinancialEntryOnServer = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Lançamento inválido.')
    return { id: idText((input as Record<string,unknown>).id,'Lançamento') }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile = await requireCurrentProfile()
    assertRole(profile, ['financeiro'])
    await withTransaction(async (tx) => {
      const r = await tx.query<any>('select * from public.lancamentos_financeiros where id=$1 for update',[data.id])
      const entry = r.rows[0]
      if (!entry) throw new Error('Lançamento não encontrado.')
      if (entry.cancelado_em) return
      const p = await tx.query<{total: string|number}>(
        'select coalesce(sum(valor_centavos),0)::bigint as total from public.pagamentos_financeiros where lancamento_id=$1',[data.id])
      if (Number(p.rows[0]?.total ?? 0) >= Number(entry.valor_centavos)) throw new Error('Uma conta totalmente paga não pode ser cancelada.')
      await tx.query(
        `update public.lancamentos_financeiros
         set cancelado_em=now(),cancelado_por=$2,status='Cancelado'
         where id=$1`,[data.id,profile.id])
    })
  })

export const saveProfessionalOnServer = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Profissional inválido.')
    const x = input as Record<string,unknown>
    const document = text(x.document,'Documento',20).replace(/\D/g,'')
    if (document && !/^([0-9]{11}|[0-9]{14})$/.test(document)) throw new Error('CPF/CNPJ precisa ter 11 ou 14 dígitos.')
    const rateUnit = String(x.rateUnit) as ProfessionalRateUnit
    if (!rateUnits.includes(rateUnit)) throw new Error('Unidade do custo inválida.')
    if (typeof x.active !== 'boolean') throw new Error('Estado do profissional inválido.')
    return {
      id:idText(x.id,'Profissional'), name:text(x.name,'Nome',160,true),
      document, phone:text(x.phone,'Telefone',30), serviceType:text(x.serviceType,'Serviço',160,true),
      rateCents:safeCents(x.rateCents,'Custo de referência'), rateUnit,
      paymentMethod:text(x.paymentMethod,'Forma de pagamento',120),
      active:x.active, notes:text(x.notes,'Observações',2000),
    }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile = await requireCurrentProfile()
    assertRole(profile, ['operacao','financeiro'])
    await getPool().query(
      `insert into public.profissionais
        (id,nome,documento,telefone,tipo_servico,tarifa_centavos,unidade,forma_pagamento,ativo,observacoes,created_by,is_demo)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false)
       on conflict(id) do update set nome=excluded.nome,documento=excluded.documento,
         telefone=excluded.telefone,tipo_servico=excluded.tipo_servico,
         tarifa_centavos=excluded.tarifa_centavos,unidade=excluded.unidade,
         forma_pagamento=excluded.forma_pagamento,ativo=excluded.ativo,observacoes=excluded.observacoes`,
      [data.id,data.name,data.document,data.phone,data.serviceType,data.rateCents,data.rateUnit,
       data.paymentMethod,data.active,data.notes,profile.id])
  })

export const saveScheduleEventOnServer = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Programação inválida.')
    const x = input as Record<string,unknown>
    const date=text(x.date,'Data',10,true), time=text(x.time,'Horário',5,true)
    if (!validateDate(date) || !validateTime(time)) throw new Error('Data ou horário inválido.')
    if (!scheduleStatuses.includes(String(x.status))) throw new Error('Status da programação inválido.')
    const volumeM3=Number(x.volumeM3)
    if (!Number.isFinite(volumeM3) || volumeM3<0 || volumeM3>1_000_000) throw new Error('Volume inválido.')
    const fck=x.fck == null ? null : Number(x.fck)
    if (fck !== null && (!Number.isInteger(fck) || fck<1 || fck>100)) throw new Error('FCK inválido.')
    if (typeof x.pump !== 'boolean') throw new Error('Informação de bombeamento inválida.')
    return {
      id:idText(x.id,'Programação'),workOrderId:idText(x.workOrderId,'Pedido'),
      quoteId:idText(x.quoteId,'Orçamento'),clientId:idText(x.clientId,'Cliente'),
      siteId:idText(x.siteId,'Obra'),date,time,service:text(x.service,'Serviço',160,true),
      volumeM3,fck,pump:x.pump,
      status:String(x.status),notes:text(x.notes,'Observações',1000),
    }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile = await requireCurrentProfile()
    assertRole(profile, ['operacao'])
    await withTransaction(async (tx) => {
      const order=await tx.query<any>(
        'select orcamento_id,cliente_id,obra_id,is_demo,status from public.pedidos where id=$1 for share',[data.workOrderId])
      const row=order.rows[0]
      if (!row || row.is_demo || row.status === 'Cancelada' || row.orcamento_id!==data.quoteId || row.cliente_id!==data.clientId || row.obra_id!==data.siteId) {
        throw new Error('O pedido não corresponde ao orçamento, cliente e obra selecionados.')
      }
      await tx.query(
        `insert into public.agenda_eventos
          (id,pedido_id,orcamento_id,cliente_id,obra_id,data,hora,servico,volume_m3,fck,bomba,status,observacoes,created_by,is_demo)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,false)
         on conflict(id) do update set data=excluded.data,hora=excluded.hora,
           status=excluded.status,observacoes=excluded.observacoes`,
        [data.id,data.workOrderId,data.quoteId,data.clientId,data.siteId,data.date,data.time,
         data.service,data.volumeM3,data.fck,data.pump,data.status,data.notes,profile.id])
    })
  })

export const saveTaskOnServer = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Tarefa inválida.')
    const x=input as Record<string,unknown>
    const task: CommercialTask={
      id:idText(x.id,'Tarefa'),opportunityId:x.opportunityId==null?null:idText(x.opportunityId,'Oportunidade'),
      title:text(x.title,'Título',120,true),notes:text(x.notes,'Observações',2000),
      dueDate:text(x.dueDate,'Vencimento',10,true),dueTime:x.dueTime==null?null:text(x.dueTime,'Horário',5,true),
      priority:String(x.priority) as CommercialTask['priority'],
      status:String(x.status) as CommercialTask['status'],
      createdAt:text(x.createdAt,'Criação',40,true),
      completedAt:x.completedAt==null?null:text(x.completedAt,'Conclusão',40,true),demo:false,
    }
    if (!validateCommercialTask(task)) throw new Error('Revise o título, prazo, horário, prioridade e status da tarefa.')
    return task
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile=await requireCurrentProfile()
    assertRole(profile,roles.commercial)
    await withTransaction(async (tx) => {
      if (data.opportunityId) {
        const existingTask = await tx.query<any>(
          'select oportunidade_id from public.tarefas_comerciais where id=$1 and is_demo=false for update',
          [data.id],
        )
        const keepsExistingArchivedLink = existingTask.rows[0]?.oportunidade_id === data.opportunityId
        const opportunity = await tx.query(
          `select id from public.oportunidades
            where id=$1 and is_demo=false and (arquivada=false or $2::boolean=true)`,
          [data.opportunityId, keepsExistingArchivedLink],
        )
        if (!opportunity.rowCount) throw new Error('A oportunidade vinculada não existe, está arquivada ou é de demonstração.')
      }
      await tx.query(
        `insert into public.tarefas_comerciais
          (id,oportunidade_id,titulo,observacoes,vencimento,horario,prioridade,status,criada_em,concluida_em,created_by,is_demo)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false)
         on conflict(id) do update set oportunidade_id=excluded.oportunidade_id,titulo=excluded.titulo,
          observacoes=excluded.observacoes,vencimento=excluded.vencimento,horario=excluded.horario,
          prioridade=excluded.prioridade,status=excluded.status,concluida_em=excluded.concluida_em`,
        [data.id,data.opportunityId,data.title,data.notes,data.dueDate,data.dueTime,data.priority,
         data.status,data.createdAt,data.completedAt,profile.id])
    })
  })
