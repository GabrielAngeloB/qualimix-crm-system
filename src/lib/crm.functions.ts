import { createServerFn } from '@tanstack/react-start'
import type { Client, Opportunity, QuoteRecord, Site, TeamUser, QuoteType } from '../data/fixtures'
import { quoteContext } from '../data/derived'
import {
  computeQuote,
  defaultExtras,
  summarizeMeasures,
  type CatalogItem,
  type MeasureElement,
  type QuoteExtras,
  type QuoteLine,
} from './quote'
import { assertSameOrigin, requireCurrentProfile, type AuthProfile } from './auth.server'
import { getPool, withTransaction } from './db.server'

const isoDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value ?? '').slice(0, 10)
}
const isoDateTime = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString()
  return String(value ?? '')
}
const nullableDate = (value: unknown): string | null => value == null ? null : isoDate(value)

const mapClient = (r: any): Client => ({
  id: String(r.id), name: r.nome, tradeName: r.nome_fantasia ?? '', document: r.documento ?? '',
  phone: r.telefone ?? '', whatsapp: r.whatsapp ?? '', email: r.email ?? '', address: r.endereco ?? '',
  city: r.cidade ?? '', region: r.regiao ?? '', type: r.tipo ?? 'Outro', source: r.origem ?? 'Outros',
  ownerId: r.responsavel_id ?? '', notes: r.observacoes ?? '', createdAt: isoDate(r.created_at),
  active: Boolean(r.ativo), demo: Boolean(r.is_demo),
})
const mapSite = (r: any): Site => ({
  id: String(r.id), clientId: String(r.cliente_id), name: r.nome, address: r.endereco ?? '',
  city: r.cidade ?? '', region: r.regiao ?? '', contactName: r.contato_nome ?? '',
  contactPhone: r.contato_telefone ?? '', serviceType: r.tipo_servico ?? '',
  accessNotes: r.observacoes_acesso ?? '', restrictions: r.restricoes ?? '', demo: Boolean(r.is_demo),
})
const mapOpportunity = (r: any): Opportunity => ({
  id: String(r.id), title: r.titulo, clientId: String(r.cliente_id), siteId: r.obra_id ?? null,
  createdAt: isoDateTime(r.created_at), stage: r.etapa, estimatedValue: r.valor_estimado == null ? null : Number(r.valor_estimado),
  ownerId: r.responsavel_id ?? '', source: r.origem, enteredAt: isoDate(r.entrou_em),
  lastContact: nullableDate(r.ultimo_contato), nextContact: nullableDate(r.proximo_contato),
  nextAction: r.proxima_acao ?? '', lossReason: r.motivo_perda ?? null,
  quoteId: null, history: Array.isArray(r.historico) ? r.historico : [], demo: Boolean(r.is_demo),
})
const mapQuote = (r: any): QuoteRecord => {
  const d = r.dados_orcamento ?? {}
  return {
    id: String(r.id), number: r.numero, version: Number(r.versao), createdAt: isoDate(r.created_at),
    validUntil: isoDate(r.validade), sentAt: r.enviado_em ? isoDateTime(r.enviado_em) : null,
    status: r.status, type: r.tipo, clientId: String(r.cliente_id), siteId: String(r.obra_id),
    ownerId: r.responsavel_id, volumeElements: d.volumeElements ?? [], volumeMargin: d.volumeMargin ?? '',
    areaElements: d.areaElements ?? [], areaMargin: d.areaMargin ?? '', lines: d.lines ?? [],
    extras: d.extras ?? defaultExtras(), paymentMethodIds: d.paymentMethodIds ?? [],
    paymentTerms: d.paymentTerms ?? '', executionDeadline: d.executionDeadline ?? '',
    notes: d.notes ?? '', demo: Boolean(r.is_demo),
    savedResult: r.resultado_calculo ?? null,
    savedFck: r.fck == null ? null : Number(r.fck),
  }
}
const mapCatalog = (r: any): CatalogItem => ({
  id: r.id, code: r.codigo, name: r.nome, category: r.categoria, unit: r.unidade,
  description: r.descricao ?? '', basePrice: r.preco_base == null ? null : Number(r.preco_base),
  demoPrice: r.preco_demo == null ? null : Number(r.preco_demo),
  ...(r.fck == null ? {} : { fck: Number(r.fck) }),
  ...(r.acabamento == null ? {} : { finish: r.acabamento }),
  active: Boolean(r.ativo), validFrom: nullableDate(r.valido_desde),
})
const roleName = (role: string): TeamUser['role'] => {
  if (role === 'administrador' || role === 'admin') return 'Administrador'
  if (role === 'operacao') return 'Operação'
  if (role === 'financeiro') return 'Financeiro'
  if (role === 'consulta') return 'Consulta'
  return 'Comercial'
}
function assertCommercial(profile: AuthProfile) {
  if (profile.perfil !== 'admin' && profile.role !== 'comercial') {
    throw new Error('Seu perfil não tem permissão para alterar dados comerciais.')
  }
}

