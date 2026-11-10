import type { CatalogItem, CommercialRules } from '../lib/quote'

/**
 * Catálogo inicial. `basePrice` é o preço oficial e permanece null até a
 * Qualimix confirmar a tabela comercial. `demoPrice` é FICTÍCIO e só é usado
 * quando o modo demonstração está ativo.
 */
export const catalog: CatalogItem[] = [
  { id: 'c-fck20', code: 'CON-20', name: 'Concreto usinado FCK 20 MPa', category: 'concreto', unit: 'm³', description: 'Concreto usinado convencional, resistência característica de 20 MPa', basePrice: null, demoPrice: 395, fck: 20, active: true, validFrom: null },
  { id: 'c-fck25', code: 'CON-25', name: 'Concreto usinado FCK 25 MPa', category: 'concreto', unit: 'm³', description: 'Concreto usinado convencional, resistência característica de 25 MPa', basePrice: null, demoPrice: 420, fck: 25, active: true, validFrom: null },
  { id: 'c-fck30', code: 'CON-30', name: 'Concreto usinado FCK 30 MPa', category: 'concreto', unit: 'm³', description: 'Concreto usinado convencional, resistência característica de 30 MPa', basePrice: null, demoPrice: 450, fck: 30, active: true, validFrom: null },
  { id: 'p-polido', code: 'PIS-POL', name: 'Piso de concreto polido', category: 'piso', unit: 'm²', description: 'Execução de piso com acabamento polido', basePrice: null, demoPrice: 68, finish: 'polido', active: true, validFrom: null },
  { id: 'p-sarraf', code: 'PIS-SAR', name: 'Piso de concreto sarrafeado', category: 'piso', unit: 'm²', description: 'Execução de piso com acabamento sarrafeado', basePrice: null, demoPrice: 42, finish: 'sarrafeado', active: true, validFrom: null },
  { id: 's-bomba', code: 'SRV-BOM', name: 'Bombeamento (item avulso)', category: 'bombeamento', unit: 'un', description: 'Serviço de bombeamento lançado como item. Prefira a regra de bombeamento.', basePrice: null, demoPrice: 900, active: true, validFrom: null },
  { id: 's-frete', code: 'SRV-FRE', name: 'Frete (item avulso)', category: 'frete', unit: 'viagem', description: 'Frete lançado como item. Prefira a regra de frete.', basePrice: null, demoPrice: 180, active: true, validFrom: null },
  { id: 's-estadia', code: 'SRV-EST', name: 'Estadia (item avulso)', category: 'estadia', unit: 'h', description: 'Hora adicional de caminhão na obra', basePrice: null, demoPrice: 220, active: true, validFrom: null },
  { id: 's-lancamento', code: 'SRV-LAN', name: 'Serviço extra de lançamento', category: 'servico', unit: 'h', description: 'Mão de obra adicional de lançamento', basePrice: null, demoPrice: 150, active: true, validFrom: null },
  { id: 'm-fibra', code: 'MAT-FIB', name: 'Adição de fibra', category: 'material', unit: 'm³', description: 'Adição de fibra ao concreto', basePrice: null, demoPrice: 38, active: true, validFrom: null },
]

export const categoryLabel: Record<CatalogItem['category'], string> = {
  concreto: 'Concreto',
  piso: 'Piso',
  bombeamento: 'Bombeamento',
  frete: 'Frete',
  estadia: 'Estadia',
  servico: 'Serviço',
  material: 'Material',
  equipamento: 'Equipamento',
}

/** Regras oficiais: nada confirmado ainda pela Qualimix → tudo pendente. */
export const officialRules: CommercialRules = {
  freight: {
    fixed: null,
    perKm: null,
    regions: [
      { id: 'r-centro', name: 'Região Central', price: null },
      { id: 'r-norte', name: 'Região Norte', price: null },
      { id: 'r-sul', name: 'Região Sul', price: null },
    ],
  },
  pumping: { fixed: null, perM3: null, perHour: null, minimum: null },
  minVolume: { m3: null, chargeDifference: false, minOrderValue: null },
  stay: { toleranceMin: null, perHour: null },
  floor: { minArea: null },
  maxDiscountPctWithoutApproval: null,
  validityDays: null,
  quantityDecimals: 2,
}

/** Regras FICTÍCIAS — exclusivas do modo demonstração. */
export const demoRules: CommercialRules = {
  freight: {
    fixed: 250,
    perKm: 6.5,
    regions: [
      { id: 'r-centro', name: 'Região Central', price: 150 },
      { id: 'r-norte', name: 'Região Norte', price: 280 },
      { id: 'r-sul', name: 'Região Sul', price: 320 },
    ],
  },
  pumping: { fixed: 950, perM3: 28, perHour: 310, minimum: 700 },
  minVolume: { m3: 3, chargeDifference: true, minOrderValue: null },
  stay: { toleranceMin: 30, perHour: 220 },
  floor: { minArea: 50 },
  maxDiscountPctWithoutApproval: 5,
  validityDays: 15,
  quantityDecimals: 2,
}

