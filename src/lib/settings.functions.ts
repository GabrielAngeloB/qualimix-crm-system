import { createServerFn } from '@tanstack/react-start'
import type { AppSettings, PaymentMethod, FunnelStageSetting } from '../data/settings'
import { createDefaultSettings, funnelStages, normalizeSettings, validateSettings } from '../data/settings'
import type { CatalogItem, CommercialRules } from './quote'
import { assertSameOrigin, requireAdmin, requireCurrentProfile } from './auth.server'
import { getPool } from './db.server'
import { isValidIsoDate } from './crm-validation'
import { parseDecimal } from './format'

export type LoadedSettings = AppSettings & {
  /** Identifica se a linha persistida foi encontrada e carregada. */
  settingsReady: boolean
  /** Texto original do timestamptz; preserva precisão para concorrência otimista. */
  settingsUpdatedAt: string | null
}

export type SaveProductInput = Pick<CatalogItem,
  'id' | 'name' | 'description' | 'basePrice' | 'active' | 'validFrom'
> & { internalNotes?: string }

type ProductRow = {
  id: string
  codigo: string
  nome: string
  categoria: CatalogItem['category']
  unidade: CatalogItem['unit']
  descricao: string | null
  preco_base: string | number | null
  preco_demo: string | number | null
  fck: string | number | null
  acabamento: CatalogItem['finish'] | null
  ativo: boolean
  valido_desde: Date | string | null
  observacoes_internas: string | null
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) as unknown } catch { return null }
}

function record(value: unknown): Record<string, unknown> {
  const parsed = parseJson(value)
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {}
}

