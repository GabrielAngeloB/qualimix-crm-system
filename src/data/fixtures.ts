/**
 * DADOS DE DEMONSTRAÇÃO — todos fictícios.
 *
 * Este módulo é a única fonte de dados da interface nesta etapa. Pessoas,
 * empresas, documentos, telefones e valores são inventados para apresentar o
 * sistema e estão marcados com `demo: true`. Na etapa de banco de dados, as
 * mesmas formas (tipos) serão carregadas do Postgres.
 */
import { addDays, isoDate } from '../lib/format'
import {
  defaultExtras,
  type MeasureElement,
  type QuoteExtras,
  type QuoteLine,
} from '../lib/quote'
import { catalog, type QuoteStatus, type StageId } from './settings'

export const today = isoDate(new Date())
const rel = (n: number) => addDays(today, n)

export type Role = 'Administrador' | 'Comercial' | 'Operação' | 'Financeiro' | 'Consulta'
export interface TeamUser {
  id: string
  name: string
  role: Role
}
export const team: TeamUser[] = [
  { id: 'u-adm', name: 'Administrador (demo)', role: 'Administrador' },
  { id: 'u-carla', name: 'Carla Mendes', role: 'Comercial' },
  { id: 'u-rafael', name: 'Rafael Souza', role: 'Comercial' },
  { id: 'u-op', name: 'Equipe de Operação', role: 'Operação' },
  { id: 'u-fin', name: 'Financeiro', role: 'Financeiro' },
]
export const currentUser = team[0]
export const userName = (id: string) => team.find((u) => u.id === id)?.name ?? '—'

export interface Client {
  id: string
  name: string
  tradeName: string
  document: string
  phone: string
  whatsapp: string
  email: string
  address: string
  city: string
  region: string
  type: string
  source: string
  ownerId: string
  notes: string
  createdAt: string
  active: boolean
  demo: boolean
}

export interface Site {
  id: string
  clientId: string
  name: string
  address: string
  city: string
  region: string
  contactName: string
  contactPhone: string
  serviceType: string
  accessNotes: string
  restrictions: string
  demo: boolean
}

export const clients: Client[] = [
  { id: 'cl-1', name: 'Construtora Horizonte Ltda', tradeName: 'Horizonte Obras', document: '11222333000181', phone: '11999990101', whatsapp: '11999990101', email: 'compras@horizonte.exemplo', address: 'Av. das Indústrias, 1200', city: 'Cidade Exemplo', region: 'Região Central', type: 'Construtora', source: 'Indicação', ownerId: 'u-carla', notes: 'Compra recorrente, prefere entregas pela manhã.', createdAt: rel(-160), active: true, demo: true },
  { id: 'cl-2', name: 'Marcos Antônio Pereira', tradeName: '', document: '12345678909', phone: '11999990202', whatsapp: '11999990202', email: '', address: 'Rua das Palmeiras, 45', city: 'Cidade Exemplo', region: 'Região Norte', type: 'Pessoa física', source: 'WhatsApp 1', ownerId: 'u-rafael', notes: 'Construção de residência própria.', createdAt: rel(-40), active: true, demo: true },
  { id: 'cl-3', name: 'Galpões Vale Verde S.A.', tradeName: 'Vale Verde', document: '44555666000181', phone: '11999990303', whatsapp: '11999990303', email: 'obras@valeverde.exemplo', address: 'Rod. Estadual, km 18', city: 'Município Modelo', region: 'Região Sul', type: 'Empresa', source: 'Instagram', ownerId: 'u-carla', notes: 'Galpão logístico, piso polido.', createdAt: rel(-95), active: true, demo: true },
  { id: 'cl-4', name: 'Empreiteira Silva & Filhos', tradeName: 'Silva Empreitadas', document: '77888999000181', phone: '11999990404', whatsapp: '11999990404', email: '', address: 'Rua Projetada, 300', city: 'Cidade Exemplo', region: 'Região Central', type: 'Empreiteiro', source: 'Telefone', ownerId: 'u-rafael', notes: '', createdAt: rel(-210), active: true, demo: true },
  { id: 'cl-5', name: 'Juliana Costa Lima', tradeName: '', document: '98765432100', phone: '11999990505', whatsapp: '11999990505', email: 'juliana@exemplo.com', address: 'Rua Sete, 77', city: 'Município Modelo', region: 'Região Sul', type: 'Pessoa física', source: 'WhatsApp 2', ownerId: 'u-carla', notes: 'Calçada e garagem.', createdAt: rel(-12), active: true, demo: true },
  { id: 'cl-6', name: 'Incorporadora Alto Padrão Ltda', tradeName: 'Alto Padrão', document: '22334455000186', phone: '11999990606', whatsapp: '11999990606', email: 'suprimentos@altopadrao.exemplo', address: 'Av. Central, 900', city: 'Cidade Exemplo', region: 'Região Central', type: 'Construtora', source: 'Indicação', ownerId: 'u-carla', notes: 'Edifício residencial, várias etapas.', createdAt: rel(-130), active: true, demo: true },
  { id: 'cl-7', name: 'Supermercados Bom Preço Ltda', tradeName: 'Bom Preço', document: '55667788000186', phone: '11999990707', whatsapp: '11999990707', email: '', address: 'Av. Brasil, 2500', city: 'Município Modelo', region: 'Região Norte', type: 'Empresa', source: 'Outros', ownerId: 'u-rafael', notes: 'Ampliação do estacionamento.', createdAt: rel(-70), active: true, demo: true },
  { id: 'cl-8', name: 'Paulo Henrique Ramos', tradeName: '', document: '32165498791', phone: '11999990808', whatsapp: '11999990808', email: '', address: 'Rua do Campo, 12', city: 'Cidade Exemplo', region: 'Região Norte', type: 'Pessoa física', source: 'Instagram', ownerId: 'u-rafael', notes: 'Sem retorno desde o último contato.', createdAt: rel(-55), active: false, demo: true },
]