export interface PaymentMethod {
  id: string
  label: string
  /** null = ainda não confirmado pela Qualimix */
  enabledOfficial: boolean | null
  enabledDemo: boolean
}

export const paymentMethods: PaymentMethod[] = [
  { id: 'pix', label: 'Pix', enabledOfficial: null, enabledDemo: true },
  { id: 'boleto', label: 'Boleto', enabledOfficial: null, enabledDemo: true },
  { id: 'cartao', label: 'Cartão', enabledOfficial: null, enabledDemo: false },
  { id: 'transferencia', label: 'Transferência', enabledOfficial: null, enabledDemo: true },
  { id: 'faturamento', label: 'Faturamento', enabledOfficial: null, enabledDemo: false },
]

/** Dados institucionais: preenchidos pelo administrador. Nada é inventado. */
export const company = {
  tradeName: 'Qualimix',
  legalName: null as string | null,
  cnpj: null as string | null,
  address: null as string | null,
  phone: null as string | null,
  email: null as string | null,
  logoUrl: null as string | null,
}

export const leadSources = [
  'Não informado',
  'WhatsApp 1',
  'WhatsApp 2',
  'Instagram',
  'Indicação',
  'Telefone',
  'Outros',
] as const

export const regions = ['Região Central', 'Região Norte', 'Região Sul']

export const clientTypes = [
  'Pessoa física',
  'Empresa',
  'Construtora',
  'Empreiteiro',
  'Outro',
] as const

export const elementTypes = [
  'Laje',
  'Laje H8',
  'Laje H10',
  'Laje H12',
  'Laje H15',
  'Laje H20',
  'Viga',
  'Viga baldrame',
  'Pilar',
  'Sapata',
  'Estaca',
  'Tubulão',
  'Radier',
  'Contrapiso',
  'Piso',
  'Calçada',
  'Baldrame',
  'Escada',
  'Outro',
]

export const funnelStages = [
  { id: 'novo', label: 'Novo lead' },
  { id: 'atendimento', label: 'Em atendimento' },
  { id: 'levantamento', label: 'Levantamento de informações' },
  { id: 'elaboracao', label: 'Orçamento em elaboração' },
  { id: 'enviado', label: 'Orçamento enviado' },
  { id: 'negociacao', label: 'Em negociação' },
  { id: 'fechado', label: 'Fechado' },
  { id: 'perdido', label: 'Perdido' },
] as const
export type StageId = (typeof funnelStages)[number]['id']

export const lossReasons = [
  'Preço',
  'Prazo de entrega',
  'Fechou com concorrente',
  'Obra adiada ou cancelada',
  'Sem retorno do cliente',
  'Fora da região atendida',
  'Outro',
]

export const quoteStatuses = [
  'Rascunho',
  'Aguardando informações',
  'Aguardando aprovação',
  'Aprovado internamente',
  'Enviado ao cliente',
  'Em negociação',
  'Aceito',
  'Recusado',
  'Expirado',
  'Cancelado',
] as const
export type QuoteStatus = (typeof quoteStatuses)[number]



export interface CompanySettings {
  tradeName: string
  legalName: string | null
  cnpj: string | null
  address: string | null
  phone: string | null
  email: string | null
  logoUrl: string | null
}

export type FunnelStageSetting = { id: StageId; label: string }

export interface AppSettings {
  catalog: CatalogItem[]
  officialRules: CommercialRules
  demoRules: CommercialRules
  paymentMethods: PaymentMethod[]
  company: CompanySettings
  leadSources: string[]
  regions: string[]
  funnelStages: FunnelStageSetting[]
  lossReasons: string[]
  clientTypes: string[]
  elementTypes: string[]
}

function copyRules(rules: CommercialRules): CommercialRules {
  return {
    ...rules,
    freight: { ...rules.freight, regions: rules.freight.regions.map((region) => ({ ...region })) },
    pumping: { ...rules.pumping },
    minVolume: { ...rules.minVolume },
    stay: { ...rules.stay },
    floor: { ...rules.floor },
  }
}

