/**
 * Motor de cálculo de orçamentos da Qualimix.
 *
 * Funções puras, sem dependência de interface: as mesmas regras serão
 * reaproveitadas no servidor para validar o orçamento antes de salvar/emitir.
 *
 * Princípios:
 * - Preço ausente NUNCA é tratado como R$ 0,00 → fica "pendente" e bloqueia a
 *   emissão definitiva.
 * - Valores intermediários (volume, área) mantêm precisão total; o
 *   arredondamento comercial ocorre apenas na quantidade cobrada (casas
 *   configuráveis) e em centavos no valor de cada linha.
 * - Dinheiro é somado em centavos inteiros para evitar erros de ponto flutuante.
 */
import { parseDecimal, roundHalfUp, toCents } from './format'

export type Unit = 'm³' | 'm²' | 'un' | 'h' | 'km' | 'viagem' | 'diária'
export type Category =
  | 'concreto'
  | 'piso'
  | 'bombeamento'
  | 'frete'
  | 'estadia'
  | 'servico'
  | 'material'
  | 'equipamento'

export interface CatalogItem {
  id: string
  code: string
  name: string
  category: Category
  unit: Unit
  description: string
  /** Preço oficial da Qualimix. null = pendente de configuração. */
  basePrice: number | null
  /** Valor fictício usado somente no modo demonstração. */
  demoPrice: number | null
  fck?: number
  finish?: 'polido' | 'sarrafeado'
  active: boolean
  validFrom: string | null
  internalNotes?: string
}

export interface CommercialRules {
  freight: {
    fixed: number | null
    perKm: number | null
    regions: { id: string; name: string; price: number | null }[]
  }
  pumping: {
    fixed: number | null
    perM3: number | null
    perHour: number | null
    minimum: number | null
  }
  minVolume: {
    m3: number | null
    chargeDifference: boolean
    minOrderValue: number | null
  }
  stay: { toleranceMin: number | null; perHour: number | null }
  floor: { minArea: number | null }
  /** Desconto (%) permitido sem aprovação. null = não configurado (todo desconto exige aprovação). */
  maxDiscountPctWithoutApproval: number | null
  validityDays: number | null
  /** Casas decimais da quantidade cobrada em m³/m². */
  quantityDecimals: number
}

// ───────────────────────── Medições ─────────────────────────

export type MeasureKind = 'volume' | 'area'

export interface MeasureElement {
  id: string
  label: string
  elementType: string
  mode: 'dimensoes' | 'informado'
  /** Comprimento (m); para pilares, representa a altura. */
  length: string
  /** Largura (m). */
  width: string
  /** Campo legado em centímetros. Mantido para orçamentos antigos e lajes sem tipo H selecionado. */
  thicknessCm: string
  /** Profundidade/espessura (m), usada por vigas, pilares, sapatas, radier e contrapiso. */
  depth?: string
  /** Diâmetro (m), usado por estacas e tubulões. */
  diameter?: string
  /** Índice comercial de volume por metro linear (m³/m), para escadas. */
  factor?: string
  count: string
  informed: string
  notes: string
}

export interface ElementResult {
  value: number | null
  error: string | null
  incomplete: boolean
}

function positive(raw: string, label: string, required = true) {
  const p = parseDecimal(raw)
  if (!p.ok) return { error: `${label}: número inválido` }
  if (p.value === null)
    return required ? { missing: true as const } : { value: null }
  if (p.value <= 0) return { error: `${label} deve ser maior que zero` }
  return { value: p.value }
}

const normalizedType = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

const result = (value: number): ElementResult => ({
  value,
  error: null,
  incomplete: false,
})

const incomplete = (): ElementResult => ({
  value: null,
  error: null,
  incomplete: true,
})

const invalid = (message: string): ElementResult => ({
  value: null,
  error: message,
  incomplete: false,
})