export const sites: Site[] = [
  { id: 'ob-1', clientId: 'cl-1', name: 'Residencial Jardim Aurora — Bloco A', address: 'Rua das Acácias, 500', city: 'Cidade Exemplo', region: 'Região Central', contactName: 'Eng. Bruno', contactPhone: '11999991111', serviceType: 'Concreto usinado', accessNotes: 'Entrada pelo portão 2. Rua estreita.', restrictions: 'Descarga até 16h', demo: true },
  { id: 'ob-2', clientId: 'cl-1', name: 'Centro Comercial Horizonte', address: 'Av. Norte, 1500', city: 'Cidade Exemplo', region: 'Região Norte', contactName: 'Mestre Joel', contactPhone: '11999991112', serviceType: 'Concreto + bombeamento', accessNotes: 'Necessária bomba lança.', restrictions: '', demo: true },
  { id: 'ob-3', clientId: 'cl-2', name: 'Residência Pereira', address: 'Rua das Palmeiras, 45', city: 'Cidade Exemplo', region: 'Região Norte', contactName: 'Marcos', contactPhone: '11999990202', serviceType: 'Laje', accessNotes: 'Caminhão para na rua.', restrictions: 'Sábado somente até 12h', demo: true },
  { id: 'ob-4', clientId: 'cl-3', name: 'Galpão Logístico 3', address: 'Rod. Estadual, km 18', city: 'Município Modelo', region: 'Região Sul', contactName: 'Eng. Patrícia', contactPhone: '11999991313', serviceType: 'Piso polido', accessNotes: 'Pátio amplo.', restrictions: 'Uso obrigatório de EPI', demo: true },
  { id: 'ob-5', clientId: 'cl-4', name: 'Reforma Escola Municipal', address: 'Rua Projetada, 300', city: 'Cidade Exemplo', region: 'Região Central', contactName: 'Sr. Silva', contactPhone: '11999990404', serviceType: 'Contrapiso', accessNotes: '', restrictions: 'Somente fora do horário escolar', demo: true },
  { id: 'ob-6', clientId: 'cl-5', name: 'Garagem e calçada', address: 'Rua Sete, 77', city: 'Município Modelo', region: 'Região Sul', contactName: 'Juliana', contactPhone: '11999990505', serviceType: 'Piso sarrafeado', accessNotes: '', restrictions: '', demo: true },
  { id: 'ob-7', clientId: 'cl-6', name: 'Edifício Mirante — Torre 1', address: 'Av. Central, 900', city: 'Cidade Exemplo', region: 'Região Central', contactName: 'Eng. Renata', contactPhone: '11999991616', serviceType: 'Concreto + bombeamento', accessNotes: 'Agendar com 48h de antecedência.', restrictions: 'Horário 7h–17h', demo: true },
  { id: 'ob-8', clientId: 'cl-7', name: 'Estacionamento Loja Norte', address: 'Av. Brasil, 2500', city: 'Município Modelo', region: 'Região Norte', contactName: 'Gerente Lucas', contactPhone: '11999991717', serviceType: 'Piso sarrafeado', accessNotes: 'Isolar área de clientes.', restrictions: 'Noturno', demo: true },
  { id: 'ob-9', clientId: 'cl-8', name: 'Ampliação da casa', address: 'Rua do Campo, 12', city: 'Cidade Exemplo', region: 'Região Norte', contactName: 'Paulo', contactPhone: '11999990808', serviceType: 'Laje', accessNotes: '', restrictions: '', demo: true },
]

