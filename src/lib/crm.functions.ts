import { createServerFn } from '@tanstack/react-start'
import type { Client, Opportunity, QuoteRecord, Site } from '../data/fixtures'
import { quoteContext } from '../data/derived'
import { computeQuote, defaultExtras, summarizeMeasures, type MeasureElement, type QuoteExtras, type QuoteLine } from './quote'
import { createAdminSupabase, createRequestSupabase } from './supabase/server'
import { catalog } from '../data/settings'

async function activeContext() {
  const supabase = createRequestSupabase()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('Sessão inválida.')
  const { data: profile, error } = await supabase.from('perfis')
    .select('id,nome,perfil,ativo').eq('id', auth.user.id).maybeSingle()
  if (error || !profile || !profile.ativo) throw new Error('Usuário inativo ou sem perfil.')
  return { supabase, profile }
}

const mapClient = (r: any): Client => ({
  id:r.id, name:r.nome, tradeName:r.nome_fantasia ?? '', document:r.documento ?? '',
  phone:r.telefone ?? '', whatsapp:r.whatsapp ?? '', email:r.email ?? '', address:r.endereco ?? '',
  city:r.cidade ?? '', region:r.regiao ?? '', type:r.tipo ?? 'Outro', source:r.origem ?? 'Outros',
  ownerId:r.responsavel_id ?? '', notes:r.observacoes ?? '', createdAt:r.created_at.slice(0,10),
  active:r.ativo, demo:r.is_demo,
})
const mapSite = (r: any): Site => ({
  id:r.id, clientId:r.cliente_id, name:r.nome, address:r.endereco ?? '', city:r.cidade ?? '',
  region:r.regiao ?? '', contactName:r.contato_nome ?? '', contactPhone:r.contato_telefone ?? '',
  serviceType:r.tipo_servico ?? '', accessNotes:r.observacoes_acesso ?? '',
  restrictions:r.restricoes ?? '', demo:r.is_demo,
})
const mapOpportunity = (r: any): Opportunity => ({
  id:r.id, title:r.titulo, clientId:r.cliente_id, siteId:r.obra_id, stage:r.etapa,
  estimatedValue:r.valor_estimado == null ? null : Number(r.valor_estimado), ownerId:r.responsavel_id ?? '',
  source:r.origem, enteredAt:r.entrou_em, lastContact:r.ultimo_contato, nextContact:r.proximo_contato,
  nextAction:r.proxima_acao ?? '', lossReason:r.motivo_perda,
  quoteId:null, history:Array.isArray(r.historico) ? r.historico : [], demo:r.is_demo,
})
const mapQuote = (r: any): QuoteRecord => {
  const d = r.dados_orcamento ?? {}
  return {
    id:r.id, number:r.numero, version:r.versao, createdAt:r.created_at.slice(0,10),
    validUntil:r.validade, sentAt:r.enviado_em, status:r.status, type:r.tipo,
    clientId:r.cliente_id, siteId:r.obra_id, ownerId:r.responsavel_id,
    volumeElements:d.volumeElements ?? [], volumeMargin:d.volumeMargin ?? '',
    areaElements:d.areaElements ?? [], areaMargin:d.areaMargin ?? '',
    lines:d.lines ?? [], extras:d.extras ?? defaultExtras(),
    paymentMethodIds:d.paymentMethodIds ?? [], paymentTerms:d.paymentTerms ?? '',
    executionDeadline:d.executionDeadline ?? '', notes:d.notes ?? '', demo:r.is_demo,
  }
}