export type CrmViews = {
  clients: any[]
  funnel: any[]
  quotes: any[]
  fleet: any[]
}
export type CrmData = {
  clients: Client[]
  sites: Site[]
  opportunities: Opportunity[]
  quotes: QuoteRecord[]
  products: CatalogItem[]
  team: TeamUser[]
  views: CrmViews
  currentUserId: string
}

export const loadCrmData = createServerFn({ method: 'GET' }).handler(async (): Promise<CrmData> => {
  const currentProfile = await requireCurrentProfile()
  const db = getPool()
  // Uma única ida ao PostgreSQL evita dez round-trips sequenciais no pool
  // (max=1 é intencional para não multiplicar conexões em ambientes serverless).
  const result = await db.query<{
    clients: any[]; sites: any[]; opportunities: any[]; quotes: any[]; products: any[];
    profiles: any[]; clientView: any[]; funnelView: any[]; quoteView: any[]; fleetView: any[];
  }>(`
    SELECT
      COALESCE((SELECT json_agg(to_jsonb(x) ORDER BY x.created_at DESC, x.id DESC) FROM (SELECT * FROM public.clientes WHERE is_demo = false) x), '[]'::json) AS clients,
      COALESCE((SELECT json_agg(to_jsonb(x) ORDER BY x.created_at DESC, x.id DESC) FROM (SELECT * FROM public.obras WHERE is_demo = false AND ativa = true) x), '[]'::json) AS sites,
      COALESCE((SELECT json_agg(to_jsonb(x) ORDER BY x.created_at DESC, x.id DESC) FROM (SELECT * FROM public.oportunidades WHERE is_demo = false) x), '[]'::json) AS opportunities,
      COALESCE((SELECT json_agg(to_jsonb(x) ORDER BY x.created_at DESC, x.id DESC) FROM (SELECT * FROM public.orcamentos WHERE is_demo = false) x), '[]'::json) AS quotes,
      COALESCE((SELECT json_agg(to_jsonb(x) ORDER BY x.categoria, x.nome) FROM (SELECT * FROM public.produtos WHERE ativo = true) x), '[]'::json) AS products,
      COALESCE((SELECT json_agg(to_jsonb(x) ORDER BY x.nome) FROM (
        SELECT p.id::text, p.nome, p.perfil
        FROM public.perfis p
        JOIN public.usuarios u ON u.id = p.id
        WHERE p.ativo = true
      ) x), '[]'::json) AS profiles,
      COALESCE((SELECT json_agg(to_jsonb(x) ORDER BY x.created_at DESC, x.id DESC) FROM (SELECT * FROM public.vw_clientes_resumo) x), '[]'::json) AS "clientView",
      COALESCE((SELECT json_agg(to_jsonb(x) ORDER BY x.ordem) FROM (SELECT * FROM public.vw_funil_resumo) x), '[]'::json) AS "funnelView",
      COALESCE((SELECT json_agg(to_jsonb(x) ORDER BY x.created_at DESC, x.id DESC) FROM (SELECT * FROM public.vw_orcamentos_resumo) x), '[]'::json) AS "quoteView",
      COALESCE((SELECT json_agg(to_jsonb(x) ORDER BY x.placa) FROM (SELECT * FROM public.vw_frota_resumo) x), '[]'::json) AS "fleetView"
  `)
  const data = result.rows[0]
  if (!data) throw new Error('O banco não retornou os dados do CRM.')

  const quoteRows = data.quotes
  const quoteByOpportunity = new Map(
    quoteRows.filter((row) => row.oportunidade_id).map((row) => [row.oportunidade_id, row.id]),
  )

  return {
    clients: data.clients.map(mapClient),
    sites: data.sites.map(mapSite),
    opportunities: data.opportunities.map((row: any) => ({
      ...mapOpportunity(row),
      quoteId: quoteByOpportunity.get(row.id) ?? null,
    })),
    quotes: quoteRows.map(mapQuote),
    products: data.products.map(mapCatalog),
    team: data.profiles.map((row: any) => ({
      id: String(row.id), name: row.nome, role: roleName(row.perfil),
    })),
    views: {
      clients: data.clientView,
      funnel: data.funnelView,
      quotes: data.quoteView,
      fleet: data.fleetView,
    },
    currentUserId: currentProfile.id,
  }
})