// ───────────── Orçamentos ─────────────

export type QuoteType = 'concreto' | 'piso' | 'combinado'

export interface QuoteRecord {
  id: string
  number: string
  version: number
  createdAt: string
  validUntil: string
  sentAt: string | null
  status: QuoteStatus
  type: QuoteType
  clientId: string
  siteId: string
  ownerId: string
  volumeElements: MeasureElement[]
  volumeMargin: string
  areaElements: MeasureElement[]
  areaMargin: string
  lines: QuoteLine[]
  extras: QuoteExtras
  paymentMethodIds: string[]
  paymentTerms: string
  executionDeadline: string
  notes: string
  demo: boolean
}

let seq = 0
const uid = (p: string) => `${p}-${++seq}`

export function el(
  elementType: string,
  length: string,
  width: string,
  thicknessCm: string,
  count = '1',
): MeasureElement {
  return { id: uid('el'), label: elementType, elementType, mode: 'dimensoes', length, width, thicknessCm, count, informed: '', notes: '' }
}

export function lineFor(catalogId: string, quantityMode: QuoteLine['quantityMode'] = 'manual', quantity = ''): QuoteLine {
  const c = catalog.find((x) => x.id === catalogId)!
  return { id: uid('ln'), catalogId, description: c.name, unit: c.unit, category: c.category, quantityMode, quantity, unitPriceInput: '', discountPct: '' }
}

function q(
  n: number,
  daysAgo: number,
  status: QuoteStatus,
  type: QuoteType,
  clientId: string,
  siteId: string,
  ownerId: string,
  parts: Partial<QuoteRecord>,
): QuoteRecord {
  const created = rel(-daysAgo)
  return {
    id: `orc-${n}`,
    number: `ORC-${created.slice(0, 4)}-${String(n).padStart(4, '0')}`,
    version: 1,
    createdAt: created,
    validUntil: addDays(created, 15),
    sentAt: ['Rascunho', 'Aguardando informações', 'Aguardando aprovação', 'Aprovado internamente'].includes(status) ? null : addDays(created, 1),
    status,
    type,
    clientId,
    siteId,
    ownerId,
    volumeElements: [],
    volumeMargin: '',
    areaElements: [],
    areaMargin: '',
    lines: [],
    extras: defaultExtras(),
    paymentMethodIds: ['pix'],
    paymentTerms: 'À vista na data da concretagem',
    executionDeadline: '',
    notes: '',
    demo: true,
    ...parts,
  }
}

const ext = (p: Partial<QuoteExtras>): QuoteExtras => ({ ...defaultExtras(), ...p })