/**
 * Medidas lineares são informadas em metros, exceto thicknessCm (campo legado)
 * e a altura nominal H8/H10/H12… das lajes (centímetros).
 *
 * Volume (m³):
 * - Laje Hn: comprimento × largura × (n ÷ 100) × quantidade
 * - Viga/baldrame/sapata/radier/contrapiso: comprimento × largura × profundidade × quantidade
 * - Pilar: altura × largura × espessura × quantidade
 * - Estaca/tubulão: π × (diâmetro ÷ 2)² × profundidade × quantidade
 * - Escada: metro linear × índice comercial configurável (m³ por metro)
 *
 * Área (m²) de piso/calçada: comprimento × largura × quantidade.
 */
export function computeElement(
  el: MeasureElement,
  kind: MeasureKind,
): ElementResult {
  if (el.mode === 'informado') {
    const v = positive(el.informed, kind === 'volume' ? 'Volume' : 'Área')
    if ('error' in v) return invalid(v.error!)
    if ('missing' in v) return incomplete()
    return result(v.value!)
  }

  const type = normalizedType(el.elementType)
  const pileType = type === 'estaca' || type === 'estacas' || type === 'tubulao'
  const stairType = type === 'escada'
  const volumeOnly =
    type.startsWith('laje') ||
    type === 'viga' ||
    type === 'viga baldrame' ||
    type === 'viga baltrame' ||
    type === 'baldrame' ||
    type === 'pilar' ||
    type === 'sapata' ||
    type === 'radier' ||
    type === 'contrapiso' ||
    pileType ||
    stairType

  if (kind === 'area' && volumeOnly)
    return invalid('O elemento ' + el.elementType + ' é calculado em m³. Use a calculadora de volume.')

  const countRaw = (el.count ?? '').trim() === '' ? '1' : el.count
  const N = positive(countRaw, 'Quantidade')
  if ('error' in N) return invalid(N.error!)
  if ('value' in N && N.value !== null && !Number.isInteger(N.value))
    return invalid('Quantidade de elementos deve ser um número inteiro')
  if ('missing' in N) return incomplete()
  const n = N.value!

  // Escada: índice comercial editável, aplicado por metro linear.
  if (kind === 'volume' && stairType) {
    const length = positive(el.length ?? '', 'Metro linear')
    const factor = positive(el.factor ?? '', 'Índice de cálculo (m³ por metro)')
    for (const field of [length, factor])
      if ('error' in field) return invalid(field.error!)
    if ('missing' in length || 'missing' in factor) return incomplete()
    return result(length.value! * factor.value! * n)
  }

  // Estacas/tubulões: seção circular πr²h, multiplicada pela quantidade.
  if (kind === 'volume' && pileType) {
    const diameter = positive(el.diameter ?? '', 'Diâmetro')
    const depth = positive(el.depth ?? '', 'Profundidade')
    for (const field of [diameter, depth])
      if ('error' in field) return invalid(field.error!)
    if ('missing' in diameter || 'missing' in depth) return incomplete()
    const radius = diameter.value! / 2
    return result(Math.PI * radius * radius * depth.value! * n)
  }

  const L = positive(el.length ?? '', type === 'pilar' ? 'Altura' : 'Comprimento')
  const W = positive(el.width ?? '', 'Largura')
  for (const field of [L, W])
    if ('error' in field) return invalid(field.error!)
  if ('missing' in L || 'missing' in W) return incomplete()
  const length = L.value!
  const width = W.value!

  // Pisos/calçadas são apresentados por área no orçamento (m²).
  if (kind === 'area') return result(length * width * n)

  // Laje com altura nominal selecionada (H8, H10, H12, H15, H20…).
  const slabHeight = type.match(/^laje\s*h\s*(\d+(?:[.,]\d+)?)$/i)
  if (slabHeight) {
    const heightCm = positive(slabHeight[1].replace(',', '.'), 'Altura da laje')
    if ('error' in heightCm) return invalid(heightCm.error!)
    if ('missing' in heightCm) return incomplete()
    return result(length * width * (heightCm.value! / 100) * n)
  }

  // Profundidade/espessura em metros. thicknessCm é fallback para registros antigos.
  const legacyThicknessRaw = (el.thicknessCm ?? '').trim()
  const legacyThickness = parseDecimal(legacyThicknessRaw)
  const depthRaw =
    (el.depth ?? '').trim() !== ''
      ? el.depth!
      : legacyThicknessRaw === ''
        ? ''
        : legacyThickness.ok && legacyThickness.value !== null
          ? String(legacyThickness.value / 100)
          : legacyThicknessRaw
  const depthLabel = type === 'pilar' ? 'Espessura' : 'Profundidade/espessura'
  const depth = positive(depthRaw, depthLabel)
  if ('error' in depth) return invalid(depth.error!)
  if ('missing' in depth) return incomplete()

  return result(length * width * depth.value! * n)
}
export interface MeasureSummary {
  kind: MeasureKind
  /** Soma geométrica sem margem (precisão total) */
  base: number
  marginPct: number
  marginValue: number
  /** Valor estimado para orçamento (base + margem), precisão total */
  estimated: number
  validCount: number
  errors: { id: string; message: string }[]
  marginError: string | null
}