export const loadCrmData = createServerFn({ method: 'GET' }).handler(async () => {
  const { supabase } = await activeContext()
  const [clients, sites, opportunities, quotes] = await Promise.all([
    supabase.from('clientes').select('*').eq('is_demo', false).order('created_at', { ascending:false }),
    supabase.from('obras').select('*').eq('is_demo', false).order('created_at', { ascending:false }),
    supabase.from('oportunidades').select('*').eq('is_demo', false).order('created_at', { ascending:false }),
    supabase.from('orcamentos').select('*').eq('is_demo', false).order('created_at', { ascending:false }),
  ])
  for (const result of [clients,sites,opportunities,quotes]) if (result.error) throw new Error('Não foi possível carregar os dados do CRM.')
  const quoteRecords = (quotes.data ?? []).map(mapQuote)
  const quoteByOpportunity = new Map((quotes.data ?? []).filter((row:any) => row.oportunidade_id).map((row:any) => [row.oportunidade_id, row.id]))
  return {
    clients:(clients.data ?? []).map(mapClient),
    sites:(sites.data ?? []).map(mapSite),
    opportunities:(opportunities.data ?? []).map((row:any) => ({ ...mapOpportunity(row), quoteId: quoteByOpportunity.get(row.id) ?? null })),
    quotes:quoteRecords,
  }
})

export const persistClient = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Dados do cliente inválidos.')
    const data = input as { client: Client; site?: Site }
    if (!data.client || typeof data.client.name !== 'string' || data.client.name.trim().length < 3) throw new Error('Nome do cliente inválido.')
    if (data.site && (typeof data.site.name !== 'string' || data.site.name.trim().length < 3)) throw new Error('Nome da obra inválido.')
    return data
  })
  .handler(async ({ data }) => {
    const { supabase, profile } = await activeContext()
    const c = data.client
    const { data: inserted, error } = await supabase.from('clientes').insert({
      id:c.id,
      nome:c.name.trim(), nome_fantasia:c.tradeName, documento:c.document || null,
      telefone:c.phone, whatsapp:c.whatsapp, email:c.email, endereco:c.address,
      cidade:c.city, regiao:c.region, tipo:c.type, origem:c.source,
      responsavel_id:profile.id, observacoes:c.notes, ativo:true, is_demo:false,
    }).select('id').single()
    if (error || !inserted) throw new Error(error?.code === '23505' ? 'CPF/CNPJ já cadastrado.' : 'Não foi possível salvar o cliente.')
    if (data.site) {
      const s = data.site
      const { error: siteError } = await supabase.from('obras').insert({
        id:s.id,
        cliente_id:inserted.id, nome:s.name.trim(), endereco:s.address, cidade:s.city,
        regiao:s.region, contato_nome:s.contactName, contato_telefone:s.contactPhone,
        tipo_servico:s.serviceType, observacoes_acesso:s.accessNotes, restricoes:s.restrictions,
        ativa:true, is_demo:false,
      })
      if (siteError) {
        // Compensação explícita: se a segunda gravação falhar, remove o cliente recém-criado.
        await createAdminSupabase().from('clientes').delete().eq('id', inserted.id)
        throw new Error('Não foi possível salvar a obra. O cadastro do cliente foi revertido.')
      }
    }
    return { success:true }
  })

export const persistOpportunity = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Dados da oportunidade inválidos.')
    const data = input as { id:string; patch:Partial<Opportunity>; historyText?:string }
    if (!data.id || typeof data.id !== 'string') throw new Error('Oportunidade inválida.')
    return data
  })
  .handler(async ({ data }) => {
    const { supabase, profile } = await activeContext()
    const { data: current, error: readError } = await supabase.from('oportunidades').select('historico').eq('id',data.id).maybeSingle()
    if (readError || !current) throw new Error('Oportunidade não encontrada.')
    const p = data.patch
    const patch: Record<string, unknown> = {}
    if (p.title !== undefined) patch.titulo = p.title.trim()
    if (p.clientId !== undefined) patch.cliente_id = p.clientId
    if (p.siteId !== undefined) patch.obra_id = p.siteId
    if (p.stage !== undefined) patch.etapa = p.stage
    if (p.estimatedValue !== undefined) patch.valor_estimado = p.estimatedValue
    if (p.source !== undefined) patch.origem = p.source
    if (p.lastContact !== undefined) patch.ultimo_contato = p.lastContact
    if (p.nextContact !== undefined) patch.proximo_contato = p.nextContact
    if (p.nextAction !== undefined) patch.proxima_acao = p.nextAction
    if (p.lossReason !== undefined) patch.motivo_perda = p.lossReason
    if (data.historyText) patch.historico = [{at:new Date().toISOString(),by:profile.id,text:data.historyText}, ...(Array.isArray(current.historico) ? current.historico : [])]
    const { error } = await supabase.from('oportunidades').update(patch).eq('id',data.id)
    if (error) throw new Error('Não foi possível atualizar a oportunidade.')
    return { success:true }
  })