export const quotes: QuoteRecord[] = [
  q(1, 170, 'Aceito', 'concreto', 'cl-1', 'ob-1', 'u-carla', { volumeElements: [el('Laje', '12', '8', '12'), el('Viga', '30', '0,15', '40', '4')], volumeMargin: '5', lines: [lineFor('c-fck25', 'volume')], extras: ext({ pumping: { mode: 'm3', hours: '', partner: false }, freight: { mode: 'regiao', km: '', regionId: 'r-centro' } }), paymentMethodIds: ['boleto'], paymentTerms: 'Boleto 28 dias' }),
  q(2, 150, 'Aceito', 'piso', 'cl-3', 'ob-4', 'u-carla', { areaElements: [el('Piso', '40', '25', '')], lines: [lineFor('p-polido', 'area')], paymentMethodIds: ['transferencia'], paymentTerms: '30% de entrada e saldo em 30 dias' }),
  q(3, 132, 'Recusado', 'concreto', 'cl-4', 'ob-5', 'u-rafael', { volumeElements: [el('Contrapiso', '20', '10', '6')], lines: [lineFor('c-fck20', 'volume')] }),
  q(4, 118, 'Aceito', 'concreto', 'cl-6', 'ob-7', 'u-carla', { volumeElements: [el('Laje', '22', '15', '14'), el('Pilar', '0,3', '0,3', '300', '16')], volumeMargin: '3', lines: [lineFor('c-fck30', 'volume')], extras: ext({ pumping: { mode: 'hora', hours: '4', partner: true } }), paymentMethodIds: ['boleto'], paymentTerms: 'Faturado em 2 parcelas (28/56 dias)' }),
  q(5, 96, 'Aceito', 'concreto', 'cl-1', 'ob-2', 'u-carla', { volumeElements: [el('Radier', '18', '12', '15')], lines: [lineFor('c-fck25', 'volume'), lineFor('m-fibra', 'volume')], extras: ext({ pumping: { mode: 'fixo', hours: '', partner: false }, freight: { mode: 'km', km: '22', regionId: '' } }), paymentMethodIds: ['boleto'] }),
  q(6, 80, 'Expirado', 'piso', 'cl-7', 'ob-8', 'u-rafael', { areaElements: [el('Piso', '50', '30', '')], lines: [lineFor('p-sarraf', 'area')] }),
  q(7, 64, 'Aceito', 'combinado', 'cl-6', 'ob-7', 'u-carla', { volumeElements: [el('Laje', '22', '15', '14')], areaElements: [el('Piso', '22', '15', '')], lines: [lineFor('c-fck30', 'volume'), lineFor('p-sarraf', 'area')], extras: ext({ pumping: { mode: 'm3', hours: '', partner: false } }), paymentMethodIds: ['boleto'] }),
  q(8, 45, 'Em negociação', 'concreto', 'cl-2', 'ob-3', 'u-rafael', { volumeElements: [el('Laje', '10', '9', '10'), el('Viga', '38', '0,14', '35')], volumeMargin: '5', lines: [lineFor('c-fck25', 'volume')], extras: ext({ freight: { mode: 'regiao', km: '', regionId: 'r-norte' } }), notes: 'Cliente pediu desconto à vista.' }),
  q(9, 33, 'Aceito', 'concreto', 'cl-4', 'ob-5', 'u-rafael', { volumeElements: [el('Contrapiso', '20', '10', '6')], lines: [lineFor('c-fck20', 'volume')], extras: ext({ freight: { mode: 'fixo', km: '', regionId: '' } }) }),
  q(10, 20, 'Enviado ao cliente', 'piso', 'cl-5', 'ob-6', 'u-carla', { areaElements: [el('Garagem', '6', '5', ''), el('Calçada', '12', '1,5', '')], lines: [lineFor('p-sarraf', 'area')] }),
  q(11, 14, 'Enviado ao cliente', 'combinado', 'cl-3', 'ob-4', 'u-carla', { volumeElements: [el('Piso', '40', '25', '12')], areaElements: [el('Piso', '40', '25', '')], lines: [lineFor('c-fck30', 'volume'), lineFor('p-polido', 'area')], extras: ext({ pumping: { mode: 'm3', hours: '', partner: false }, freight: { mode: 'regiao', km: '', regionId: 'r-sul' } }), paymentMethodIds: ['transferencia'] }),
  q(12, 6, 'Aceito', 'concreto', 'cl-1', 'ob-1', 'u-carla', { volumeElements: [el('Laje', '12', '8', '12')], lines: [lineFor('c-fck25', 'volume')], extras: ext({ pumping: { mode: 'm3', hours: '', partner: false } }), paymentMethodIds: ['boleto'] }),
  q(13, 3, 'Aguardando aprovação', 'concreto', 'cl-7', 'ob-8', 'u-rafael', { volumeElements: [el('Calçada', '30', '2', '8')], lines: [{ ...lineFor('c-fck20', 'volume'), discountPct: '8' }] }),
  q(14, 1, 'Rascunho', 'concreto', 'cl-8', 'ob-9', 'u-rafael', { volumeElements: [el('Laje', '7', '6', '10')], lines: [lineFor('c-fck25', 'volume')] }),
]

// ───────────── Funil ─────────────