export function summarizeMeasures(
  elements: MeasureElement[],
  marginRaw: string,
  kind: MeasureKind,
): MeasureSummary {
  let base = 0
  let validCount = 0
  const errors: { id: string; message: string }[] = []
  for (const el of elements) {
    const r = computeElement(el, kind)
    if (r.error) errors.push({ id: el.id, message: r.error })
    else if (r.value !== null) {
      base += r.value
      validCount++
    }
  }
  let marginPct = 0
  let marginError: string | null = null
  const m = parseDecimal(marginRaw)
  if (!m.ok) marginError = 'Margem inválida'
  else if (m.value !== null) {
    if (m.value < 0 || m.value > 100)
      marginError = 'A margem deve estar entre 0% e 100%'
    else marginPct = m.value
  }
  const marginValue = base * (marginPct / 100)
  return {
    kind,
    base,
    marginPct,
    marginValue,
    estimated: base + marginValue,
    validCount,
    errors,
    marginError,
  }
}

// ───────────────────────── Itens ─────────────────────────

export interface QuoteLine {
  id: string
  catalogId: string | null
  description: string
  unit: Unit
  category: Category
  /** volume/área = quantidade vem da calculadora */
  quantityMode: 'manual' | 'volume' | 'area'
  quantity: string
  /** Vazio = usar preço do catálogo */
  unitPriceInput: string
  discountPct: string
}

export type PriceSource = 'tabela' | 'manual' | 'demonstracao' | 'pendente'

export interface ComputedLine {
  id: string
  quantity: number | null
  unitPrice: number | null
  priceSource: PriceSource
  grossCents: number | null
  discountPct: number
  discountCents: number
  netCents: number | null
  errors: string[]
}

export type IssueLevel = 'bloqueio' | 'aprovacao' | 'aviso'
export interface Issue {
  level: IssueLevel
  message: string
  lineId?: string
}

export interface QuoteExtras {
  freight: { mode: 'nao' | 'fixo' | 'km' | 'regiao'; km: string; regionId: string }
  pumping: {
    mode: 'nao' | 'fixo' | 'm3' | 'hora'
    hours: string
    partner: boolean
  }
  stay: { include: boolean; hours: string }
  applyMinVolume: boolean
  globalDiscount: string
}

export const defaultExtras = (): QuoteExtras => ({
  freight: { mode: 'nao', km: '', regionId: '' },
  pumping: { mode: 'nao', hours: '', partner: false },
  stay: { include: false, hours: '' },
  applyMinVolume: true,
  globalDiscount: '',
})

export interface QuoteInput {
  clientId: string | null
  siteId: string | null
  lines: QuoteLine[]
  volume: MeasureSummary
  area: MeasureSummary
  extras: QuoteExtras
  paymentMethodIds: string[]
}