export function createDefaultSettings(): AppSettings {
  return {
    catalog: catalog.map((item) => ({ ...item })),
    officialRules: copyRules(officialRules),
    demoRules: copyRules(demoRules),
    paymentMethods: paymentMethods.map((method) => ({ ...method })),
    company: { ...company },
    leadSources: [...leadSources],
    regions: [...regions],
    funnelStages: funnelStages.map((stage) => ({ ...stage })),
    lossReasons: [...lossReasons],
    clientTypes: [...clientTypes],
    elementTypes: [...elementTypes],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeRules(base: CommercialRules, value: unknown): CommercialRules {
  if (!isRecord(value)) return copyRules(base)
  const raw = value as Partial<CommercialRules>
  const freight: Record<string, unknown> = isRecord(raw.freight) ? raw.freight : {}
  const pumping = isRecord(raw.pumping) ? raw.pumping : {}
  const minVolume = isRecord(raw.minVolume) ? raw.minVolume : {}
  const stay = isRecord(raw.stay) ? raw.stay : {}
  const floor = isRecord(raw.floor) ? raw.floor : {}
  return {
    ...base,
    ...raw,
    freight: {
      ...base.freight,
      ...freight,
      regions: Array.isArray(freight.regions) ? freight.regions as CommercialRules['freight']['regions'] : base.freight.regions.map((region) => ({ ...region })),
    },
    pumping: { ...base.pumping, ...pumping },
    minVolume: { ...base.minVolume, ...minVolume },
    stay: { ...base.stay, ...stay },
    floor: { ...base.floor, ...floor },
  }
}

/** Mescla configurações salvas sem perder campos novos adicionados em versões futuras. */
export function normalizeSettings(value: unknown): AppSettings {
  const base = createDefaultSettings()
  if (!isRecord(value)) return base
  const raw = value as Partial<AppSettings>
  const stringList = (input: unknown, fallback: string[]) =>
    Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : [...fallback]
  const stageList = Array.isArray(raw.funnelStages)
    ? base.funnelStages.map((stage, index) => {
        const candidate = raw.funnelStages?.[index]
        return { ...stage, label: isRecord(candidate) && typeof candidate.label === 'string' && candidate.label.trim() ? candidate.label.trim() : stage.label }
      })
    : base.funnelStages
  return {
    ...base,
    catalog: Array.isArray(raw.catalog) ? raw.catalog as CatalogItem[] : base.catalog,
    officialRules: mergeRules(base.officialRules, raw.officialRules),
    demoRules: mergeRules(base.demoRules, raw.demoRules),
    paymentMethods: Array.isArray(raw.paymentMethods) ? raw.paymentMethods as PaymentMethod[] : base.paymentMethods,
    company: { ...base.company, ...(isRecord(raw.company) ? raw.company : {}) } as CompanySettings,
    leadSources: stringList(raw.leadSources, base.leadSources),
    regions: stringList(raw.regions, base.regions),
    funnelStages: stageList,
    lossReasons: stringList(raw.lossReasons, base.lossReasons),
    clientTypes: stringList(raw.clientTypes, base.clientTypes),
    elementTypes: stringList(raw.elementTypes, base.elementTypes),
  }
}

function hasDuplicates(values: string[]): boolean {
  const normalized = values.map((value) => value.trim().toLocaleLowerCase('pt-BR'))
  return new Set(normalized).size !== normalized.length
}

export function validateSettings(value: AppSettings): AppSettings {
  const listInputs = [value.leadSources, value.regions, value.lossReasons, value.clientTypes, value.elementTypes]
  if (listInputs.some((list) => !Array.isArray(list) || list.some((item) => typeof item !== 'string' || !item.trim()))) {
    throw new Error('Os cadastros de apoio não podem conter nomes vazios.')
  }
  if (listInputs.some((list) => hasDuplicates(list))) {
    throw new Error('Remova os nomes repetidos das listas de apoio antes de confirmar.')
  }
  const next = normalizeSettings(value)
  if (!next.company.tradeName.trim()) throw new Error('Informe o nome comercial da empresa.')
  if (next.catalog.some((item) => !item.id.trim() || !item.code.trim() || !item.name.trim())) throw new Error('Cada produto precisa ter código e nome.')
  if (hasDuplicates(next.catalog.map((item) => item.code))) throw new Error('Existem códigos repetidos no catálogo.')
  if (next.paymentMethods.some((method) => !method.id.trim() || !method.label.trim())) throw new Error('Cada forma de pagamento precisa ter um nome.')
  if (hasDuplicates(next.leadSources) || hasDuplicates(next.regions) || hasDuplicates(next.lossReasons) || hasDuplicates(next.clientTypes) || hasDuplicates(next.elementTypes)) {
    throw new Error('Remova os nomes repetidos das listas de apoio antes de confirmar.')
  }
  if (next.leadSources[0] !== 'Não informado') {
    throw new Error('A origem "Não informado" precisa permanecer como a primeira opção do funil.')
  }
  if (next.funnelStages.some((stage) => !stage.label.trim())) {
    throw new Error('Todas as etapas do funil precisam ter um rótulo.')
  }
  if (next.paymentMethods.some((method) => method.enabledOfficial !== null && typeof method.enabledOfficial !== 'boolean')) {
    throw new Error('O status de cada forma de pagamento deve ser aceita, não aceita ou a confirmar.')
  }
  if (next.officialRules.maxDiscountPctWithoutApproval !== null &&
      (!Number.isFinite(next.officialRules.maxDiscountPctWithoutApproval) ||
        next.officialRules.maxDiscountPctWithoutApproval < 0 || next.officialRules.maxDiscountPctWithoutApproval > 100)) {
    throw new Error('O desconto sem aprovação deve estar entre 0 e 100%.')
  }
  if (typeof next.officialRules.minVolume.chargeDifference !== 'boolean') {
    throw new Error('Informe se a diferença até o volume mínimo deve ser cobrada.')
  }
  if (next.officialRules.validityDays !== null &&
      (!Number.isInteger(next.officialRules.validityDays) || next.officialRules.validityDays < 1 || next.officialRules.validityDays > 365)) {
    throw new Error('A validade padrão deve ser um número inteiro entre 1 e 365 dias.')
  }
  if (!Number.isInteger(next.officialRules.quantityDecimals) || next.officialRules.quantityDecimals < 0 || next.officialRules.quantityDecimals > 4) {
    throw new Error('As casas decimais de quantidade devem estar entre 0 e 4.')
  }
  if (next.officialRules.freight.regions.some((region) => !next.regions.includes(region.name))) {
    throw new Error('Os nomes das regiões de frete precisam corresponder aos cadastros de regiões.')
  }
  if (!Number.isInteger(next.demoRules.quantityDecimals) || next.demoRules.quantityDecimals < 0 || next.demoRules.quantityDecimals > 4) {
    throw new Error('As casas decimais de demonstração devem estar entre 0 e 4.')
  }
  const prices = [
    ...next.catalog.flatMap((item) => [item.basePrice, item.demoPrice]),
    next.officialRules.freight.fixed, next.officialRules.freight.perKm,
    next.demoRules.freight.fixed, next.demoRules.freight.perKm,
    next.officialRules.pumping.fixed, next.officialRules.pumping.perM3, next.officialRules.pumping.perHour, next.officialRules.pumping.minimum,
    next.demoRules.pumping.fixed, next.demoRules.pumping.perM3, next.demoRules.pumping.perHour, next.demoRules.pumping.minimum,
    next.officialRules.minVolume.m3, next.officialRules.minVolume.minOrderValue, next.demoRules.minVolume.m3, next.demoRules.minVolume.minOrderValue,
    next.officialRules.stay.toleranceMin, next.officialRules.stay.perHour, next.demoRules.stay.toleranceMin, next.demoRules.stay.perHour,
    next.officialRules.floor.minArea, next.demoRules.floor.minArea,
    ...next.officialRules.freight.regions.map((region) => region.price),
    ...next.demoRules.freight.regions.map((region) => region.price),
  ]
  if (prices.some((price) => price !== null && (!Number.isFinite(price) || price < 0))) throw new Error('Preços, prazos e limites não podem ser negativos ou inválidos.')
  return next
}

/** Itens que ainda precisam ser confirmados pela empresa. */
export function pendingSettings(settings: AppSettings = createDefaultSettings()): string[] {
  const p: string[] = []
  const missingPrices = settings.catalog.filter((item) => item.basePrice === null).length
  if (missingPrices) p.push(String(missingPrices) + ' preços do catálogo')
  if (!settings.company.cnpj || !settings.company.legalName || !settings.company.address)
    p.push('Dados institucionais (razão social, CNPJ e endereço)')
  if (settings.officialRules.freight.fixed === null && settings.officialRules.freight.perKm === null && settings.officialRules.freight.regions.every((region) => region.price === null))
    p.push('Regras de frete')
  if (settings.officialRules.pumping.fixed === null && settings.officialRules.pumping.perM3 === null && settings.officialRules.pumping.perHour === null)
    p.push('Regras de bombeamento')
  if (settings.officialRules.minVolume.m3 === null) p.push('Volume mínimo')
  if (settings.officialRules.stay.perHour === null) p.push('Regras de estadia')
  if (settings.paymentMethods.every((method) => method.enabledOfficial === null))
    p.push('Formas de pagamento aceitas')
  if (settings.officialRules.validityDays === null) p.push('Validade padrão das propostas')
  return p
}