export interface Opportunity {
  id: string
  title: string
  clientId: string
  siteId: string | null
  stage: StageId
  estimatedValue: number | null
  ownerId: string
  source: string
  enteredAt: string
  lastContact: string | null
  nextContact: string | null
  nextAction: string
  lossReason: string | null
  quoteId: string | null
  history: { at: string; by: string; text: string }[]
  demo: boolean
}

const op = (
  id: string,
  title: string,
  clientId: string,
  siteId: string | null,
  stage: StageId,
  estimatedValue: number | null,
  ownerId: string,
  source: string,
  enteredDaysAgo: number,
  lastContactDaysAgo: number | null,
  nextInDays: number | null,
  nextAction: string,
  quoteId: string | null = null,
): Opportunity => ({
  id, title, clientId, siteId, stage, estimatedValue, ownerId, source,
  enteredAt: rel(-enteredDaysAgo),
  lastContact: lastContactDaysAgo === null ? null : rel(-lastContactDaysAgo),
  nextContact: nextInDays === null ? null : rel(nextInDays),
  nextAction, lossReason: null, quoteId,
  history: [{ at: rel(-enteredDaysAgo), by: 'u-adm', text: 'Oportunidade criada' }],
  demo: true,
})

export const opportunities: Opportunity[] = [
  op('op-1', 'Laje residência', 'cl-2', 'ob-3', 'negociacao', 18500, 'u-rafael', 'WhatsApp 1', 45, 9, -2, 'Retornar sobre desconto à vista', 'orc-8'),
  op('op-2', 'Garagem e calçada', 'cl-5', 'ob-6', 'enviado', 3900, 'u-carla', 'WhatsApp 2', 20, 3, 1, 'Confirmar recebimento da proposta', 'orc-10'),
  op('op-3', 'Piso galpão 3 — etapa 2', 'cl-3', 'ob-4', 'enviado', 128000, 'u-carla', 'Instagram', 14, 14, 0, 'Ligar para Eng. Patrícia', 'orc-11'),
  op('op-4', 'Calçada estacionamento', 'cl-7', 'ob-8', 'elaboracao', 2100, 'u-rafael', 'Outros', 5, 3, 2, 'Aguardar aprovação do desconto', 'orc-13'),
  op('op-5', 'Ampliação casa', 'cl-8', 'ob-9', 'levantamento', null, 'u-rafael', 'Instagram', 18, 16, -6, 'Pedir medidas da laje'),
  op('op-6', 'Novo contato pelo Instagram', 'cl-5', null, 'novo', null, 'u-carla', 'Instagram', 1, null, 0, 'Primeiro atendimento'),
  op('op-7', 'Torre 2 — fundações', 'cl-6', 'ob-7', 'atendimento', 95000, 'u-carla', 'Indicação', 7, 2, 5, 'Visita técnica na obra'),
  op('op-8', 'Bloco B — lajes', 'cl-1', 'ob-1', 'fechado', 21500, 'u-carla', 'Indicação', 8, 6, null, 'Planejar concretagem', 'orc-12'),
  op('op-9', 'Reforma quadra', 'cl-4', 'ob-5', 'perdido', 9000, 'u-rafael', 'Telefone', 60, 40, null, '—'),
  op('op-10', 'Pavimentação interna', 'cl-7', 'ob-8', 'atendimento', null, 'u-rafael', 'WhatsApp 1', 3, 3, 1, 'Enviar ficha de levantamento'),
]
opportunities.find((o) => o.id === 'op-9')!.lossReason = 'Preço'

// ───────────── Agenda / Financeiro (resumo para o painel) ─────────────

export interface ScheduleEvent {
  id: string
  quoteId: string
  date: string
  time: string
  volume: number
  fck: number | null
  service: string
  pump: boolean
  truck: string | null
  status: 'Planejada' | 'Confirmada' | 'Em preparação' | 'Em execução' | 'Concluída' | 'Reagendada' | 'Cancelada'
  demo: boolean
}

export const schedule: ScheduleEvent[] = [
  { id: 'ag-1', quoteId: 'orc-12', date: rel(1), time: '07:30', volume: 12.1, fck: 25, service: 'Laje', pump: true, truck: 'Betoneira 01 (demo)', status: 'Confirmada', demo: true },
  { id: 'ag-2', quoteId: 'orc-7', date: rel(3), time: '08:00', volume: 46.2, fck: 30, service: 'Laje + piso', pump: true, truck: null, status: 'Planejada', demo: true },
  { id: 'ag-3', quoteId: 'orc-9', date: rel(4), time: '13:30', volume: 12, fck: 20, service: 'Contrapiso', pump: false, truck: 'Betoneira 02 (demo)', status: 'Planejada', demo: true },
  { id: 'ag-4', quoteId: 'orc-5', date: rel(-2), time: '07:00', volume: 32.4, fck: 25, service: 'Radier', pump: true, truck: 'Betoneira 01 (demo)', status: 'Concluída', demo: true },
]