function array(value: unknown): unknown[] {
  const parsed = parseJson(value)
  return Array.isArray(parsed) ? parsed : []
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function rulesFromDatabase(value: unknown): CommercialRules {
  const defaults = createDefaultSettings().officialRules
  const raw = record(value)
  const freight = record(raw.freight)
  const pumping = record(raw.pumping)
  const minVolume = record(raw.minVolume)
  const stay = record(raw.stay)
  const floor = record(raw.floor)
  const rawRegions = Array.isArray(freight.regions) ? freight.regions : defaults.freight.regions

  return {
    freight: {
      fixed: nullableNumber(freight.fixed),
      perKm: nullableNumber(freight.perKm),
      regions: rawRegions.map((item) => {
        const region = record(item)
        return {
          id: typeof region.id === 'string' ? region.id : '',
          name: typeof region.name === 'string' ? region.name : '',
          price: nullableNumber(region.price),
        }
      }).filter((item) => item.id && item.name),
    },
    pumping: {
      fixed: nullableNumber(pumping.fixed),
      perM3: nullableNumber(pumping.perM3),
      perHour: nullableNumber(pumping.perHour),
      minimum: nullableNumber(pumping.minimum),
    },
    minVolume: {
      m3: nullableNumber(minVolume.m3),
      chargeDifference: minVolume.chargeDifference === true,
      minOrderValue: nullableNumber(minVolume.minOrderValue),
    },
    stay: {
      toleranceMin: nullableNumber(stay.toleranceMin),
      perHour: nullableNumber(stay.perHour),
    },
    floor: { minArea: nullableNumber(floor.minArea) },
    maxDiscountPctWithoutApproval: nullableNumber(raw.maxDiscountPctWithoutApproval),
    validityDays: nullableNumber(raw.validityDays),
    quantityDecimals: Number.isInteger(Number(raw.quantityDecimals))
      ? Math.min(4, Math.max(0, Number(raw.quantityDecimals)))
      : defaults.quantityDecimals,
  }
}

function mapProduct(row: ProductRow, canViewSales: boolean): CatalogItem {
  return {
    id: String(row.id),
    code: row.codigo,
    name: row.nome,
    category: row.categoria,
    unit: row.unidade,
    description: row.descricao ?? '',
    basePrice: canViewSales ? nullableNumber(row.preco_base) : null,
    // Valores de demonstração continuam definidos no código; não são lidos do banco.
    demoPrice: canViewSales ? nullableNumber(row.preco_demo) : null,
    ...(row.fck == null ? {} : { fck: Number(row.fck) }),
    ...(row.acabamento == null ? {} : { finish: row.acabamento }),
    active: Boolean(row.ativo),
    validFrom: row.valido_desde == null
      ? null
      : row.valido_desde instanceof Date
        ? row.valido_desde.toISOString().slice(0, 10)
        : String(row.valido_desde).slice(0, 10),
    internalNotes: row.observacoes_internas ?? '',
  }
}

function buildLoadedSettings(
  row: Record<string, unknown> | null,
  products: ProductRow[],
  canViewSales: boolean,
): LoadedSettings {
  const defaults = createDefaultSettings()
  const rawPaymentMethods = row ? array(row.formas_pagamento) : []
  const paymentMethods: PaymentMethod[] = rawPaymentMethods.map((item) => {
    const method = record(item)
    const id = typeof method.id === 'string' ? method.id : ''
    const fallback = defaults.paymentMethods.find((candidate) => candidate.id === id)
    return {
      id,
      label: typeof method.label === 'string' ? method.label : fallback?.label ?? '',
      enabledOfficial: typeof method.enabled_official === 'boolean'
        ? method.enabled_official
        : typeof method.enabledOfficial === 'boolean'
          ? method.enabledOfficial
          : null,
      enabledDemo: fallback?.enabledDemo ?? false,
    }
  }).filter((method) => method.id && method.label)

  const stageLabels = row ? record(row.etapas_funil_rotulos) : {}
  const stages: FunnelStageSetting[] = funnelStages.map((stage) => ({
    ...stage,
    label: typeof stageLabels[stage.id] === 'string' && String(stageLabels[stage.id]).trim()
      ? String(stageLabels[stage.id]).trim()
      : stage.label,
  }))

  const settings = normalizeSettings({
    catalog: products.map((product) => mapProduct(product, canViewSales)),
    officialRules: canViewSales && row ? rulesFromDatabase(row.regras_oficiais) : defaults.officialRules,
    paymentMethods: paymentMethods.length ? paymentMethods : defaults.paymentMethods,
    company: {
      tradeName: row?.nome_comercial ?? defaults.company.tradeName,
      legalName: row?.razao_social ?? null,
      cnpj: row?.cnpj ?? null,
      address: row?.endereco ?? null,
      phone: row?.telefone ?? null,
      email: row?.email ?? null,
      logoUrl: row?.logo_url ?? null,
    },
    leadSources: row ? array(row.origens_lead) : defaults.leadSources,
    regions: row ? array(row.regioes) : defaults.regions,
    funnelStages: stages,
    lossReasons: row ? array(row.motivos_perda) : defaults.lossReasons,
    clientTypes: row ? array(row.tipos_cliente) : defaults.clientTypes,
    elementTypes: row ? array(row.tipos_elemento) : defaults.elementTypes,
  })

  // O perfil de operação/financeiro não recebe valores nem regras comerciais.
  if (!canViewSales) {
    settings.catalog = settings.catalog.map((product) => ({
      ...product,
      basePrice: null,
      demoPrice: null,
    }))
    settings.officialRules = defaults.officialRules
  }

  return Object.assign(settings, {
    settingsReady: row !== null,
    settingsUpdatedAt: row?.updated_at == null ? null : String(row.updated_at),
  })
}

async function loadProductRows(): Promise<ProductRow[]> {
  const result = await getPool().query<ProductRow>(
    'SELECT id, codigo, nome, categoria, unidade, descricao, preco_base, preco_demo, fck, acabamento, ativo, valido_desde, observacoes_internas ' +
    'FROM public.produtos ORDER BY categoria, nome',
  )
  return result.rows
}

/**
 * Carrega as configurações persistidas e o catálogo completo.
 * Antes da migration/seed existir, mantém defaults explícitos e settingsReady=false.
 */
export const loadSettings = createServerFn({ method: 'GET' }).handler(async (): Promise<LoadedSettings> => {
  const profile = await requireCurrentProfile()
  const isAdmin = profile.perfil === 'admin' || profile.role === 'administrador'
  const canViewSales = isAdmin || profile.role === 'comercial' || profile.role === 'consulta'
  const products = await loadProductRows()

  try {
    const result = await getPool().query<{ config: Record<string, unknown>; updated_at: string }>(
      'SELECT to_jsonb(c) AS config, c.updated_at::text AS updated_at ' +
      "FROM public.configuracoes c WHERE c.id = 'default' LIMIT 1",
    )
    const row = result.rows[0]
    return buildLoadedSettings(
      row ? { ...row.config, updated_at: row.updated_at } : null,
      products,
      canViewSales,
    )
  } catch (error) {
    if ((error as { code?: string })?.code !== '42P01') throw error
    return buildLoadedSettings(null, products, canViewSales)
  }
})

export const saveSettings = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Configurações inválidas.')
    }
    const data = input as Record<string, unknown>
    if (typeof data.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(data.expectedUpdatedAt))) {
      throw new Error('A versão das configurações é inválida. Atualize a página antes de salvar.')
    }
    if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) {
      throw new Error('Informe as configurações que deseja salvar.')
    }
    return {
      settings: validateSettings(data.settings as AppSettings),
      expectedUpdatedAt: data.expectedUpdatedAt,
    }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile = requireAdmin(await requireCurrentProfile())
    const settings = data.settings
    const stageLabels = Object.fromEntries(settings.funnelStages.map((stage) => [stage.id, stage.label]))
    const paymentMethods = settings.paymentMethods.map((method) => ({
      id: method.id,
      label: method.label,
      enabled_official: method.enabledOfficial,
    }))

    const result = await getPool().query<{ updated_at: string }>(
      `UPDATE public.configuracoes
       SET nome_comercial = $1,
           razao_social = $2,
           cnpj = $3,
           endereco = $4,
           telefone = $5,
           email = $6,
           logo_url = $7,
           regras_oficiais = $8::jsonb,
           formas_pagamento = $9::jsonb,
           origens_lead = $10::jsonb,
           regioes = $11::jsonb,
           motivos_perda = $12::jsonb,
           tipos_cliente = $13::jsonb,
           tipos_elemento = $14::jsonb,
           etapas_funil_rotulos = $15::jsonb,
           updated_by = $16
       WHERE id = 'default' AND updated_at = $17::timestamptz
       RETURNING updated_at::text AS updated_at`,
      [
        settings.company.tradeName.trim(),
        settings.company.legalName,
        settings.company.cnpj,
        settings.company.address,
        settings.company.phone,
        settings.company.email,
        settings.company.logoUrl,
        JSON.stringify(settings.officialRules),
        JSON.stringify(paymentMethods),
        JSON.stringify(settings.leadSources),
        JSON.stringify(settings.regions),
        JSON.stringify(settings.lossReasons),
        JSON.stringify(settings.clientTypes),
        JSON.stringify(settings.elementTypes),
        JSON.stringify(stageLabels),
        profile.id,
        data.expectedUpdatedAt,
      ],
    )

    if (!result.rowCount) {
      const current = await getPool().query<{ updated_at: string }>(
        "SELECT updated_at::text AS updated_at FROM public.configuracoes WHERE id = 'default' LIMIT 1",
      )
      if (!current.rows[0]) {
        throw new Error('A configuração principal não foi encontrada. Aplique a migration e o seed de configuracoes antes de salvar.')
      }
      throw new Error('As configurações foram alteradas por outra pessoa. Recarregue os dados antes de salvar novamente.')
    }

    return { success: true, updatedAt: result.rows[0].updated_at }
  })