export type QuoteSaveInput = {
  type:'concreto'|'piso'|'combinado'; clientId:string; siteId:string;
  volumeElements:MeasureElement[]; volumeMargin:string; areaElements:MeasureElement[];
  areaMargin:string; lines:QuoteLine[]; extras:QuoteExtras; paymentMethodIds:string[];
  paymentTerms:string; validityDays:number; executionDeadline:string; notes:string;
}

export const persistQuote = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Dados do orçamento inválidos.')
    const d = input as QuoteSaveInput
    if (!d.clientId || !d.siteId) throw new Error('Selecione cliente e obra.')
    if (!Number.isInteger(d.validityDays) || d.validityDays < 1 || d.validityDays > 365) throw new Error('Validade inválida.')
    if (!Array.isArray(d.lines) || d.lines.length === 0) throw new Error('Adicione ao menos um item.')
    return d
  })
  .handler(async ({ data }) => {
    const { supabase, profile } = await activeContext()
    const { data: site } = await supabase.from('obras').select('id').eq('id',data.siteId).eq('cliente_id',data.clientId).maybeSingle()
    if (!site) throw new Error('A obra não pertence ao cliente selecionado.')
    const volume = summarizeMeasures(data.volumeElements, data.volumeMargin, 'volume')
    const area = summarizeMeasures(data.areaElements, data.areaMargin, 'area')
    const result = computeQuote({
      clientId:data.clientId, siteId:data.siteId, lines:data.lines,
      volume, area, extras:data.extras, paymentMethodIds:data.paymentMethodIds,
    }, quoteContext(false))
    const validUntil = new Date(Date.now() + data.validityDays * 86400000).toISOString().slice(0,10)
    const input = {
      volumeElements:data.volumeElements, volumeMargin:data.volumeMargin,
      areaElements:data.areaElements, areaMargin:data.areaMargin, lines:data.lines,
      extras:data.extras, paymentMethodIds:data.paymentMethodIds, paymentTerms:data.paymentTerms,
      executionDeadline:data.executionDeadline, notes:data.notes,
    }
    const concreteLine = data.lines.find((line) => line.category === 'concreto')
    const { data: saved, error } = await createAdminSupabase().from('orcamentos').insert({
      tipo:data.type, cliente_id:data.clientId, obra_id:data.siteId,
      responsavel_id:profile.id, created_by:profile.id, validade:validUntil, status:'Rascunho',
      dados_orcamento:input, resultado_calculo:result, total_centavos:result.totalCents,
      volume_concreto:result.concreteVolume, area_piso:result.floorArea,
      fck:concreteLine?.catalogId ? catalog.find((item) => item.id === concreteLine.catalogId)?.fck ?? null : null, pode_emitir:result.canIssue,
      precisa_aprovacao:result.needsApproval, versao_motor_calculo:'computeQuote-v1',
      calculado_em:new Date().toISOString(), is_demo:false,
    }).select('id,numero,versao,created_at').single()
    if (error || !saved) throw new Error('Não foi possível salvar o orçamento.')
    return { id:saved.id, number:saved.numero, version:saved.versao }
  })