/** Parcelas como fração do total calculado do orçamento (valores derivados em derived.ts). */
export interface ReceivableSeed {
  id: string
  quoteId: string
  description: string
  share: number
  paidShare: number
  issuedAt: string
  dueDate: string
  method: string
  cancelled: boolean
  demo: boolean
}

export const receivableSeeds: ReceivableSeed[] = [
  { id: 'cr-1', quoteId: 'orc-1', description: 'Pedido ORC-0001', share: 1, paidShare: 1, issuedAt: rel(-165), dueDate: rel(-137), method: 'Boleto', cancelled: false, demo: true },
  { id: 'cr-2', quoteId: 'orc-2', description: 'Pedido ORC-0002 — entrada 30%', share: 0.3, paidShare: 1, issuedAt: rel(-145), dueDate: rel(-145), method: 'Transferência', cancelled: false, demo: true },
  { id: 'cr-3', quoteId: 'orc-2', description: 'Pedido ORC-0002 — saldo 70%', share: 0.7, paidShare: 0.4, issuedAt: rel(-145), dueDate: rel(-20), method: 'Transferência', cancelled: false, demo: true },
  { id: 'cr-4', quoteId: 'orc-4', description: 'Pedido ORC-0004 — parcela 1/2', share: 0.5, paidShare: 1, issuedAt: rel(-110), dueDate: rel(-82), method: 'Boleto', cancelled: false, demo: true },
  { id: 'cr-5', quoteId: 'orc-4', description: 'Pedido ORC-0004 — parcela 2/2', share: 0.5, paidShare: 0, issuedAt: rel(-110), dueDate: rel(-54), method: 'Boleto', cancelled: false, demo: true },
  { id: 'cr-6', quoteId: 'orc-5', description: 'Pedido ORC-0005', share: 1, paidShare: 0, issuedAt: rel(-2), dueDate: rel(26), method: 'Boleto', cancelled: false, demo: true },
  { id: 'cr-7', quoteId: 'orc-7', description: 'Pedido ORC-0007 — parcela 1/2', share: 0.5, paidShare: 1, issuedAt: rel(-60), dueDate: rel(-32), method: 'Boleto', cancelled: false, demo: true },
  { id: 'cr-8', quoteId: 'orc-7', description: 'Pedido ORC-0007 — parcela 2/2', share: 0.5, paidShare: 0, issuedAt: rel(-60), dueDate: rel(-4), method: 'Boleto', cancelled: false, demo: true },
  { id: 'cr-9', quoteId: 'orc-9', description: 'Pedido ORC-0009', share: 1, paidShare: 0, issuedAt: rel(-30), dueDate: rel(5), method: 'Pix', cancelled: false, demo: true },
  { id: 'cr-10', quoteId: 'orc-12', description: 'Pedido ORC-0012', share: 1, paidShare: 0, issuedAt: rel(-5), dueDate: rel(23), method: 'Boleto', cancelled: false, demo: true },
]

export interface Activity {
  at: string
  by: string
  text: string
  ref: string
}

export const activities: Activity[] = [
  { at: rel(0), by: 'u-carla', text: 'Novo lead recebido via Instagram', ref: 'Juliana Costa Lima' },
  { at: rel(-1), by: 'u-rafael', text: 'Orçamento ORC-0014 criado como rascunho', ref: 'Paulo Henrique Ramos' },
  { at: rel(-2), by: 'u-op', text: 'Concretagem concluída — 32,4 m³ FCK 25', ref: 'Centro Comercial Horizonte' },
  { at: rel(-3), by: 'u-rafael', text: 'Desconto de 8% aguardando aprovação', ref: 'ORC-0013' },
  { at: rel(-6), by: 'u-carla', text: 'Orçamento ORC-0012 aceito pelo cliente', ref: 'Construtora Horizonte' },
  { at: rel(-9), by: 'u-fin', text: 'Pagamento parcial registrado — R$ 20.000,00', ref: 'Galpões Vale Verde' },
]