export const saveProduct = createServerFn({ method: 'POST' })
  .validator((input: unknown): SaveProductInput => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Dados do produto inválidos.')
    }
    const data = input as Record<string, unknown>
    const id = typeof data.id === 'string' ? data.id.trim() : ''
    const name = typeof data.name === 'string' ? data.name.trim() : ''
    const description = typeof data.description === 'string' ? data.description.trim() : ''
    const internalNotes = typeof data.internalNotes === 'string' ? data.internalNotes.trim() : ''
    if (!id || id.length > 80) throw new Error('Produto inválido.')
    if (name.length < 2 || name.length > 180) throw new Error('O nome do produto deve ter entre 2 e 180 caracteres.')
    if (description.length > 1000) throw new Error('A descrição deve ter até 1.000 caracteres.')
    if (internalNotes.length > 5000) throw new Error('As observações internas devem ter até 5.000 caracteres.')
    if (typeof data.active !== 'boolean') throw new Error('O status do produto é inválido.')
    const validFrom = data.validFrom == null || data.validFrom === '' ? null : data.validFrom
    if (validFrom !== null && (typeof validFrom !== 'string' || !isValidIsoDate(validFrom))) {
      throw new Error('A vigência deve ser uma data válida no formato AAAA-MM-DD.')
    }

    const rawPrice = data.basePrice == null ? '' : String(data.basePrice)
    const parsedPrice = parseDecimal(rawPrice)
    if (!parsedPrice.ok) throw new Error('O preço oficial informado é inválido.')
    if (parsedPrice.value !== null && parsedPrice.value < 0) {
      throw new Error('O preço oficial não pode ser negativo.')
    }

    return {
      id,
      name,
      description,
      basePrice: parsedPrice.value,
      active: data.active,
      validFrom,
      internalNotes,
    }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    requireAdmin(await requireCurrentProfile())
    const result = await getPool().query(
      `UPDATE public.produtos
       SET nome = $2,
           descricao = $3,
           preco_base = $4,
           ativo = $5,
           valido_desde = $6,
           observacoes_internas = $7
       WHERE id = $1`,
      [data.id, data.name, data.description, data.basePrice, data.active, data.validFrom, data.internalNotes ?? ''],
    )
    if (!result.rowCount) throw new Error('Produto não encontrado.')
    return { success: true }
  })

export type PublicBranding = { tradeName: string; logoUrl: string | null }

export const getPublicBranding = createServerFn({ method: 'GET' }).handler(async (): Promise<PublicBranding> => {
  try {
    const result = await getPool().query<{ nome_comercial: string | null; logo_url: string | null }>(
      "SELECT nome_comercial, logo_url FROM public.configuracoes WHERE id = 'default' LIMIT 1",
    )
    const row = result.rows[0]
    return {
      tradeName: row?.nome_comercial?.trim() || 'Qualimix',
      logoUrl: row?.logo_url ?? null,
    }
  } catch (error) {
    if ((error as { code?: string })?.code !== '42P01') throw error
    return { tradeName: 'Qualimix', logoUrl: null }
  }
})