export const persistClient = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Dados do cliente inválidos.')
    const data = input as { client: Client; site?: Site }
    if (!data.client || typeof data.client.name !== 'string' || data.client.name.trim().length < 3) {
      throw new Error('Nome do cliente inválido.')
    }
    if (data.site && (typeof data.site.name !== 'string' || data.site.name.trim().length < 3)) {
      throw new Error('Nome da obra inválido.')
    }
    return data
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile = await requireCurrentProfile()
    assertCommercial(profile)
    const c = data.client
    await withTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO public.clientes
          (id,nome,nome_fantasia,documento,telefone,whatsapp,email,endereco,cidade,regiao,tipo,origem,
           responsavel_id,observacoes,ativo,is_demo,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,false,$13)`,
        [c.id,c.name.trim(),c.tradeName ?? '',c.document || null,c.phone ?? '',c.whatsapp ?? '',
         c.email ?? '',c.address ?? '',c.city ?? '',c.region ?? '',c.type ?? 'Outro',c.source ?? 'Outros',
         profile.id,c.notes ?? ''],
      )
      if (data.site) {
        const s = data.site
        await tx.query(
          `INSERT INTO public.obras
            (id,cliente_id,nome,endereco,cidade,regiao,contato_nome,contato_telefone,tipo_servico,
             observacoes_acesso,restricoes,ativa,is_demo)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,false)`,
          [s.id,c.id,s.name.trim(),s.address ?? '',s.city ?? '',s.region ?? '',
           s.contactName ?? '',s.contactPhone ?? '',s.serviceType ?? '',
           s.accessNotes ?? '',s.restrictions ?? ''],
        )
      }
    })
    return { success: true }
  })

export const persistOpportunity = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Dados da oportunidade inválidos.')
    const data = input as { id: string; patch: Partial<Opportunity>; historyText?: string }
    if (typeof data.id !== 'string' || !data.id || data.id.length > 80) throw new Error('Oportunidade inválida.')
    if (!data.patch || typeof data.patch !== 'object') throw new Error('Alterações inválidas.')
    if (data.historyText !== undefined && (typeof data.historyText !== 'string' || data.historyText.length > 500)) {
      throw new Error('Histórico inválido.')
    }
    return data
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile = await requireCurrentProfile()
    assertCommercial(profile)
    const allowed: Record<string, string> = {
      title: 'titulo', clientId: 'cliente_id', siteId: 'obra_id', stage: 'etapa',
      estimatedValue: 'valor_estimado', source: 'origem', lastContact: 'ultimo_contato',
      nextContact: 'proximo_contato', nextAction: 'proxima_acao', lossReason: 'motivo_perda',
    }
    const sets: string[] = []
    const values: unknown[] = []
    for (const [key, column] of Object.entries(allowed)) {
      const value = (data.patch as Record<string, unknown>)[key]
      if (value === undefined) continue
      if (key === 'title' && (typeof value !== 'string' || value.trim().length < 2 || value.length > 180)) {
        throw new Error('Título da oportunidade inválido.')
      }
      if (key === 'stage' && !['novo','atendimento','levantamento','elaboracao','enviado','negociacao','fechado','perdido'].includes(String(value))) {
        throw new Error('Etapa inválida.')
      }
      if (key === 'estimatedValue' && value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
        throw new Error('Valor estimado inválido.')
      }
      values.push(key === 'title' && typeof value === 'string' ? value.trim() : value)
      sets.push(column + ' = $' + values.length)
    }
    if (data.historyText) {
      values.push(JSON.stringify([{ at: new Date().toISOString(), by: profile.id, text: data.historyText }]))
      sets.push('historico = $' + values.length + '::jsonb || historico')
    }
    if (!sets.length) return { success: true }
    values.push(data.id)
    const result = await getPool().query(
      'UPDATE public.oportunidades SET ' + sets.join(', ') + ', updated_at = now() WHERE id = $' + values.length,
      values,
    )
    if (result.rowCount === 0) throw new Error('Oportunidade não encontrada.')
    return { success: true }
  })

export type OpportunityCreateInput = {
  title: string
  clientId: string
  siteId: string | null
  source: string
  estimatedValue: number | null
}

export const createOpportunity = createServerFn({ method: 'POST' })
  .validator((input: unknown): OpportunityCreateInput => {
    if (!input || typeof input !== 'object') throw new Error('Dados da oportunidade inválidos.')
    const data = input as Record<string, unknown>
    if (typeof data.title !== 'string' || data.title.trim().length < 2 || data.title.trim().length > 180) {
      throw new Error('Informe um título de 2 a 180 caracteres.')
    }
    if (typeof data.clientId !== 'string' || !data.clientId || data.clientId.length > 80) {
      throw new Error('Selecione um cliente válido.')
    }
    if (data.siteId !== null && data.siteId !== undefined && (typeof data.siteId !== 'string' || data.siteId.length > 80)) {
      throw new Error('Obra inválida.')
    }
    if (typeof data.source !== 'string' || !data.source.trim() || data.source.length > 80) {
      throw new Error('Informe a origem do lead.')
    }
    const estimatedValue = data.estimatedValue === null || data.estimatedValue === undefined || data.estimatedValue === ''
      ? null
      : Number(data.estimatedValue)
    if (estimatedValue !== null && (!Number.isFinite(estimatedValue) || estimatedValue < 0)) {
      throw new Error('Valor estimado inválido.')
    }
    return {
      title: data.title.trim(),
      clientId: data.clientId,
      siteId: typeof data.siteId === 'string' && data.siteId ? data.siteId : null,
      source: data.source.trim(),
      estimatedValue,
    }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile = await requireCurrentProfile()
    assertCommercial(profile)
    const db = getPool()
    const clientResult = await db.query(
      'SELECT id FROM public.clientes WHERE id = $1 AND ativo = true AND is_demo = false LIMIT 1',
      [data.clientId],
    )
    if (!clientResult.rows.length) throw new Error('Cliente não encontrado ou inativo.')

    if (data.siteId) {
      const siteResult = await db.query(
        'SELECT id FROM public.obras WHERE id = $1 AND cliente_id = $2 AND ativa = true AND is_demo = false LIMIT 1',
        [data.siteId, data.clientId],
      )
      if (!siteResult.rows.length) throw new Error('A obra não pertence ao cliente selecionado.')
    }

    const history = JSON.stringify([{ at: new Date().toISOString(), by: profile.id, text: 'Oportunidade criada.' }])
    const saved = await db.query<{ id: string }>(
      `INSERT INTO public.oportunidades
        (titulo,cliente_id,obra_id,etapa,valor_estimado,responsavel_id,origem,entrou_em,
         historico,relatorios,is_demo,created_by)
       VALUES ($1,$2,$3,'novo',$4,$5,$6,current_date,$7::jsonb,'[]'::jsonb,false,$5)
       RETURNING id`,
      [data.title,data.clientId,data.siteId,data.estimatedValue,profile.id,data.source,history],
    )
    const row = saved.rows[0]
    if (!row) throw new Error('O banco não retornou a nova oportunidade.')
    return { id: String(row.id) }
  })

const categories = ['concreto','piso','bombeamento','frete','estadia','servico','material','equipamento']
const units = ['m³','m²','un','h','km','viagem','diária']
const quoteTypes = ['concreto','piso','combinado']

function cleanText(value: unknown, label: string, max = 500, required = false): string {
  if (typeof value !== 'string') {
    if (required) throw new Error('Campo inválido: ' + label + '.')
    return ''
  }
  const result = value.trim()
  if (required && !result) throw new Error('Campo obrigatório: ' + label + '.')
  if (result.length > max) throw new Error('Campo muito longo: ' + label + '.')
  return result
}
function cleanElements(value: unknown, label: string): MeasureElement[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Medições inválidas: ' + label + '.')
  return value.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('Medição inválida.')
    const x = raw as Record<string, unknown>
    if (x.mode !== 'dimensoes' && x.mode !== 'informado') throw new Error('Modo de medição inválido.')
    return {
      id: cleanText(x.id,'id da medição',80,true),
      label: cleanText(x.label,'rótulo da medição',120),
      elementType: cleanText(x.elementType,'tipo do elemento',80,true),
      mode: x.mode,
      length: cleanText(x.length,'comprimento',40),
      width: cleanText(x.width,'largura',40),
      thicknessCm: cleanText(x.thicknessCm,'espessura',40),
      count: cleanText(x.count,'quantidade',40),
      informed: cleanText(x.informed,'medida informada',40),
      notes: cleanText(x.notes,'observação',300),
    }
  })
}
function cleanLines(value: unknown): QuoteLine[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw new Error('Adicione de 1 a 50 itens ao orçamento.')
  return value.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('Item inválido.')
    const x = raw as Record<string, unknown>
    if (!categories.includes(String(x.category)) || !units.includes(String(x.unit))) throw new Error('Categoria ou unidade inválida.')
    if (!['manual','volume','area'].includes(String(x.quantityMode))) throw new Error('Modo de quantidade inválido.')
    return {
      id: cleanText(x.id,'id do item',80,true),
      catalogId: typeof x.catalogId === 'string' && x.catalogId ? x.catalogId : null,
      description: cleanText(x.description,'descrição do item',180,true),
      unit: x.unit as QuoteLine['unit'],
      category: x.category as QuoteLine['category'],
      quantityMode: x.quantityMode as QuoteLine['quantityMode'],
      quantity: cleanText(x.quantity,'quantidade',40),
      unitPriceInput: cleanText(x.unitPriceInput,'preço unitário',40),
      discountPct: cleanText(x.discountPct,'desconto',40),
    }
  })
}
function cleanExtras(value: unknown): QuoteExtras {
  if (!value || typeof value !== 'object') throw new Error('Adicionais inválidos.')
  const x = value as Record<string, any>
  const freight = x.freight ?? {}
  const pumping = x.pumping ?? {}
  const stay = x.stay ?? {}
  if (!['nao','fixo','km','regiao'].includes(String(freight.mode))) throw new Error('Modalidade de frete inválida.')
  if (!['nao','fixo','m3','hora'].includes(String(pumping.mode))) throw new Error('Modalidade de bombeamento inválida.')
  if (typeof stay.include !== 'boolean' || typeof x.applyMinVolume !== 'boolean' || typeof pumping.partner !== 'boolean') throw new Error('Adicionais inválidos.')
  return {
    freight: {
      mode: freight.mode,
      km: cleanText(freight.km,'km de frete',40),
      regionId: cleanText(freight.regionId,'região do frete',80),
    },
    pumping: {
      mode: pumping.mode,
      hours: cleanText(pumping.hours,'horas de bombeamento',40),
      partner: pumping.partner,
    },
    stay: { include: stay.include, hours: cleanText(stay.hours,'horas de estadia',40) },
    applyMinVolume: x.applyMinVolume,
    globalDiscount: cleanText(x.globalDiscount,'desconto global',40),
  }
}

export type QuoteSaveInput = {
  type: QuoteType
  clientId: string
  siteId: string
  volumeElements: MeasureElement[]
  volumeMargin: string
  areaElements: MeasureElement[]
  areaMargin: string
  lines: QuoteLine[]
  extras: QuoteExtras
  paymentMethodIds: string[]
  paymentTerms: string
  validityDays: number
  executionDeadline: string
  notes: string
}

export const persistQuote = createServerFn({ method: 'POST' })
  .validator((input: unknown): QuoteSaveInput => {
    if (!input || typeof input !== 'object') throw new Error('Dados do orçamento inválidos.')
    const d = input as Record<string, unknown>
    if (!quoteTypes.includes(String(d.type))) throw new Error('Tipo de orçamento inválido.')
    if (typeof d.clientId !== 'string' || !d.clientId || d.clientId.length > 80) throw new Error('Selecione o cliente.')
    if (typeof d.siteId !== 'string' || !d.siteId || d.siteId.length > 80) throw new Error('Selecione a obra.')
    if (!Number.isInteger(d.validityDays) || Number(d.validityDays) < 1 || Number(d.validityDays) > 365) {
      throw new Error('Validade inválida.')
    }
    if (!Array.isArray(d.paymentMethodIds) || d.paymentMethodIds.length > 10 || d.paymentMethodIds.some((v) => typeof v !== 'string')) {
      throw new Error('Formas de pagamento inválidas.')
    }
    return {
      type: d.type as QuoteType,
      clientId: d.clientId,
      siteId: d.siteId,
      volumeElements: cleanElements(d.volumeElements,'volume'),
      volumeMargin: cleanText(d.volumeMargin,'margem de volume',40),
      areaElements: cleanElements(d.areaElements,'área'),
      areaMargin: cleanText(d.areaMargin,'margem de área',40),
      lines: cleanLines(d.lines),
      extras: cleanExtras(d.extras),
      paymentMethodIds: d.paymentMethodIds as string[],
      paymentTerms: cleanText(d.paymentTerms,'condições de pagamento',500),
      validityDays: Number(d.validityDays),
      executionDeadline: cleanText(d.executionDeadline,'prazo de execução',180),
      notes: cleanText(d.notes,'observações',2000),
    }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile = await requireCurrentProfile()
    assertCommercial(profile)
    const db = getPool()
    const [siteResult, productResult] = await Promise.all([
      db.query('SELECT id FROM public.obras WHERE id = $1 AND cliente_id = $2 AND ativa = true LIMIT 1', [data.siteId,data.clientId]),
      db.query('SELECT * FROM public.produtos WHERE ativo = true'),
    ])
    if (!siteResult.rows.length) throw new Error('A obra não pertence ao cliente selecionado ou está inativa.')

    const dbCatalog = productResult.rows.map(mapCatalog)
    const validProducts = new Map(dbCatalog.map((product) => [product.id, product]))
    const lines = data.lines.map((line) => {
      if (line.catalogId) {
        const product = validProducts.get(line.catalogId)
        if (!product) throw new Error('Um dos produtos selecionados não está ativo no catálogo.')
        return { ...line, description: product.name, unit: product.unit, category: product.category }
      }
      return line
    })

    const volume = summarizeMeasures(data.volumeElements, data.volumeMargin, 'volume')
    const area = summarizeMeasures(data.areaElements, data.areaMargin, 'area')
    const ctx = quoteContext(false, dbCatalog)
    const result = computeQuote({
      clientId: data.clientId, siteId: data.siteId, lines, volume, area,
      extras: data.extras, paymentMethodIds: data.paymentMethodIds,
    }, ctx)

    const validUntil = new Date(Date.now() + data.validityDays * 86_400_000).toISOString().slice(0,10)
    const savedInput = {
      volumeElements: data.volumeElements, volumeMargin: data.volumeMargin,
      areaElements: data.areaElements, areaMargin: data.areaMargin, lines,
      extras: data.extras, paymentMethodIds: data.paymentMethodIds,
      paymentTerms: data.paymentTerms, executionDeadline: data.executionDeadline, notes: data.notes,
    }
    const concreteLine = lines.find((line) => line.category === 'concreto')
    const fck = concreteLine?.catalogId ? validProducts.get(concreteLine.catalogId)?.fck ?? null : null
    const saved = await db.query<{id:string;numero:string;versao:number}>(
      `INSERT INTO public.orcamentos
        (tipo,cliente_id,obra_id,responsavel_id,created_by,validade,status,dados_orcamento,
         resultado_calculo,total_centavos,volume_concreto,area_piso,fck,pode_emitir,
         precisa_aprovacao,versao_motor_calculo,calculado_em,is_demo)
       VALUES ($1,$2,$3,$4,$4,$5,'Rascunho',$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,'computeQuote-v1',now(),false)
       RETURNING id, numero, versao`,
      [data.type,data.clientId,data.siteId,profile.id,validUntil,JSON.stringify(savedInput),
       JSON.stringify(result),result.totalCents,result.concreteVolume,result.floorArea,fck,
       result.canIssue,result.needsApproval],
    )
    const row = saved.rows[0]
    if (!row) throw new Error('O orçamento não foi retornado pelo banco.')
    return { id: String(row.id), number: row.numero, version: Number(row.versao) }
  })