export interface QuoteContext {
  catalog: CatalogItem[]
  rules: CommercialRules
  /** Usa preços/regra fictícios do modo demonstração quando não há preço oficial */
  demoPrices: boolean
  enabledPaymentMethodIds: string[]
}

export interface Additional {
  key: 'frete' | 'bombeamento' | 'estadia' | 'volume-minimo'
  label: string
  detail: string
  quantity: number | null
  unit: string
  unitPrice: number | null
  cents: number | null
}

export interface QuoteResult {
  lines: ComputedLine[]
  concreteVolume: number
  floorArea: number
  itemsGrossCents: number | null
  lineDiscountCents: number
  additionals: Additional[]
  additionalsCents: number | null
  globalDiscountCents: number
  totalCents: number | null
  /** Soma apenas dos valores conhecidos — nunca apresentar como total */
  knownCents: number
  pendingCount: number
  issues: Issue[]
  needsApproval: boolean
  /** Sem bloqueios: pode gerar proposta (aprovação interna pode ser exigida) */
  canIssue: boolean
}

export function resolvePrice(
  line: QuoteLine,
  item: CatalogItem | undefined,
  demoPrices: boolean,
): { price: number | null; source: PriceSource; error: string | null } {
  if (line.unitPriceInput.trim() !== '') {
    const p = parseDecimal(line.unitPriceInput)
    if (!p.ok) return { price: null, source: 'pendente', error: 'Preço inválido' }
    if (p.value !== null && p.value < 0)
      return { price: null, source: 'pendente', error: 'Preço não pode ser negativo' }
    return { price: p.value, source: 'manual', error: null }
  }
  if (item?.basePrice != null)
    return { price: item.basePrice, source: 'tabela', error: null }
  if (demoPrices && item?.demoPrice != null)
    return { price: item.demoPrice, source: 'demonstracao', error: null }
  return { price: null, source: 'pendente', error: null }
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function computeQuote(input: QuoteInput, ctx: QuoteContext): QuoteResult {
  const { rules } = ctx
  const issues: Issue[] = []
  const dec = rules.quantityDecimals

  if (!input.clientId)
    issues.push({ level: 'bloqueio', message: 'Selecione o cliente' })
  if (!input.siteId)
    issues.push({ level: 'bloqueio', message: 'Selecione a obra' })
  if (input.lines.length === 0)
    issues.push({ level: 'bloqueio', message: 'Adicione ao menos um item' })

  for (const s of [input.volume, input.area])
    if (s.errors.length || s.marginError)
      issues.push({
        level: 'bloqueio',
        message: `Corrija as medições de ${s.kind === 'volume' ? 'volume' : 'área'}`,
      })

  const lines: ComputedLine[] = input.lines.map((line) => {
    const errors: string[] = []
    const item = ctx.catalog.find((c) => c.id === line.catalogId)
    let quantity: number | null = null
    if (line.quantityMode === 'manual') {
      const q = parseDecimal(line.quantity)
      if (!q.ok) errors.push('Quantidade inválida')
      else if (q.value === null) errors.push('Informe a quantidade')
      else if (q.value <= 0) errors.push('Quantidade deve ser maior que zero')
      else quantity = q.value
    } else {
      const s = line.quantityMode === 'volume' ? input.volume : input.area
      if (s.estimated <= 0)
        errors.push(
          line.quantityMode === 'volume'
            ? 'Calcule o volume na calculadora'
            : 'Calcule a área na calculadora',
        )
      else quantity = roundHalfUp(s.estimated, dec)
    }

    const price = resolvePrice(line, item, ctx.demoPrices)
    if (price.error) errors.push(price.error)
    if (price.source === 'pendente' && !price.error)
      issues.push({
        level: 'bloqueio',
        message: `Preço pendente de configuração: ${line.description}`,
        lineId: line.id,
      })
    if (price.source === 'manual')
      issues.push({
        level: 'aprovacao',
        message: `Preço informado manualmente em "${line.description}"`,
        lineId: line.id,
      })
    if (price.source === 'manual' && price.price === 0)
      issues.push({
        level: 'aviso',
        message: `Preço R$ 0,00 informado explicitamente em "${line.description}"`,
        lineId: line.id,
      })
    if (item && !item.active)
      issues.push({
        level: 'aviso',
        message: `Produto inativo no catálogo: ${item.name}`,
        lineId: line.id,
      })

    let discountPct = 0
    const d = parseDecimal(line.discountPct)
    if (!d.ok) errors.push('Desconto inválido')
    else if (d.value !== null) {
      if (d.value < 0 || d.value > 100)
        errors.push('Desconto deve estar entre 0% e 100%')
      else discountPct = d.value
    }

    for (const e of errors)
      issues.push({
        level: 'bloqueio',
        message: `${line.description}: ${e}`,
        lineId: line.id,
      })

    const grossCents =
      quantity !== null && price.price !== null && !errors.length
        ? toCents(quantity * price.price)
        : null
    const discountCents =
      grossCents !== null ? Math.round((grossCents * discountPct) / 100) : 0
    return {
      id: line.id,
      quantity,
      unitPrice: price.price,
      priceSource: price.source,
      grossCents,
      discountPct,
      discountCents,
      netCents: grossCents !== null ? grossCents - discountCents : null,
      errors,
    }
  })

  const byCat = (cat: Category) =>
    input.lines
      .map((l, i) => ({ l, c: lines[i] }))
      .filter((x) => x.l.category === cat)

  const concreteVolume = sum(byCat('concreto').map((x) => x.c.quantity ?? 0))
  const floorArea = sum(byCat('piso').map((x) => x.c.quantity ?? 0))

  // ── Adicionais (regras configuráveis) ──
  const additionals: Additional[] = []
  const ex = input.extras

  const dup = (cat: Category, active: boolean, label: string) => {
    if (active && byCat(cat).length)
      issues.push({
        level: 'bloqueio',
        message: `${label} cobrado duas vezes: remova o item manual ou desative a regra`,
      })
  }
  dup('frete', ex.freight.mode !== 'nao', 'Frete')
  dup('bombeamento', ex.pumping.mode !== 'nao', 'Bombeamento')
  dup('estadia', ex.stay.include, 'Estadia')

  const pendingRule = (msg: string) =>
    issues.push({ level: 'bloqueio', message: msg })

  // Frete
  if (ex.freight.mode !== 'nao') {
    const f = rules.freight
    const a: Additional = {
      key: 'frete',
      label: 'Frete',
      detail: '',
      quantity: null,
      unit: '',
      unitPrice: null,
      cents: null,
    }
    if (ex.freight.mode === 'fixo') {
      a.detail = 'Valor fixo'
      a.quantity = 1
      a.unit = 'un'
      a.unitPrice = f.fixed
      if (f.fixed === null) pendingRule('Regra de frete fixo não configurada')
      else a.cents = toCents(f.fixed)
    } else if (ex.freight.mode === 'km') {
      const km = parseDecimal(ex.freight.km)
      a.unit = 'km'
      a.unitPrice = f.perKm
      if (!km.ok || km.value === null || km.value <= 0)
        pendingRule('Informe a distância do frete em km (maior que zero)')
      else {
        a.quantity = km.value
        a.detail = `Por quilômetro`
        if (f.perKm === null) pendingRule('Valor do frete por km não configurado')
        else a.cents = toCents(km.value * f.perKm)
      }
    } else {
      const r = f.regions.find((x) => x.id === ex.freight.regionId)
      a.quantity = 1
      a.unit = 'un'
      if (!r) pendingRule('Selecione a região do frete')
      else {
        a.detail = `Região: ${r.name}`
        a.unitPrice = r.price
        if (r.price === null)
          pendingRule(`Valor do frete para a região ${r.name} não configurado`)
        else a.cents = toCents(r.price)
      }
    }
    additionals.push(a)
  }

  // Bombeamento
  if (ex.pumping.mode !== 'nao') {
    const p = rules.pumping
    const a: Additional = {
      key: 'bombeamento',
      label: 'Bombeamento',
      detail: ex.pumping.partner ? 'Executado por parceiro' : '',
      quantity: null,
      unit: '',
      unitPrice: null,
      cents: null,
    }
    let raw: number | null = null
    if (ex.pumping.mode === 'fixo') {
      a.quantity = 1
      a.unit = 'un'
      a.unitPrice = p.fixed
      if (p.fixed === null) pendingRule('Valor fixo de bombeamento não configurado')
      else raw = p.fixed
    } else if (ex.pumping.mode === 'm3') {
      a.unit = 'm³'
      a.unitPrice = p.perM3
      if (concreteVolume <= 0)
        pendingRule('Sem volume de concreto para calcular o bombeamento por m³')
      else {
        a.quantity = concreteVolume
        if (p.perM3 === null)
          pendingRule('Valor de bombeamento por m³ não configurado')
        else raw = concreteVolume * p.perM3
      }
    } else {
      const h = parseDecimal(ex.pumping.hours)
      a.unit = 'h'
      a.unitPrice = p.perHour
      if (!h.ok || h.value === null || h.value <= 0)
        pendingRule('Informe as horas de bombeamento (maior que zero)')
      else {
        a.quantity = h.value
        if (p.perHour === null)
          pendingRule('Valor de bombeamento por hora não configurado')
        else raw = h.value * p.perHour
      }
    }
    if (raw !== null) {
      let cents = toCents(raw)
      if (p.minimum !== null && cents < toCents(p.minimum)) {
        cents = toCents(p.minimum)
        a.detail = [a.detail, 'Valor mínimo aplicado'].filter(Boolean).join(' · ')
      }
      a.cents = cents
    }
    additionals.push(a)
  }

  // Estadia
  if (ex.stay.include) {
    const h = parseDecimal(ex.stay.hours)
    const a: Additional = {
      key: 'estadia',
      label: 'Estadia',
      detail:
        rules.stay.toleranceMin !== null
          ? `Horas além da tolerância de ${rules.stay.toleranceMin} min`
          : 'Tolerância não configurada',
      quantity: null,
      unit: 'h',
      unitPrice: rules.stay.perHour,
      cents: null,
    }
    if (!h.ok || h.value === null || h.value <= 0)
      pendingRule('Informe as horas de estadia previstas (maior que zero)')
    else {
      a.quantity = h.value
      if (rules.stay.perHour === null)
        pendingRule('Valor da hora de estadia não configurado')
      else a.cents = toCents(h.value * rules.stay.perHour)
    }
    additionals.push(a)
  }

  // Volume mínimo
  const minV = rules.minVolume.m3
  if (concreteVolume > 0) {
    if (minV === null)
      issues.push({
        level: 'aviso',
        message: 'Volume mínimo de pedido ainda não configurado',
      })
    else if (concreteVolume < minV && ex.applyMinVolume) {
      const diff = roundHalfUp(minV - concreteVolume, dec)
      if (rules.minVolume.chargeDifference) {
        const firstConcrete = byCat('concreto')[0]?.c
        const price = firstConcrete?.unitPrice ?? null
        additionals.push({
          key: 'volume-minimo',
          label: 'Complemento de volume mínimo',
          detail: `Pedido de ${concreteVolume.toLocaleString('pt-BR')} m³ abaixo do mínimo de ${minV.toLocaleString('pt-BR')} m³`,
          quantity: diff,
          unit: 'm³',
          unitPrice: price,
          cents: price !== null ? toCents(diff * price) : null,
        })
        if (price === null)
          pendingRule('Complemento de volume mínimo sem preço de concreto definido')
      } else
        issues.push({
          level: 'aviso',
          message: `Volume abaixo do mínimo de ${minV.toLocaleString('pt-BR')} m³`,
        })
    }
  }

  // Piso: área mínima
  if (floorArea > 0 && rules.floor.minArea !== null && floorArea < rules.floor.minArea)
    issues.push({
      level: 'aviso',
      message: `Área de piso abaixo do mínimo de ${rules.floor.minArea.toLocaleString('pt-BR')} m²`,
    })

  // ── Totais ──
  const itemsGrossCents = lines.some((l) => l.grossCents === null)
    ? null
    : sum(lines.map((l) => l.grossCents!))
  const lineDiscountCents = sum(lines.map((l) => l.discountCents))
  const additionalsCents = additionals.some((a) => a.cents === null)
    ? null
    : sum(additionals.map((a) => a.cents!))

  const knownItemsNet = sum(lines.map((l) => l.netCents ?? 0))
  const knownAdd = sum(additionals.map((a) => a.cents ?? 0))

  let globalDiscountCents = 0
  const gd = parseDecimal(ex.globalDiscount)
  if (!gd.ok) pendingRule('Desconto geral inválido')
  else if (gd.value !== null) {
    if (gd.value < 0) pendingRule('Desconto geral não pode ser negativo')
    else {
      globalDiscountCents = toCents(gd.value)
      if (globalDiscountCents > knownItemsNet + knownAdd)
        pendingRule('Desconto geral maior que o valor do orçamento')
    }
  }

  // Aprovação de descontos
  const limit = rules.maxDiscountPctWithoutApproval
  input.lines.forEach((l, i) => {
    const pctv = lines[i].discountPct
    if (pctv > 0 && (limit === null || pctv > limit))
      issues.push({
        level: 'aprovacao',
        message:
          limit === null
            ? `Desconto de ${pctv.toLocaleString('pt-BR')}% em "${l.description}" (limite não configurado)`
            : `Desconto de ${pctv.toLocaleString('pt-BR')}% em "${l.description}" acima do limite de ${limit.toLocaleString('pt-BR')}%`,
        lineId: l.id,
      })
  })
  if (globalDiscountCents > 0) {
    const base = knownItemsNet + knownAdd
    const gpct = base > 0 ? (globalDiscountCents / base) * 100 : 100
    if (limit === null || gpct > limit)
      issues.push({
        level: 'aprovacao',
        message: `Desconto geral de ${gpct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% exige aprovação`,
      })
  }

  const totalCents =
    itemsGrossCents === null || additionalsCents === null
      ? null
      : itemsGrossCents - lineDiscountCents + additionalsCents - globalDiscountCents

  if (
    totalCents !== null &&
    rules.minVolume.minOrderValue !== null &&
    totalCents < toCents(rules.minVolume.minOrderValue)
  )
    issues.push({
      level: 'aviso',
      message: 'Total abaixo do valor mínimo de pedido configurado',
    })

  if (input.paymentMethodIds.length === 0)
    issues.push({ level: 'aviso', message: 'Defina a forma de pagamento' })
  for (const id of input.paymentMethodIds)
    if (!ctx.enabledPaymentMethodIds.includes(id))
      issues.push({
        level: 'bloqueio',
        message: 'Forma de pagamento selecionada não está habilitada nas configurações',
      })

  const pendingCount =
    lines.filter((l) => l.priceSource === 'pendente').length +
    additionals.filter((a) => a.cents === null).length

  return {
    lines,
    concreteVolume,
    floorArea,
    itemsGrossCents,
    lineDiscountCents,
    additionals,
    additionalsCents,
    globalDiscountCents,
    totalCents,
    knownCents: knownItemsNet + knownAdd - globalDiscountCents,
    pendingCount,
    issues: dedupeIssues(issues),
    needsApproval: issues.some((i) => i.level === 'aprovacao'),
    canIssue: !issues.some((i) => i.level === 'bloqueio') && totalCents !== null,
  }
}

function dedupeIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>()
  return issues.filter((i) => {
    const k = i.level + i.message
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
