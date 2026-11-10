import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createFileRoute, useBlocker } from '@tanstack/react-router'
import { CircleCheck, Lock, TriangleAlert } from 'lucide-react'
import type { AppSettings, CompanySettings } from '../data/settings'
import { categoryLabel, pendingSettings } from '../data/settings'
import type { CatalogItem } from '../lib/quote'
import { useStore } from '../data/store'
import { brl, num, parseDecimal } from '../lib/format'
import { formatDocument, formatPhone, isValidCNPJ, onlyDigits } from '../lib/documents'
import { Badge, Button, Card, CardHeader, PageHeader, cx, inputCls } from '../components/ui'

export const Route = createFileRoute('/configuracoes')({
  head: () => ({
    meta: [
      { title: 'Configurações — Qualimix CRM' },
      { name: 'description', content: 'Pendências de preços, regras comerciais, dados institucionais e perfis de acesso da Qualimix.' },
      { property: 'og:title', content: 'Configurações — Qualimix CRM' },
      { property: 'og:description', content: 'O que falta confirmar para emitir propostas com valores oficiais.' },
    ],
  }),
  component: Configuracoes,
})

const v = (x: number | null, fmt: (n: number) => string = brl) => (
  x === null ? <Badge tone="warn">Pendente</Badge> : <span className="tabular">{fmt(x)}</span>
)

const permissions: [string, string[]][] = [
  ['Administrador', ['Preços e regras comerciais', 'Usuários e permissões', 'Todos os módulos']],
  ['Comercial', ['Clientes, obras e leads', 'Funil e orçamentos', 'Descontos dentro do limite']],
  ['Operação', ['Consulta de pedidos', 'Agenda de concretagens', 'Caminhões e viagens']],
  ['Financeiro', ['Contas a receber', 'Registro de pagamentos', 'Relatórios financeiros']],
  ['Consulta', ['Somente leitura']],
]

type CompanyDraft = {
  tradeName: string
  legalName: string
  cnpj: string
  phone: string
  email: string
  address: string
  logoUrl: string
}

function toCompanyDraft(company: CompanySettings): CompanyDraft {
  const digits = onlyDigits(company.cnpj ?? '')
  return {
    tradeName: company.tradeName ?? '',
    legalName: company.legalName ?? '',
    cnpj: digits ? formatDocument(digits) : '',
    phone: company.phone ?? '',
    email: company.email ?? '',
    address: company.address ?? '',
    logoUrl: company.logoUrl ?? '',
  }
}

function isHttpsUrl(raw: string): boolean {
  if (!raw.trim()) return true
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}

function PendingValue({ value, children }: { value: string | null | undefined; children?: ReactNode }) {
  return value?.trim()
    ? <>{children ?? value}</>
    : <Badge tone="warn">A preencher</Badge>
}

function CompanySettingsEditor({
  company,
  onSave,
  onDirtyChange,
  onToast,
}: {
  company: CompanySettings
  onSave: (company: CompanySettings) => Promise<void>
  onDirtyChange: (dirty: boolean) => void
  onToast: (title: string, body: string) => void
}) {
  const [draft, setDraft] = useState<CompanyDraft>(() => toCompanyDraft(company))
  const [savedDraft, setSavedDraft] = useState<CompanyDraft>(() => toCompanyDraft(company))
  const [saving, setSaving] = useState(false)
  const [logoPreviewFailed, setLogoPreviewFailed] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft)

  useEffect(() => {
    if (!dirty) {
      const next = toCompanyDraft(company)
      setDraft(next)
      setSavedDraft(next)
    }
  }, [company, dirty])

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  const cnpjDigits = onlyDigits(draft.cnpj)
  const errors = {
    tradeName: draft.tradeName.trim() ? null : 'O nome comercial é obrigatório.',
    cnpj: cnpjDigits && !isValidCNPJ(cnpjDigits) ? 'Informe um CNPJ válido com 14 dígitos.' : null,
    email: draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())
      ? 'Informe um e-mail válido.'
      : null,
    logoUrl: draft.logoUrl.trim() && !isHttpsUrl(draft.logoUrl)
      ? 'A logo precisa usar uma URL HTTPS válida.'
      : null,
  }
  const hasErrors = Object.values(errors).some(Boolean)
  const logoUrlIsPreviewable = draft.logoUrl.trim() && !errors.logoUrl && !logoPreviewFailed

  const update = <K extends keyof CompanyDraft>(key: K, value: CompanyDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const discard = () => {
    setDraft(savedDraft)
    setLogoPreviewFailed(false)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (hasErrors || !dirty) return
    setSaving(true)
    try {
      await onSave({
        tradeName: draft.tradeName.trim(),
        legalName: draft.legalName.trim() || null,
        cnpj: cnpjDigits || null,
        phone: draft.phone.trim() || null,
        email: draft.email.trim() || null,
        address: draft.address.trim() || null,
        logoUrl: draft.logoUrl.trim() || null,
      })
      setSavedDraft(draft)
    } catch (error) {
      onToast('Não foi possível salvar os dados institucionais', error instanceof Error ? error.message : 'Erro ao salvar os dados.')
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof CompanyDraft, options: {
    type?: string
    required?: boolean
    placeholder?: string
    error?: string | null
    onValue?: (value: string) => void
  } = {}) => (
    <label className="block min-w-0 text-sm" key={key}>
      <span className="mb-1 block text-[13px] font-semibold text-ink-2">
        {label}{options.required && <span className="text-brand"> *</span>}
      </span>
      <input
        type={options.type ?? 'text'}
        value={draft[key]}
        onChange={(event) => options.onValue ? options.onValue(event.target.value) : update(key, event.target.value)}
        placeholder={options.placeholder ?? 'A preencher'}
        aria-invalid={Boolean(options.error)}
        className={inputCls(Boolean(options.error))}
      />
      {options.error && <span className="mt-1 block text-xs font-medium text-brand" role="alert">{options.error}</span>}
      {!draft[key].trim() && <span className="mt-1 block"><Badge tone="warn">A preencher</Badge></span>}
    </label>
  )

  return (
    <form onSubmit={(event) => void save(event)} className="p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {field('Nome comercial', 'tradeName', { required: true, error: errors.tradeName })}
        {field('Razão social', 'legalName')}
        {field('CNPJ', 'cnpj', {
          placeholder: '00.000.000/0000-00',
          error: errors.cnpj,
          onValue: (value) => {
            const digits = onlyDigits(value).slice(0, 14)
            update('cnpj', digits ? formatDocument(digits) : '')
          },
        })}
        {field('Telefone', 'phone', { type: 'tel', placeholder: '(00) 00000-0000' })}
        {field('E-mail', 'email', { type: 'email', error: errors.email })}
        <label className="block min-w-0 text-sm sm:col-span-2">
          <span className="mb-1 block text-[13px] font-semibold text-ink-2">Endereço</span>
          <textarea
            value={draft.address}
            onChange={(event) => update('address', event.target.value)}
            rows={2}
            placeholder="A preencher"
            className={cx(inputCls(), 'h-auto min-h-20 py-2')}
          />
          {!draft.address.trim() && <span className="mt-1 block"><Badge tone="warn">A preencher</Badge></span>}
        </label>
        {field('Logo (URL HTTPS)', 'logoUrl', {
          type: 'url',
          placeholder: 'https://exemplo.com/logo.png',
          error: errors.logoUrl,
          onValue: (value) => {
            setLogoPreviewFailed(false)
            update('logoUrl', value)
          },
        })}
        <div className="flex min-h-20 items-center gap-3 rounded-md border border-dashed border-line p-3">
          {logoUrlIsPreviewable
            ? <img src={draft.logoUrl.trim()} alt="Prévia da logo institucional" onError={() => setLogoPreviewFailed(true)} className="max-h-16 max-w-40 object-contain" />
            : <span className="text-xs text-muted">{draft.logoUrl.trim() ? 'Prévia indisponível para esta URL.' : 'A prévia da logo aparecerá aqui.'}</span>}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="text-xs text-muted">
          {dirty ? <Badge tone="warn">Alterações não salvas</Badge> : 'Dados institucionais sincronizados.'}
          {dirty && <span className="ml-2">Campos vazios serão salvos como null.</span>}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={!dirty || saving} onClick={discard}>Descartar</Button>
          <Button type="submit" variant="primary" disabled={!dirty || hasErrors || saving}>
            {saving ? 'Salvando…' : 'Salvar dados institucionais'}
          </Button>
        </div>
      </div>
    </form>
  )
}

type ProductDraft = {
  name: string
  description: string
  basePrice: string
  validFrom: string
  active: boolean
}

function toProductDraft(product: CatalogItem): ProductDraft {
  return {
    name: product.name,
    description: product.description ?? '',
    basePrice: product.basePrice === null ? '' : num(product.basePrice, 2),
    validFrom: product.validFrom ?? '',
    active: product.active,
  }
}

function ProductRow({
  product,
  isAdmin,
  demoMode,
  onSave,
  onDirtyChange,
  onToast,
}: {
  product: CatalogItem
  isAdmin: boolean
  demoMode: boolean
  onSave: (product: {
    id: string
    name: string
    description: string
    basePrice: number | null
    validFrom: string | null
    active: boolean
  }) => Promise<void>
  onDirtyChange: (id: string, dirty: boolean) => void
  onToast: (title: string, body: string) => void
}) {
  const [draft, setDraft] = useState<ProductDraft>(() => toProductDraft(product))
  const [savedDraft, setSavedDraft] = useState<ProductDraft>(() => toProductDraft(product))
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft)
  const parsedPrice = parseDecimal(draft.basePrice)
  const errors = {
    name: draft.name.trim().length < 2 ? 'Informe um nome com pelo menos 2 caracteres.' : draft.name.length > 180 ? 'O nome deve ter até 180 caracteres.' : null,
    description: draft.description.length > 1000 ? 'A descrição deve ter até 1.000 caracteres.' : null,
    basePrice: !parsedPrice.ok ? 'Informe um preço válido.' : parsedPrice.value !== null && parsedPrice.value < 0 ? 'O preço não pode ser negativo.' : null,
  }
  const hasErrors = Object.values(errors).some(Boolean)

  useEffect(() => {
    if (!dirty) {
      const next = toProductDraft(product)
      setDraft(next)
      setSavedDraft(next)
    }
  }, [product, dirty])

  useEffect(() => {
    onDirtyChange(product.id, dirty)
  }, [dirty, onDirtyChange, product.id])

  const update = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const discard = () => setDraft(savedDraft)

  const save = async () => {
    if (!parsedPrice.ok || parsedPrice.value !== null && parsedPrice.value < 0 || hasErrors || !dirty) return
    setSaving(true)
    try {
      await onSave({
        id: product.id,
        name: draft.name.trim(),
        description: draft.description.trim(),
        basePrice: parsedPrice.value,
        validFrom: draft.validFrom || null,
        active: draft.active,
      })
      setSavedDraft(draft)
    } catch (error) {
      onToast('Não foi possível salvar o produto', error instanceof Error ? error.message : 'Erro ao salvar o produto.')
    } finally {
      setSaving(false)
    }
  }

  const productErrors = hasErrors && dirty

  return (
    <tr className={cx('border-b border-line last:border-0', dirty && 'bg-warn-soft/30')}>
      <td className="px-3 py-3 font-mono text-xs">{product.code}</td>
      <td className="min-w-64 px-3 py-3">
        {isAdmin ? (
          <div className="space-y-2">
            <div>
              <input
                aria-label={'Nome do produto ' + product.code}
                value={draft.name}
                onChange={(event) => update('name', event.target.value)}
                className={inputCls(productErrors && Boolean(errors.name))}
              />
              {productErrors && errors.name && <p className="mt-1 text-xs text-brand" role="alert">{errors.name}</p>}
            </div>
            <div>
              <textarea
                aria-label={'Descrição do produto ' + product.code}
                value={draft.description}
                onChange={(event) => update('description', event.target.value)}
                rows={2}
                className={cx(inputCls(productErrors && Boolean(errors.description)), 'h-auto min-h-16 py-2 text-xs')}
              />
              {productErrors && errors.description && <p className="mt-1 text-xs text-brand" role="alert">{errors.description}</p>}
            </div>
          </div>
        ) : (
          <>
            <p className="font-semibold">{product.name}</p>
            <p className="mt-1 text-xs text-muted">{product.description || <Badge tone="warn">A preencher</Badge>}</p>
          </>
        )}
      </td>
      <td className="px-3 py-3">{categoryLabel[product.category]}</td>
      <td className="px-3 py-3">{product.unit}</td>
      <td className="px-3 py-3 text-right">
        {isAdmin ? (
          <div className="min-w-32">
            <input
              aria-label={'Preço oficial de ' + product.code}
              inputMode="decimal"
              value={draft.basePrice}
              onChange={(event) => update('basePrice', event.target.value)}
              placeholder="A preencher"
              className={cx(inputCls(productErrors && Boolean(errors.basePrice)), 'text-right tabular')}
            />
            {productErrors && errors.basePrice
              ? <p className="mt-1 text-xs text-brand" role="alert">{errors.basePrice}</p>
              : !draft.basePrice.trim() && <span className="mt-1 block text-left"><Badge tone="warn">A preencher</Badge></span>}
          </div>
        ) : v(product.basePrice)}
      </td>
      {demoMode && <td className="px-3 py-3 text-right text-muted">{product.demoPrice === null ? <Badge tone="warn">A preencher</Badge> : brl(product.demoPrice)}</td>}
      <td className="px-3 py-3">
        {isAdmin ? (
          <div className="min-w-28 space-y-2">
            <select
              aria-label={'Status de ' + product.code}
              value={draft.active ? 'ativo' : 'inativo'}
              onChange={(event) => update('active', event.target.value === 'ativo')}
              className={cx(inputCls(), 'h-9 text-sm')}
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
            <label className="block text-xs text-muted">
              Vigência desde
              <input
                aria-label={'Vigência desde de ' + product.code}
                type="date"
                value={draft.validFrom}
                onChange={(event) => update('validFrom', event.target.value)}
                className={cx(inputCls(), 'mt-1 h-9 text-xs')}
              />
            </label>
            {!draft.validFrom && <Badge tone="warn">Vigência a preencher</Badge>}
          </div>
        ) : (
          <div className="space-y-1">
            <Badge tone={product.active ? 'ok' : 'neutral'}>{product.active ? 'Ativo' : 'Inativo'}</Badge>
            <p className="text-xs text-muted">Desde: {product.validFrom || '—'}</p>
          </div>
        )}
      </td>
      {isAdmin && (
        <td className="px-3 py-3 text-right">
          <div className="flex flex-col items-end gap-2">
            {dirty && <Badge tone="warn">Não salvo</Badge>}
            <div className="flex gap-1">
              <Button size="sm" type="button" variant="secondary" disabled={!dirty || saving} onClick={discard}>Descartar</Button>
              <Button size="sm" type="button" variant="primary" disabled={!dirty || hasErrors || saving} onClick={() => void save()}>
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>
        </td>
      )}
    </tr>
  )
}


type RuleNumericFieldProps = {
  id: string
  label: string
  value: number | null
  onChange: (value: number | null) => void
  onValidityChange: (id: string, valid: boolean) => void
  min?: number
  max?: number
  integer?: boolean
  suffix?: string
}

function RuleNumericField({ id, label, value, onChange, onValidityChange, min = 0, max, integer = false, suffix }: RuleNumericFieldProps) {
  const [raw, setRaw] = useState(value === null ? '' : String(value).replace('.', ','))
  const [error, setError] = useState('')
  useEffect(() => {
    setRaw(value === null ? '' : String(value).replace('.', ','))
  }, [value])
  const change = (next: string) => {
    setRaw(next)
    if (!next.trim()) {
      setError('')
      onValidityChange(id, true)
      onChange(null)
      return
    }
    const parsed = parseDecimal(next)
    let message = ''
    if (!parsed.ok) message = 'Informe um número válido.'
    else if (parsed.value !== null && parsed.value < min) message = 'O valor mínimo é ' + min + '.'
    else if (max !== undefined && parsed.value !== null && parsed.value > max) message = 'O valor máximo é ' + max + '.'
    else if (integer && parsed.value !== null && !Number.isInteger(parsed.value)) message = 'Informe um número inteiro.'
    setError(message)
    onValidityChange(id, !message)
    if (!message && parsed.ok) onChange(parsed.value)
  }
  return (
    <label className="block min-w-0 text-sm">
      <span className="mb-1 block text-xs font-semibold text-ink-2">{label}{suffix ? ' (' + suffix + ')' : ''}</span>
      <input inputMode="decimal" value={raw} onChange={(event) => change(event.target.value)} placeholder="Pendente" aria-invalid={Boolean(error)} className={inputCls(Boolean(error))} />
      {error ? <span role="alert" className="mt-1 block text-xs text-brand">{error}</span> : value === null ? <span className="mt-1 block"><Badge tone="warn">Pendente</Badge></span> : null}
    </label>
  )
}

type SupportListKey = 'leadSources' | 'regions' | 'lossReasons' | 'clientTypes' | 'elementTypes'

function RemainingSettingsEditor({
  settings,
  isAdmin,
  settingsReady,
  onSave,
  onDirtyChange,
  onToast,
}: {
  settings: AppSettings
  isAdmin: boolean
  settingsReady: boolean
  onSave: (settings: AppSettings) => Promise<void>
  onDirtyChange: (dirty: boolean) => void
  onToast: (title: string, body: string) => void
}) {
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [saved, setSaved] = useState<AppSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({})
  const [newItems, setNewItems] = useState<Record<string, string>>({})
  const [listErrors, setListErrors] = useState<Record<string, string>>({})
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  useEffect(() => {
    if (!dirty) {
      setDraft(settings)
      setSaved(settings)
    }
  }, [settings, dirty])
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])

  const update = (mutate: (next: AppSettings) => void) => {
    setDraft((current) => {
      const next = JSON.parse(JSON.stringify(current)) as AppSettings
      mutate(next)
      return next
    })
  }
  const setRule = (path: string, value: number | null) => update((next) => {
    const r = next.officialRules
    switch (path) {
      case 'freight.fixed': r.freight.fixed = value; break
      case 'freight.perKm': r.freight.perKm = value; break
      case 'pumping.fixed': r.pumping.fixed = value; break
      case 'pumping.perM3': r.pumping.perM3 = value; break
      case 'pumping.perHour': r.pumping.perHour = value; break
      case 'pumping.minimum': r.pumping.minimum = value; break
      case 'minVolume.m3': r.minVolume.m3 = value; break
      case 'minVolume.minOrderValue': r.minVolume.minOrderValue = value; break
      case 'stay.toleranceMin': r.stay.toleranceMin = value; break
      case 'stay.perHour': r.stay.perHour = value; break
      case 'floor.minArea': r.floor.minArea = value; break
      case 'maxDiscountPctWithoutApproval': r.maxDiscountPctWithoutApproval = value; break
      case 'validityDays': r.validityDays = value; break
      case 'quantityDecimals': if (value !== null) r.quantityDecimals = value; break
    }
  })
  const numeric = (id: string, label: string, value: number | null, path: string, options: { min?: number; max?: number; integer?: boolean; suffix?: string } = {}) => (
    <RuleNumericField key={id} id={id} label={label} value={value} onChange={(next) => setRule(path, next)}
      onValidityChange={(field, valid) => setInvalidFields((current) => ({ ...current, [field]: !valid }))}
      min={options.min ?? 0} max={options.max} integer={options.integer} suffix={options.suffix} />
  )
  const regionRule = (id: string, name: string, value: number | null) => (
    <RuleNumericField key={id} id={'freight-region-' + id} label={'Frete — ' + name} value={value}
      onChange={(next) => update((settings) => { const region = settings.officialRules.freight.regions.find((item) => item.id === id); if (region) region.price = next })}
      onValidityChange={(field, valid) => setInvalidFields((current) => ({ ...current, [field]: !valid }))}
    />
  )
  const setPayment = (id: string, value: string) => update((next) => {
    const method = next.paymentMethods.find((item) => item.id === id)
    if (method) method.enabledOfficial = value === 'pending' ? null : value === 'accepted'
  })
  const updateList = (key: SupportListKey, values: string[]) => update((next) => {
    next[key] = values
  })
  const addItem = (key: SupportListKey) => {
    const value = (newItems[key] ?? '').trim()
    if (!value) { setListErrors((current) => ({ ...current, [key]: 'Digite um nome antes de adicionar.' })); return }
    if (draft[key].some((item) => item.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR'))) {
      setListErrors((current) => ({ ...current, [key]: 'Esse nome já existe na lista.' })); return
    }
    if (key === 'regions') {
      const id = 'reg-' + value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36)
      update((next) => {
        next.regions = [...next.regions, value]
        next.officialRules.freight.regions = [...next.officialRules.freight.regions, { id, name: value, price: null }]
      })
    } else updateList(key, [...draft[key], value])
    setNewItems((current) => ({ ...current, [key]: '' }))
    setListErrors((current) => ({ ...current, [key]: '' }))
  }
  const renameItem = (key: SupportListKey, index: number, value: string) => {
    const clean = value.trim()
    if (!clean) { setListErrors((current) => ({ ...current, [key]: 'O nome não pode ficar vazio.' })); return }
    if (draft[key].some((item, i) => i !== index && item.toLocaleLowerCase('pt-BR') === clean.toLocaleLowerCase('pt-BR'))) {
      setListErrors((current) => ({ ...current, [key]: 'Esse nome já existe na lista.' })); return
    }
    const old = draft[key][index]
    const values = [...draft[key]]
    values[index] = clean
    if (key === 'regions') update((next) => {
      next.regions = values
      next.officialRules.freight.regions = next.officialRules.freight.regions.map((region) => region.name === old ? { ...region, name: clean } : region)
    })
    else updateList(key, values)
    setListErrors((current) => ({ ...current, [key]: '' }))
  }
  const removeItem = (key: SupportListKey, index: number) => {
    if (key === 'leadSources' && index === 0) return
    const item = draft[key][index]
    if (!window.confirm('Remover "' + item + '"? Verifique antes se esse valor já foi usado em registros existentes. A remoção não altera o histórico já salvo.')) return
    const values = draft[key].filter((_, i) => i !== index)
    if (key === 'regions') update((next) => {
      next.regions = values
      const removed = next.officialRules.freight.regions.find((region) => region.name === item)
      next.officialRules.freight.regions = next.officialRules.freight.regions.filter((region) => region.name !== item)
      if (removed) next.officialRules.freight.regions = next.officialRules.freight.regions
    })
    else updateList(key, values)
  }
  const moveItem = (key: SupportListKey, index: number, delta: number) => {
    if (key === 'leadSources' && index === 0) return
    const target = index + delta
    if (target < (key === 'leadSources' ? 1 : 0) || target >= draft[key].length) return
    const values = [...draft[key]]
    ;[values[index], values[target]] = [values[target], values[index]]
    updateList(key, values)
  }
  const save = async () => {
    if (!dirty || Object.values(invalidFields).some(Boolean) || Object.values(listErrors).some(Boolean)) return
    setSaving(true)
    try {
      await onSave(draft)
      setSaved(draft)
      onToast('Configurações salvas', 'Regras comerciais, pagamentos e cadastros de apoio foram atualizados.')
    } catch (error) {
      onToast('Não foi possível salvar as configurações', error instanceof Error ? error.message : 'Erro ao salvar.')
    } finally { setSaving(false) }
  }
  const discard = () => { setDraft(saved); setInvalidFields({}); setListErrors({}); setNewItems({}) }
  const lists: { key: SupportListKey; label: string }[] = [
    { key: 'leadSources', label: 'Origens de lead' },
    { key: 'regions', label: 'Regiões' },
    { key: 'lossReasons', label: 'Motivos de perda' },
    { key: 'clientTypes', label: 'Tipos de cliente' },
    { key: 'elementTypes', label: 'Tipos de elemento' },
  ]
  if (!settingsReady) return <Card><SettingsSkeleton rows={10} /></Card>
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Regras comerciais oficiais" subtitle="Campos vazios permanecem pendentes. Valores precisam ser iguais ou maiores que zero." action={isAdmin && <Badge tone={dirty ? 'warn' : 'ok'}>{dirty ? 'Alterações pendentes' : 'Sincronizado'}</Badge>} />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {isAdmin ? <>
            {numeric('freight-fixed', 'Frete — valor fixo', draft.officialRules.freight.fixed, 'freight.fixed')}
            {numeric('freight-km', 'Frete — por km', draft.officialRules.freight.perKm, 'freight.perKm')}
            {draft.officialRules.freight.regions.map((region) => regionRule(region.id, region.name, region.price))}
            {numeric('pump-fixed', 'Bombeamento — fixo', draft.officialRules.pumping.fixed, 'pumping.fixed')}
            {numeric('pump-m3', 'Bombeamento — por m³', draft.officialRules.pumping.perM3, 'pumping.perM3')}
            {numeric('pump-hour', 'Bombeamento — por hora', draft.officialRules.pumping.perHour, 'pumping.perHour')}
            {numeric('pump-min', 'Bombeamento — mínimo', draft.officialRules.pumping.minimum, 'pumping.minimum')}
            {numeric('min-volume', 'Volume mínimo', draft.officialRules.minVolume.m3, 'minVolume.m3', { suffix: 'm³' })}
            {numeric('min-order', 'Valor mínimo do pedido', draft.officialRules.minVolume.minOrderValue, 'minVolume.minOrderValue', { suffix: 'R({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-5" aria-label="Carregando configurações">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="grid grid-cols-3 gap-3">
          <div className="h-4 rounded bg-surface-2" />
          <div className="col-span-2 h-4 rounded bg-surface-2" />
        </div>
      ))}
    </div>
  )
}

function Configuracoes() {
  const {
    settings,
    settingsReady,
    currentRole,
    demoMode,
    saveSettings,
    saveProduct,
    toast,
  } = useStore()
  const isAdmin = currentRole === 'admin' || currentRole === 'administrador'
  const pend = pendingSettings(settings)
  const [companyDirty, setCompanyDirty] = useState(false)
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [dirtyProducts, setDirtyProducts] = useState<Set<string>>(() => new Set())
  const hasUnsavedChanges = companyDirty || settingsDirty || dirtyProducts.size > 0

  const onProductDirtyChange = useCallback((id: string, dirty: boolean) => {
    setDirtyProducts((current) => {
      const next = new Set(current)
      if (dirty) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const onToast = useCallback((title: string, body: string) => {
    toast({ tone: 'erro', title, body })
  }, [toast])

  const onCompanySave = async (company: CompanySettings) => {
    await saveSettings({ ...settings, company } satisfies AppSettings)
  }

  const blocker = useBlocker({
    shouldBlockFn: () => hasUnsavedChanges,
    enableBeforeUnload: hasUnsavedChanges,
    withResolver: true,
  })

  const products = settings.catalog

  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" description="Dados institucionais, catálogo e regras comerciais da Qualimix. Valores ausentes permanecem pendentes até confirmação." />

      {hasUnsavedChanges && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-warn/40 bg-warn-soft p-3 text-sm">
          <TriangleAlert className="h-4 w-4 shrink-0 text-warn" />
          <p className="flex-1"><strong>Há alterações não salvas.</strong> Salve ou descarte antes de sair desta página.</p>
          <Badge tone="warn">{(companyDirty ? 1 : 0) + (settingsDirty ? 1 : 0) + dirtyProducts.size} item(ns) alterado(s)</Badge>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Pendências para operação" subtitle="Obrigatórias para propostas definitivas com valores oficiais." />
          <ul className="space-y-2 p-5 text-sm">
            {pend.map((item) => (
              <li key={item} className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-warn" /> {item}</li>
            ))}
            {!pend.length && <li className="flex items-center gap-2 text-ok"><CircleCheck className="h-4 w-4" /> Tudo configurado</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Dados institucionais"
            subtitle="Usados no cabeçalho das propostas em PDF."
            action={isAdmin && settingsReady ? <Badge tone={companyDirty ? 'warn' : 'ok'}>{companyDirty ? 'Alterações pendentes' : 'Sincronizado'}</Badge> : undefined}
          />
          {!settingsReady ? <SettingsSkeleton rows={5} /> : isAdmin ? (
            <CompanySettingsEditor
              company={settings.company}
              onSave={onCompanySave}
              onDirtyChange={setCompanyDirty}
              onToast={onToast}
            />
          ) : (
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-3 p-5 text-sm sm:grid-cols-[140px_1fr]">
              <dt className="text-muted">Nome comercial</dt><dd className="font-semibold"><PendingValue value={settings.company.tradeName} /></dd>
              <dt className="text-muted">Razão social</dt><dd><PendingValue value={settings.company.legalName} /></dd>
              <dt className="text-muted">CNPJ</dt><dd><PendingValue value={settings.company.cnpj}>{settings.company.cnpj ? formatDocument(settings.company.cnpj) : undefined}</PendingValue></dd>
              <dt className="text-muted">Telefone</dt><dd><PendingValue value={settings.company.phone}>{settings.company.phone ? formatPhone(settings.company.phone) : undefined}</PendingValue></dd>
              <dt className="text-muted">E-mail</dt><dd><PendingValue value={settings.company.email} /></dd>
              <dt className="text-muted">Endereço</dt><dd><PendingValue value={settings.company.address} /></dd>
              <dt className="text-muted">Logo</dt>
              <dd>
                {settings.company.logoUrl && isHttpsUrl(settings.company.logoUrl)
                  ? <img src={settings.company.logoUrl} alt="Logo institucional" className="max-h-12 max-w-36 object-contain" />
                  : <PendingValue value={settings.company.logoUrl} />}
              </dd>
            </dl>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Catálogo de produtos e serviços" subtitle="Edite os dados e o preço oficial de cada item. Preço vazio significa pendente; os valores de demonstração são fictícios e somente para consulta." />
        {!settingsReady ? (
          <SettingsSkeleton rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-3">Código</th>
                  <th className="px-3 py-3">Produto / descrição</th>
                  <th className="px-3 py-3">Categoria</th>
                  <th className="px-3 py-3">Unidade</th>
                  <th className="px-3 py-3 text-right">Preço oficial</th>
                  {demoMode && <th className="px-3 py-3 text-right">Demonstração</th>}
                  <th className="px-3 py-3">Status / vigência</th>
                  {isAdmin && <th className="px-3 py-3 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={isAdmin ? (demoMode ? 8 : 7) : (demoMode ? 7 : 6)} className="px-4 py-6 text-center text-sm text-muted">Nenhum produto cadastrado no banco de dados.</td></tr>
                ) : products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    isAdmin={isAdmin}
                    demoMode={demoMode}
                    onSave={saveProduct}
                    onDirtyChange={onProductDirtyChange}
                    onToast={onToast}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RemainingSettingsEditor settings={settings} isAdmin={isAdmin} settingsReady={settingsReady} onSave={saveSettings} onDirtyChange={setSettingsDirty} onToast={onToast} />

      <Card>
        <CardHeader title="Usuários e permissões" subtitle="Perfis previstos. As permissões são aplicadas no servidor e no banco de dados, não apenas na interface." action={<Lock className="h-5 w-5 text-brand" />} />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {permissions.map(([role, items]) => (
            <div key={role} className="rounded-md border border-line p-3">
              <p className="font-display text-lg font-bold uppercase">{role}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted">
                {items.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {blocker.status === 'blocked' && (
        <div className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title">
          <div className="w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-1 h-5 w-5 shrink-0 text-warn" />
              <div>
                <h2 id="unsaved-title" className="text-lg font-bold">Você tem alterações não salvas</h2>
                <p className="mt-2 text-sm text-muted">Sair agora descartará as alterações desta tela que ainda não foram salvas. Deseja continuar?</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => blocker.reset()}>Continuar editando</Button>
              <Button type="button" variant="danger" onClick={() => blocker.proceed()}>Sair sem salvar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
 })}
            {numeric('stay-tolerance', 'Tolerância de estadia', draft.officialRules.stay.toleranceMin, 'stay.toleranceMin', { suffix: 'min' })}
            {numeric('stay-hour', 'Estadia — por hora', draft.officialRules.stay.perHour, 'stay.perHour')}
            {numeric('floor-area', 'Área mínima de piso', draft.officialRules.floor.minArea, 'floor.minArea', { suffix: 'm²' })}
            {numeric('discount-limit', 'Desconto sem aprovação', draft.officialRules.maxDiscountPctWithoutApproval, 'maxDiscountPctWithoutApproval', { max: 100, suffix: '%' })}
            {numeric('validity-days', 'Validade padrão', draft.officialRules.validityDays, 'validityDays', { min: 1, max: 365, integer: true, suffix: 'dias' })}
            {numeric('quantity-decimals', 'Casas decimais da quantidade', draft.officialRules.quantityDecimals, 'quantityDecimals', { min: 0, max: 4, integer: true })}
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" checked={draft.officialRules.minVolume.chargeDifference} onChange={(event) => update((next) => { next.officialRules.minVolume.chargeDifference = event.target.checked })} />
              Cobrar diferença até o volume mínimo
            </label>
          </> : <>
            {[
              ['Frete — valor fixo', draft.officialRules.freight.fixed, 'R({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-5" aria-label="Carregando configurações">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="grid grid-cols-3 gap-3">
          <div className="h-4 rounded bg-surface-2" />
          <div className="col-span-2 h-4 rounded bg-surface-2" />
        </div>
      ))}
    </div>
  )
}

function Configuracoes() {
  const {
    settings,
    settingsReady,
    currentRole,
    demoMode,
    saveSettings,
    saveProduct,
    toast,
  } = useStore()
  const isAdmin = currentRole === 'admin' || currentRole === 'administrador'
  const pend = pendingSettings(settings)
  const [companyDirty, setCompanyDirty] = useState(false)
  const [dirtyProducts, setDirtyProducts] = useState<Set<string>>(() => new Set())
  const hasUnsavedChanges = companyDirty || dirtyProducts.size > 0

  const onProductDirtyChange = useCallback((id: string, dirty: boolean) => {
    setDirtyProducts((current) => {
      const next = new Set(current)
      if (dirty) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const onToast = useCallback((title: string, body: string) => {
    toast({ tone: 'erro', title, body })
  }, [toast])

  const onCompanySave = async (company: CompanySettings) => {
    await saveSettings({ ...settings, company } satisfies AppSettings)
  }

  const blocker = useBlocker({
    shouldBlockFn: () => hasUnsavedChanges,
    enableBeforeUnload: hasUnsavedChanges,
    withResolver: true,
  })

  const ruleRows: [string, number | null, number | null, ((n: number) => string)?][] = [
    ['Frete — valor fixo', settings.officialRules.freight.fixed, settings.demoRules.freight.fixed],
    ['Frete — por km', settings.officialRules.freight.perKm, settings.demoRules.freight.perKm],
    ...settings.officialRules.freight.regions.map((region): [string, number | null, number | null] => [
      'Frete — ' + region.name,
      region.price,
      settings.demoRules.freight.regions.find((demo) => demo.id === region.id)?.price ?? null,
    ]),
    ['Bombeamento — fixo', settings.officialRules.pumping.fixed, settings.demoRules.pumping.fixed],
    ['Bombeamento — por m³', settings.officialRules.pumping.perM3, settings.demoRules.pumping.perM3],
    ['Bombeamento — por hora', settings.officialRules.pumping.perHour, settings.demoRules.pumping.perHour],
    ['Bombeamento — mínimo', settings.officialRules.pumping.minimum, settings.demoRules.pumping.minimum],
    ['Volume mínimo (m³)', settings.officialRules.minVolume.m3, settings.demoRules.minVolume.m3, (n) => num(n, 1) + ' m³'],
    ['Estadia — tolerância', settings.officialRules.stay.toleranceMin, settings.demoRules.stay.toleranceMin, (n) => n + ' min'],
    ['Estadia — por hora', settings.officialRules.stay.perHour, settings.demoRules.stay.perHour],
    ['Piso — área mínima', settings.officialRules.floor.minArea, settings.demoRules.floor.minArea, (n) => num(n, 0) + ' m²'],
    ['Desconto sem aprovação', settings.officialRules.maxDiscountPctWithoutApproval, settings.demoRules.maxDiscountPctWithoutApproval, (n) => n + '%'],
    ['Validade padrão', settings.officialRules.validityDays, settings.demoRules.validityDays, (n) => n + ' dias'],
  ]

  const products = settings.catalog

  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" description="Dados institucionais, catálogo e regras comerciais da Qualimix. Valores ausentes permanecem pendentes até confirmação." />

      {hasUnsavedChanges && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-warn/40 bg-warn-soft p-3 text-sm">
          <TriangleAlert className="h-4 w-4 shrink-0 text-warn" />
          <p className="flex-1"><strong>Há alterações não salvas.</strong> Salve ou descarte antes de sair desta página.</p>
          <Badge tone="warn">{(companyDirty ? 1 : 0) + dirtyProducts.size} item(ns) alterado(s)</Badge>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Pendências para operação" subtitle="Obrigatórias para propostas definitivas com valores oficiais." />
          <ul className="space-y-2 p-5 text-sm">
            {pend.map((item) => (
              <li key={item} className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-warn" /> {item}</li>
            ))}
            {!pend.length && <li className="flex items-center gap-2 text-ok"><CircleCheck className="h-4 w-4" /> Tudo configurado</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Dados institucionais"
            subtitle="Usados no cabeçalho das propostas em PDF."
            action={isAdmin && settingsReady ? <Badge tone={companyDirty ? 'warn' : 'ok'}>{companyDirty ? 'Alterações pendentes' : 'Sincronizado'}</Badge> : undefined}
          />
          {!settingsReady ? <SettingsSkeleton rows={5} /> : isAdmin ? (
            <CompanySettingsEditor
              company={settings.company}
              onSave={onCompanySave}
              onDirtyChange={setCompanyDirty}
              onToast={onToast}
            />
          ) : (
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-3 p-5 text-sm sm:grid-cols-[140px_1fr]">
              <dt className="text-muted">Nome comercial</dt><dd className="font-semibold"><PendingValue value={settings.company.tradeName} /></dd>
              <dt className="text-muted">Razão social</dt><dd><PendingValue value={settings.company.legalName} /></dd>
              <dt className="text-muted">CNPJ</dt><dd><PendingValue value={settings.company.cnpj}>{settings.company.cnpj ? formatDocument(settings.company.cnpj) : undefined}</PendingValue></dd>
              <dt className="text-muted">Telefone</dt><dd><PendingValue value={settings.company.phone}>{settings.company.phone ? formatPhone(settings.company.phone) : undefined}</PendingValue></dd>
              <dt className="text-muted">E-mail</dt><dd><PendingValue value={settings.company.email} /></dd>
              <dt className="text-muted">Endereço</dt><dd><PendingValue value={settings.company.address} /></dd>
              <dt className="text-muted">Logo</dt>
              <dd>
                {settings.company.logoUrl && isHttpsUrl(settings.company.logoUrl)
                  ? <img src={settings.company.logoUrl} alt="Logo institucional" className="max-h-12 max-w-36 object-contain" />
                  : <PendingValue value={settings.company.logoUrl} />}
              </dd>
            </dl>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Catálogo de produtos e serviços" subtitle="Edite os dados e o preço oficial de cada item. Preço vazio significa pendente; os valores de demonstração são fictícios e somente para consulta." />
        {!settingsReady ? (
          <SettingsSkeleton rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-3">Código</th>
                  <th className="px-3 py-3">Produto / descrição</th>
                  <th className="px-3 py-3">Categoria</th>
                  <th className="px-3 py-3">Unidade</th>
                  <th className="px-3 py-3 text-right">Preço oficial</th>
                  {demoMode && <th className="px-3 py-3 text-right">Demonstração</th>}
                  <th className="px-3 py-3">Status / vigência</th>
                  {isAdmin && <th className="px-3 py-3 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={isAdmin ? (demoMode ? 8 : 7) : (demoMode ? 7 : 6)} className="px-4 py-6 text-center text-sm text-muted">Nenhum produto cadastrado no banco de dados.</td></tr>
                ) : products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    isAdmin={isAdmin}
                    demoMode={demoMode}
                    onSave={saveProduct}
                    onDirtyChange={onProductDirtyChange}
                    onToast={onToast}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Regras comerciais" subtitle="Cada regra é independente. Regras oficiais não confirmadas permanecem pendentes." />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-2">Regra</th><th className="px-4 py-2 text-right">Oficial</th><th className="px-4 py-2 text-right">Demo</th></tr>
              </thead>
              <tbody>
                {ruleRows.map(([label, official, demo, formatter]) => (
                  <tr key={label} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">{label}</td>
                    <td className="px-4 py-2 text-right">{v(official, formatter)}</td>
                    <td className="px-4 py-2 text-right text-muted">{v(demo, formatter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Formas de pagamento" subtitle="Modalidades oficiais configuradas para a Qualimix." />
            <ul className="flex flex-wrap gap-2 p-5">
              {settings.paymentMethods.map((method) => (
                <li key={method.id}>
                  <Badge tone={method.enabledOfficial ? 'ok' : 'warn'}>
                    {method.label}: {method.enabledOfficial === null ? 'a confirmar' : method.enabledOfficial ? 'aceita' : 'não aceita'}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Cadastros de apoio" />
            <div className="space-y-3 p-5 text-sm">
              <p><strong>Origens de lead:</strong> {settings.leadSources.join(', ')}</p>
              <p><strong>Regiões atendidas:</strong> {settings.regions.join(', ')}</p>
              <p><strong>Etapas do funil:</strong> {settings.funnelStages.map((stage) => stage.label).join(' → ')}</p>
              <p><strong>Numeração de orçamentos:</strong> ORC-AAAA-NNNN, sequencial e única</p>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Usuários e permissões" subtitle="Perfis previstos. As permissões são aplicadas no servidor e no banco de dados, não apenas na interface." action={<Lock className="h-5 w-5 text-brand" />} />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {permissions.map(([role, items]) => (
            <div key={role} className="rounded-md border border-line p-3">
              <p className="font-display text-lg font-bold uppercase">{role}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted">
                {items.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {blocker.status === 'blocked' && (
        <div className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title">
          <div className="w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-1 h-5 w-5 shrink-0 text-warn" />
              <div>
                <h2 id="unsaved-title" className="text-lg font-bold">Você tem alterações não salvas</h2>
                <p className="mt-2 text-sm text-muted">Sair agora descartará as alterações desta tela que ainda não foram salvas. Deseja continuar?</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => blocker.reset()}>Continuar editando</Button>
              <Button type="button" variant="danger" onClick={() => blocker.proceed()}>Sair sem salvar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
],
              ['Frete — por km', draft.officialRules.freight.perKm, 'R$/km'],
              ...draft.officialRules.freight.regions.map((r) => ['Frete — ' + r.name, r.price, 'R({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-5" aria-label="Carregando configurações">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="grid grid-cols-3 gap-3">
          <div className="h-4 rounded bg-surface-2" />
          <div className="col-span-2 h-4 rounded bg-surface-2" />
        </div>
      ))}
    </div>
  )
}

function Configuracoes() {
  const {
    settings,
    settingsReady,
    currentRole,
    demoMode,
    saveSettings,
    saveProduct,
    toast,
  } = useStore()
  const isAdmin = currentRole === 'admin' || currentRole === 'administrador'
  const pend = pendingSettings(settings)
  const [companyDirty, setCompanyDirty] = useState(false)
  const [dirtyProducts, setDirtyProducts] = useState<Set<string>>(() => new Set())
  const hasUnsavedChanges = companyDirty || dirtyProducts.size > 0

  const onProductDirtyChange = useCallback((id: string, dirty: boolean) => {
    setDirtyProducts((current) => {
      const next = new Set(current)
      if (dirty) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const onToast = useCallback((title: string, body: string) => {
    toast({ tone: 'erro', title, body })
  }, [toast])

  const onCompanySave = async (company: CompanySettings) => {
    await saveSettings({ ...settings, company } satisfies AppSettings)
  }

  const blocker = useBlocker({
    shouldBlockFn: () => hasUnsavedChanges,
    enableBeforeUnload: hasUnsavedChanges,
    withResolver: true,
  })

  const ruleRows: [string, number | null, number | null, ((n: number) => string)?][] = [
    ['Frete — valor fixo', settings.officialRules.freight.fixed, settings.demoRules.freight.fixed],
    ['Frete — por km', settings.officialRules.freight.perKm, settings.demoRules.freight.perKm],
    ...settings.officialRules.freight.regions.map((region): [string, number | null, number | null] => [
      'Frete — ' + region.name,
      region.price,
      settings.demoRules.freight.regions.find((demo) => demo.id === region.id)?.price ?? null,
    ]),
    ['Bombeamento — fixo', settings.officialRules.pumping.fixed, settings.demoRules.pumping.fixed],
    ['Bombeamento — por m³', settings.officialRules.pumping.perM3, settings.demoRules.pumping.perM3],
    ['Bombeamento — por hora', settings.officialRules.pumping.perHour, settings.demoRules.pumping.perHour],
    ['Bombeamento — mínimo', settings.officialRules.pumping.minimum, settings.demoRules.pumping.minimum],
    ['Volume mínimo (m³)', settings.officialRules.minVolume.m3, settings.demoRules.minVolume.m3, (n) => num(n, 1) + ' m³'],
    ['Estadia — tolerância', settings.officialRules.stay.toleranceMin, settings.demoRules.stay.toleranceMin, (n) => n + ' min'],
    ['Estadia — por hora', settings.officialRules.stay.perHour, settings.demoRules.stay.perHour],
    ['Piso — área mínima', settings.officialRules.floor.minArea, settings.demoRules.floor.minArea, (n) => num(n, 0) + ' m²'],
    ['Desconto sem aprovação', settings.officialRules.maxDiscountPctWithoutApproval, settings.demoRules.maxDiscountPctWithoutApproval, (n) => n + '%'],
    ['Validade padrão', settings.officialRules.validityDays, settings.demoRules.validityDays, (n) => n + ' dias'],
  ]

  const products = settings.catalog

  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" description="Dados institucionais, catálogo e regras comerciais da Qualimix. Valores ausentes permanecem pendentes até confirmação." />

      {hasUnsavedChanges && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-warn/40 bg-warn-soft p-3 text-sm">
          <TriangleAlert className="h-4 w-4 shrink-0 text-warn" />
          <p className="flex-1"><strong>Há alterações não salvas.</strong> Salve ou descarte antes de sair desta página.</p>
          <Badge tone="warn">{(companyDirty ? 1 : 0) + dirtyProducts.size} item(ns) alterado(s)</Badge>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Pendências para operação" subtitle="Obrigatórias para propostas definitivas com valores oficiais." />
          <ul className="space-y-2 p-5 text-sm">
            {pend.map((item) => (
              <li key={item} className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-warn" /> {item}</li>
            ))}
            {!pend.length && <li className="flex items-center gap-2 text-ok"><CircleCheck className="h-4 w-4" /> Tudo configurado</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Dados institucionais"
            subtitle="Usados no cabeçalho das propostas em PDF."
            action={isAdmin && settingsReady ? <Badge tone={companyDirty ? 'warn' : 'ok'}>{companyDirty ? 'Alterações pendentes' : 'Sincronizado'}</Badge> : undefined}
          />
          {!settingsReady ? <SettingsSkeleton rows={5} /> : isAdmin ? (
            <CompanySettingsEditor
              company={settings.company}
              onSave={onCompanySave}
              onDirtyChange={setCompanyDirty}
              onToast={onToast}
            />
          ) : (
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-3 p-5 text-sm sm:grid-cols-[140px_1fr]">
              <dt className="text-muted">Nome comercial</dt><dd className="font-semibold"><PendingValue value={settings.company.tradeName} /></dd>
              <dt className="text-muted">Razão social</dt><dd><PendingValue value={settings.company.legalName} /></dd>
              <dt className="text-muted">CNPJ</dt><dd><PendingValue value={settings.company.cnpj}>{settings.company.cnpj ? formatDocument(settings.company.cnpj) : undefined}</PendingValue></dd>
              <dt className="text-muted">Telefone</dt><dd><PendingValue value={settings.company.phone}>{settings.company.phone ? formatPhone(settings.company.phone) : undefined}</PendingValue></dd>
              <dt className="text-muted">E-mail</dt><dd><PendingValue value={settings.company.email} /></dd>
              <dt className="text-muted">Endereço</dt><dd><PendingValue value={settings.company.address} /></dd>
              <dt className="text-muted">Logo</dt>
              <dd>
                {settings.company.logoUrl && isHttpsUrl(settings.company.logoUrl)
                  ? <img src={settings.company.logoUrl} alt="Logo institucional" className="max-h-12 max-w-36 object-contain" />
                  : <PendingValue value={settings.company.logoUrl} />}
              </dd>
            </dl>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Catálogo de produtos e serviços" subtitle="Edite os dados e o preço oficial de cada item. Preço vazio significa pendente; os valores de demonstração são fictícios e somente para consulta." />
        {!settingsReady ? (
          <SettingsSkeleton rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-3">Código</th>
                  <th className="px-3 py-3">Produto / descrição</th>
                  <th className="px-3 py-3">Categoria</th>
                  <th className="px-3 py-3">Unidade</th>
                  <th className="px-3 py-3 text-right">Preço oficial</th>
                  {demoMode && <th className="px-3 py-3 text-right">Demonstração</th>}
                  <th className="px-3 py-3">Status / vigência</th>
                  {isAdmin && <th className="px-3 py-3 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={isAdmin ? (demoMode ? 8 : 7) : (demoMode ? 7 : 6)} className="px-4 py-6 text-center text-sm text-muted">Nenhum produto cadastrado no banco de dados.</td></tr>
                ) : products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    isAdmin={isAdmin}
                    demoMode={demoMode}
                    onSave={saveProduct}
                    onDirtyChange={onProductDirtyChange}
                    onToast={onToast}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Regras comerciais" subtitle="Cada regra é independente. Regras oficiais não confirmadas permanecem pendentes." />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-2">Regra</th><th className="px-4 py-2 text-right">Oficial</th><th className="px-4 py-2 text-right">Demo</th></tr>
              </thead>
              <tbody>
                {ruleRows.map(([label, official, demo, formatter]) => (
                  <tr key={label} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">{label}</td>
                    <td className="px-4 py-2 text-right">{v(official, formatter)}</td>
                    <td className="px-4 py-2 text-right text-muted">{v(demo, formatter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Formas de pagamento" subtitle="Modalidades oficiais configuradas para a Qualimix." />
            <ul className="flex flex-wrap gap-2 p-5">
              {settings.paymentMethods.map((method) => (
                <li key={method.id}>
                  <Badge tone={method.enabledOfficial ? 'ok' : 'warn'}>
                    {method.label}: {method.enabledOfficial === null ? 'a confirmar' : method.enabledOfficial ? 'aceita' : 'não aceita'}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Cadastros de apoio" />
            <div className="space-y-3 p-5 text-sm">
              <p><strong>Origens de lead:</strong> {settings.leadSources.join(', ')}</p>
              <p><strong>Regiões atendidas:</strong> {settings.regions.join(', ')}</p>
              <p><strong>Etapas do funil:</strong> {settings.funnelStages.map((stage) => stage.label).join(' → ')}</p>
              <p><strong>Numeração de orçamentos:</strong> ORC-AAAA-NNNN, sequencial e única</p>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Usuários e permissões" subtitle="Perfis previstos. As permissões são aplicadas no servidor e no banco de dados, não apenas na interface." action={<Lock className="h-5 w-5 text-brand" />} />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {permissions.map(([role, items]) => (
            <div key={role} className="rounded-md border border-line p-3">
              <p className="font-display text-lg font-bold uppercase">{role}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted">
                {items.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {blocker.status === 'blocked' && (
        <div className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title">
          <div className="w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-1 h-5 w-5 shrink-0 text-warn" />
              <div>
                <h2 id="unsaved-title" className="text-lg font-bold">Você tem alterações não salvas</h2>
                <p className="mt-2 text-sm text-muted">Sair agora descartará as alterações desta tela que ainda não foram salvas. Deseja continuar?</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => blocker.reset()}>Continuar editando</Button>
              <Button type="button" variant="danger" onClick={() => blocker.proceed()}>Sair sem salvar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
] as [string, number | null, string]),
              ['Bombeamento — fixo', draft.officialRules.pumping.fixed, 'R({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-5" aria-label="Carregando configurações">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="grid grid-cols-3 gap-3">
          <div className="h-4 rounded bg-surface-2" />
          <div className="col-span-2 h-4 rounded bg-surface-2" />
        </div>
      ))}
    </div>
  )
}

function Configuracoes() {
  const {
    settings,
    settingsReady,
    currentRole,
    demoMode,
    saveSettings,
    saveProduct,
    toast,
  } = useStore()
  const isAdmin = currentRole === 'admin' || currentRole === 'administrador'
  const pend = pendingSettings(settings)
  const [companyDirty, setCompanyDirty] = useState(false)
  const [dirtyProducts, setDirtyProducts] = useState<Set<string>>(() => new Set())
  const hasUnsavedChanges = companyDirty || dirtyProducts.size > 0

  const onProductDirtyChange = useCallback((id: string, dirty: boolean) => {
    setDirtyProducts((current) => {
      const next = new Set(current)
      if (dirty) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const onToast = useCallback((title: string, body: string) => {
    toast({ tone: 'erro', title, body })
  }, [toast])

  const onCompanySave = async (company: CompanySettings) => {
    await saveSettings({ ...settings, company } satisfies AppSettings)
  }

  const blocker = useBlocker({
    shouldBlockFn: () => hasUnsavedChanges,
    enableBeforeUnload: hasUnsavedChanges,
    withResolver: true,
  })

  const ruleRows: [string, number | null, number | null, ((n: number) => string)?][] = [
    ['Frete — valor fixo', settings.officialRules.freight.fixed, settings.demoRules.freight.fixed],
    ['Frete — por km', settings.officialRules.freight.perKm, settings.demoRules.freight.perKm],
    ...settings.officialRules.freight.regions.map((region): [string, number | null, number | null] => [
      'Frete — ' + region.name,
      region.price,
      settings.demoRules.freight.regions.find((demo) => demo.id === region.id)?.price ?? null,
    ]),
    ['Bombeamento — fixo', settings.officialRules.pumping.fixed, settings.demoRules.pumping.fixed],
    ['Bombeamento — por m³', settings.officialRules.pumping.perM3, settings.demoRules.pumping.perM3],
    ['Bombeamento — por hora', settings.officialRules.pumping.perHour, settings.demoRules.pumping.perHour],
    ['Bombeamento — mínimo', settings.officialRules.pumping.minimum, settings.demoRules.pumping.minimum],
    ['Volume mínimo (m³)', settings.officialRules.minVolume.m3, settings.demoRules.minVolume.m3, (n) => num(n, 1) + ' m³'],
    ['Estadia — tolerância', settings.officialRules.stay.toleranceMin, settings.demoRules.stay.toleranceMin, (n) => n + ' min'],
    ['Estadia — por hora', settings.officialRules.stay.perHour, settings.demoRules.stay.perHour],
    ['Piso — área mínima', settings.officialRules.floor.minArea, settings.demoRules.floor.minArea, (n) => num(n, 0) + ' m²'],
    ['Desconto sem aprovação', settings.officialRules.maxDiscountPctWithoutApproval, settings.demoRules.maxDiscountPctWithoutApproval, (n) => n + '%'],
    ['Validade padrão', settings.officialRules.validityDays, settings.demoRules.validityDays, (n) => n + ' dias'],
  ]

  const products = settings.catalog

  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" description="Dados institucionais, catálogo e regras comerciais da Qualimix. Valores ausentes permanecem pendentes até confirmação." />

      {hasUnsavedChanges && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-warn/40 bg-warn-soft p-3 text-sm">
          <TriangleAlert className="h-4 w-4 shrink-0 text-warn" />
          <p className="flex-1"><strong>Há alterações não salvas.</strong> Salve ou descarte antes de sair desta página.</p>
          <Badge tone="warn">{(companyDirty ? 1 : 0) + dirtyProducts.size} item(ns) alterado(s)</Badge>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Pendências para operação" subtitle="Obrigatórias para propostas definitivas com valores oficiais." />
          <ul className="space-y-2 p-5 text-sm">
            {pend.map((item) => (
              <li key={item} className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-warn" /> {item}</li>
            ))}
            {!pend.length && <li className="flex items-center gap-2 text-ok"><CircleCheck className="h-4 w-4" /> Tudo configurado</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Dados institucionais"
            subtitle="Usados no cabeçalho das propostas em PDF."
            action={isAdmin && settingsReady ? <Badge tone={companyDirty ? 'warn' : 'ok'}>{companyDirty ? 'Alterações pendentes' : 'Sincronizado'}</Badge> : undefined}
          />
          {!settingsReady ? <SettingsSkeleton rows={5} /> : isAdmin ? (
            <CompanySettingsEditor
              company={settings.company}
              onSave={onCompanySave}
              onDirtyChange={setCompanyDirty}
              onToast={onToast}
            />
          ) : (
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-3 p-5 text-sm sm:grid-cols-[140px_1fr]">
              <dt className="text-muted">Nome comercial</dt><dd className="font-semibold"><PendingValue value={settings.company.tradeName} /></dd>
              <dt className="text-muted">Razão social</dt><dd><PendingValue value={settings.company.legalName} /></dd>
              <dt className="text-muted">CNPJ</dt><dd><PendingValue value={settings.company.cnpj}>{settings.company.cnpj ? formatDocument(settings.company.cnpj) : undefined}</PendingValue></dd>
              <dt className="text-muted">Telefone</dt><dd><PendingValue value={settings.company.phone}>{settings.company.phone ? formatPhone(settings.company.phone) : undefined}</PendingValue></dd>
              <dt className="text-muted">E-mail</dt><dd><PendingValue value={settings.company.email} /></dd>
              <dt className="text-muted">Endereço</dt><dd><PendingValue value={settings.company.address} /></dd>
              <dt className="text-muted">Logo</dt>
              <dd>
                {settings.company.logoUrl && isHttpsUrl(settings.company.logoUrl)
                  ? <img src={settings.company.logoUrl} alt="Logo institucional" className="max-h-12 max-w-36 object-contain" />
                  : <PendingValue value={settings.company.logoUrl} />}
              </dd>
            </dl>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Catálogo de produtos e serviços" subtitle="Edite os dados e o preço oficial de cada item. Preço vazio significa pendente; os valores de demonstração são fictícios e somente para consulta." />
        {!settingsReady ? (
          <SettingsSkeleton rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-3">Código</th>
                  <th className="px-3 py-3">Produto / descrição</th>
                  <th className="px-3 py-3">Categoria</th>
                  <th className="px-3 py-3">Unidade</th>
                  <th className="px-3 py-3 text-right">Preço oficial</th>
                  {demoMode && <th className="px-3 py-3 text-right">Demonstração</th>}
                  <th className="px-3 py-3">Status / vigência</th>
                  {isAdmin && <th className="px-3 py-3 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={isAdmin ? (demoMode ? 8 : 7) : (demoMode ? 7 : 6)} className="px-4 py-6 text-center text-sm text-muted">Nenhum produto cadastrado no banco de dados.</td></tr>
                ) : products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    isAdmin={isAdmin}
                    demoMode={demoMode}
                    onSave={saveProduct}
                    onDirtyChange={onProductDirtyChange}
                    onToast={onToast}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Regras comerciais" subtitle="Cada regra é independente. Regras oficiais não confirmadas permanecem pendentes." />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-2">Regra</th><th className="px-4 py-2 text-right">Oficial</th><th className="px-4 py-2 text-right">Demo</th></tr>
              </thead>
              <tbody>
                {ruleRows.map(([label, official, demo, formatter]) => (
                  <tr key={label} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">{label}</td>
                    <td className="px-4 py-2 text-right">{v(official, formatter)}</td>
                    <td className="px-4 py-2 text-right text-muted">{v(demo, formatter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Formas de pagamento" subtitle="Modalidades oficiais configuradas para a Qualimix." />
            <ul className="flex flex-wrap gap-2 p-5">
              {settings.paymentMethods.map((method) => (
                <li key={method.id}>
                  <Badge tone={method.enabledOfficial ? 'ok' : 'warn'}>
                    {method.label}: {method.enabledOfficial === null ? 'a confirmar' : method.enabledOfficial ? 'aceita' : 'não aceita'}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Cadastros de apoio" />
            <div className="space-y-3 p-5 text-sm">
              <p><strong>Origens de lead:</strong> {settings.leadSources.join(', ')}</p>
              <p><strong>Regiões atendidas:</strong> {settings.regions.join(', ')}</p>
              <p><strong>Etapas do funil:</strong> {settings.funnelStages.map((stage) => stage.label).join(' → ')}</p>
              <p><strong>Numeração de orçamentos:</strong> ORC-AAAA-NNNN, sequencial e única</p>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Usuários e permissões" subtitle="Perfis previstos. As permissões são aplicadas no servidor e no banco de dados, não apenas na interface." action={<Lock className="h-5 w-5 text-brand" />} />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {permissions.map(([role, items]) => (
            <div key={role} className="rounded-md border border-line p-3">
              <p className="font-display text-lg font-bold uppercase">{role}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted">
                {items.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {blocker.status === 'blocked' && (
        <div className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title">
          <div className="w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-1 h-5 w-5 shrink-0 text-warn" />
              <div>
                <h2 id="unsaved-title" className="text-lg font-bold">Você tem alterações não salvas</h2>
                <p className="mt-2 text-sm text-muted">Sair agora descartará as alterações desta tela que ainda não foram salvas. Deseja continuar?</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => blocker.reset()}>Continuar editando</Button>
              <Button type="button" variant="danger" onClick={() => blocker.proceed()}>Sair sem salvar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
],
              ['Bombeamento — por m³', draft.officialRules.pumping.perM3, 'R$/m³'],
              ['Bombeamento — por hora', draft.officialRules.pumping.perHour, 'R$/h'],
              ['Bombeamento — mínimo', draft.officialRules.pumping.minimum, 'R({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-5" aria-label="Carregando configurações">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="grid grid-cols-3 gap-3">
          <div className="h-4 rounded bg-surface-2" />
          <div className="col-span-2 h-4 rounded bg-surface-2" />
        </div>
      ))}
    </div>
  )
}

function Configuracoes() {
  const {
    settings,
    settingsReady,
    currentRole,
    demoMode,
    saveSettings,
    saveProduct,
    toast,
  } = useStore()
  const isAdmin = currentRole === 'admin' || currentRole === 'administrador'
  const pend = pendingSettings(settings)
  const [companyDirty, setCompanyDirty] = useState(false)
  const [dirtyProducts, setDirtyProducts] = useState<Set<string>>(() => new Set())
  const hasUnsavedChanges = companyDirty || dirtyProducts.size > 0

  const onProductDirtyChange = useCallback((id: string, dirty: boolean) => {
    setDirtyProducts((current) => {
      const next = new Set(current)
      if (dirty) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const onToast = useCallback((title: string, body: string) => {
    toast({ tone: 'erro', title, body })
  }, [toast])

  const onCompanySave = async (company: CompanySettings) => {
    await saveSettings({ ...settings, company } satisfies AppSettings)
  }

  const blocker = useBlocker({
    shouldBlockFn: () => hasUnsavedChanges,
    enableBeforeUnload: hasUnsavedChanges,
    withResolver: true,
  })

  const ruleRows: [string, number | null, number | null, ((n: number) => string)?][] = [
    ['Frete — valor fixo', settings.officialRules.freight.fixed, settings.demoRules.freight.fixed],
    ['Frete — por km', settings.officialRules.freight.perKm, settings.demoRules.freight.perKm],
    ...settings.officialRules.freight.regions.map((region): [string, number | null, number | null] => [
      'Frete — ' + region.name,
      region.price,
      settings.demoRules.freight.regions.find((demo) => demo.id === region.id)?.price ?? null,
    ]),
    ['Bombeamento — fixo', settings.officialRules.pumping.fixed, settings.demoRules.pumping.fixed],
    ['Bombeamento — por m³', settings.officialRules.pumping.perM3, settings.demoRules.pumping.perM3],
    ['Bombeamento — por hora', settings.officialRules.pumping.perHour, settings.demoRules.pumping.perHour],
    ['Bombeamento — mínimo', settings.officialRules.pumping.minimum, settings.demoRules.pumping.minimum],
    ['Volume mínimo (m³)', settings.officialRules.minVolume.m3, settings.demoRules.minVolume.m3, (n) => num(n, 1) + ' m³'],
    ['Estadia — tolerância', settings.officialRules.stay.toleranceMin, settings.demoRules.stay.toleranceMin, (n) => n + ' min'],
    ['Estadia — por hora', settings.officialRules.stay.perHour, settings.demoRules.stay.perHour],
    ['Piso — área mínima', settings.officialRules.floor.minArea, settings.demoRules.floor.minArea, (n) => num(n, 0) + ' m²'],
    ['Desconto sem aprovação', settings.officialRules.maxDiscountPctWithoutApproval, settings.demoRules.maxDiscountPctWithoutApproval, (n) => n + '%'],
    ['Validade padrão', settings.officialRules.validityDays, settings.demoRules.validityDays, (n) => n + ' dias'],
  ]

  const products = settings.catalog

  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" description="Dados institucionais, catálogo e regras comerciais da Qualimix. Valores ausentes permanecem pendentes até confirmação." />

      {hasUnsavedChanges && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-warn/40 bg-warn-soft p-3 text-sm">
          <TriangleAlert className="h-4 w-4 shrink-0 text-warn" />
          <p className="flex-1"><strong>Há alterações não salvas.</strong> Salve ou descarte antes de sair desta página.</p>
          <Badge tone="warn">{(companyDirty ? 1 : 0) + dirtyProducts.size} item(ns) alterado(s)</Badge>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Pendências para operação" subtitle="Obrigatórias para propostas definitivas com valores oficiais." />
          <ul className="space-y-2 p-5 text-sm">
            {pend.map((item) => (
              <li key={item} className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-warn" /> {item}</li>
            ))}
            {!pend.length && <li className="flex items-center gap-2 text-ok"><CircleCheck className="h-4 w-4" /> Tudo configurado</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Dados institucionais"
            subtitle="Usados no cabeçalho das propostas em PDF."
            action={isAdmin && settingsReady ? <Badge tone={companyDirty ? 'warn' : 'ok'}>{companyDirty ? 'Alterações pendentes' : 'Sincronizado'}</Badge> : undefined}
          />
          {!settingsReady ? <SettingsSkeleton rows={5} /> : isAdmin ? (
            <CompanySettingsEditor
              company={settings.company}
              onSave={onCompanySave}
              onDirtyChange={setCompanyDirty}
              onToast={onToast}
            />
          ) : (
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-3 p-5 text-sm sm:grid-cols-[140px_1fr]">
              <dt className="text-muted">Nome comercial</dt><dd className="font-semibold"><PendingValue value={settings.company.tradeName} /></dd>
              <dt className="text-muted">Razão social</dt><dd><PendingValue value={settings.company.legalName} /></dd>
              <dt className="text-muted">CNPJ</dt><dd><PendingValue value={settings.company.cnpj}>{settings.company.cnpj ? formatDocument(settings.company.cnpj) : undefined}</PendingValue></dd>
              <dt className="text-muted">Telefone</dt><dd><PendingValue value={settings.company.phone}>{settings.company.phone ? formatPhone(settings.company.phone) : undefined}</PendingValue></dd>
              <dt className="text-muted">E-mail</dt><dd><PendingValue value={settings.company.email} /></dd>
              <dt className="text-muted">Endereço</dt><dd><PendingValue value={settings.company.address} /></dd>
              <dt className="text-muted">Logo</dt>
              <dd>
                {settings.company.logoUrl && isHttpsUrl(settings.company.logoUrl)
                  ? <img src={settings.company.logoUrl} alt="Logo institucional" className="max-h-12 max-w-36 object-contain" />
                  : <PendingValue value={settings.company.logoUrl} />}
              </dd>
            </dl>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Catálogo de produtos e serviços" subtitle="Edite os dados e o preço oficial de cada item. Preço vazio significa pendente; os valores de demonstração são fictícios e somente para consulta." />
        {!settingsReady ? (
          <SettingsSkeleton rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-3">Código</th>
                  <th className="px-3 py-3">Produto / descrição</th>
                  <th className="px-3 py-3">Categoria</th>
                  <th className="px-3 py-3">Unidade</th>
                  <th className="px-3 py-3 text-right">Preço oficial</th>
                  {demoMode && <th className="px-3 py-3 text-right">Demonstração</th>}
                  <th className="px-3 py-3">Status / vigência</th>
                  {isAdmin && <th className="px-3 py-3 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={isAdmin ? (demoMode ? 8 : 7) : (demoMode ? 7 : 6)} className="px-4 py-6 text-center text-sm text-muted">Nenhum produto cadastrado no banco de dados.</td></tr>
                ) : products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    isAdmin={isAdmin}
                    demoMode={demoMode}
                    onSave={saveProduct}
                    onDirtyChange={onProductDirtyChange}
                    onToast={onToast}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Regras comerciais" subtitle="Cada regra é independente. Regras oficiais não confirmadas permanecem pendentes." />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-2">Regra</th><th className="px-4 py-2 text-right">Oficial</th><th className="px-4 py-2 text-right">Demo</th></tr>
              </thead>
              <tbody>
                {ruleRows.map(([label, official, demo, formatter]) => (
                  <tr key={label} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">{label}</td>
                    <td className="px-4 py-2 text-right">{v(official, formatter)}</td>
                    <td className="px-4 py-2 text-right text-muted">{v(demo, formatter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Formas de pagamento" subtitle="Modalidades oficiais configuradas para a Qualimix." />
            <ul className="flex flex-wrap gap-2 p-5">
              {settings.paymentMethods.map((method) => (
                <li key={method.id}>
                  <Badge tone={method.enabledOfficial ? 'ok' : 'warn'}>
                    {method.label}: {method.enabledOfficial === null ? 'a confirmar' : method.enabledOfficial ? 'aceita' : 'não aceita'}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Cadastros de apoio" />
            <div className="space-y-3 p-5 text-sm">
              <p><strong>Origens de lead:</strong> {settings.leadSources.join(', ')}</p>
              <p><strong>Regiões atendidas:</strong> {settings.regions.join(', ')}</p>
              <p><strong>Etapas do funil:</strong> {settings.funnelStages.map((stage) => stage.label).join(' → ')}</p>
              <p><strong>Numeração de orçamentos:</strong> ORC-AAAA-NNNN, sequencial e única</p>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Usuários e permissões" subtitle="Perfis previstos. As permissões são aplicadas no servidor e no banco de dados, não apenas na interface." action={<Lock className="h-5 w-5 text-brand" />} />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {permissions.map(([role, items]) => (
            <div key={role} className="rounded-md border border-line p-3">
              <p className="font-display text-lg font-bold uppercase">{role}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted">
                {items.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {blocker.status === 'blocked' && (
        <div className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title">
          <div className="w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-1 h-5 w-5 shrink-0 text-warn" />
              <div>
                <h2 id="unsaved-title" className="text-lg font-bold">Você tem alterações não salvas</h2>
                <p className="mt-2 text-sm text-muted">Sair agora descartará as alterações desta tela que ainda não foram salvas. Deseja continuar?</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => blocker.reset()}>Continuar editando</Button>
              <Button type="button" variant="danger" onClick={() => blocker.proceed()}>Sair sem salvar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
],
              ['Volume mínimo', draft.officialRules.minVolume.m3, 'm³'],
              ['Valor mínimo do pedido', draft.officialRules.minVolume.minOrderValue, 'R({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-5" aria-label="Carregando configurações">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="grid grid-cols-3 gap-3">
          <div className="h-4 rounded bg-surface-2" />
          <div className="col-span-2 h-4 rounded bg-surface-2" />
        </div>
      ))}
    </div>
  )
}

function Configuracoes() {
  const {
    settings,
    settingsReady,
    currentRole,
    demoMode,
    saveSettings,
    saveProduct,
    toast,
  } = useStore()
  const isAdmin = currentRole === 'admin' || currentRole === 'administrador'
  const pend = pendingSettings(settings)
  const [companyDirty, setCompanyDirty] = useState(false)
  const [dirtyProducts, setDirtyProducts] = useState<Set<string>>(() => new Set())
  const hasUnsavedChanges = companyDirty || dirtyProducts.size > 0

  const onProductDirtyChange = useCallback((id: string, dirty: boolean) => {
    setDirtyProducts((current) => {
      const next = new Set(current)
      if (dirty) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const onToast = useCallback((title: string, body: string) => {
    toast({ tone: 'erro', title, body })
  }, [toast])

  const onCompanySave = async (company: CompanySettings) => {
    await saveSettings({ ...settings, company } satisfies AppSettings)
  }

  const blocker = useBlocker({
    shouldBlockFn: () => hasUnsavedChanges,
    enableBeforeUnload: hasUnsavedChanges,
    withResolver: true,
  })

  const ruleRows: [string, number | null, number | null, ((n: number) => string)?][] = [
    ['Frete — valor fixo', settings.officialRules.freight.fixed, settings.demoRules.freight.fixed],
    ['Frete — por km', settings.officialRules.freight.perKm, settings.demoRules.freight.perKm],
    ...settings.officialRules.freight.regions.map((region): [string, number | null, number | null] => [
      'Frete — ' + region.name,
      region.price,
      settings.demoRules.freight.regions.find((demo) => demo.id === region.id)?.price ?? null,
    ]),
    ['Bombeamento — fixo', settings.officialRules.pumping.fixed, settings.demoRules.pumping.fixed],
    ['Bombeamento — por m³', settings.officialRules.pumping.perM3, settings.demoRules.pumping.perM3],
    ['Bombeamento — por hora', settings.officialRules.pumping.perHour, settings.demoRules.pumping.perHour],
    ['Bombeamento — mínimo', settings.officialRules.pumping.minimum, settings.demoRules.pumping.minimum],
    ['Volume mínimo (m³)', settings.officialRules.minVolume.m3, settings.demoRules.minVolume.m3, (n) => num(n, 1) + ' m³'],
    ['Estadia — tolerância', settings.officialRules.stay.toleranceMin, settings.demoRules.stay.toleranceMin, (n) => n + ' min'],
    ['Estadia — por hora', settings.officialRules.stay.perHour, settings.demoRules.stay.perHour],
    ['Piso — área mínima', settings.officialRules.floor.minArea, settings.demoRules.floor.minArea, (n) => num(n, 0) + ' m²'],
    ['Desconto sem aprovação', settings.officialRules.maxDiscountPctWithoutApproval, settings.demoRules.maxDiscountPctWithoutApproval, (n) => n + '%'],
    ['Validade padrão', settings.officialRules.validityDays, settings.demoRules.validityDays, (n) => n + ' dias'],
  ]

  const products = settings.catalog

  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" description="Dados institucionais, catálogo e regras comerciais da Qualimix. Valores ausentes permanecem pendentes até confirmação." />

      {hasUnsavedChanges && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-warn/40 bg-warn-soft p-3 text-sm">
          <TriangleAlert className="h-4 w-4 shrink-0 text-warn" />
          <p className="flex-1"><strong>Há alterações não salvas.</strong> Salve ou descarte antes de sair desta página.</p>
          <Badge tone="warn">{(companyDirty ? 1 : 0) + dirtyProducts.size} item(ns) alterado(s)</Badge>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Pendências para operação" subtitle="Obrigatórias para propostas definitivas com valores oficiais." />
          <ul className="space-y-2 p-5 text-sm">
            {pend.map((item) => (
              <li key={item} className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-warn" /> {item}</li>
            ))}
            {!pend.length && <li className="flex items-center gap-2 text-ok"><CircleCheck className="h-4 w-4" /> Tudo configurado</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Dados institucionais"
            subtitle="Usados no cabeçalho das propostas em PDF."
            action={isAdmin && settingsReady ? <Badge tone={companyDirty ? 'warn' : 'ok'}>{companyDirty ? 'Alterações pendentes' : 'Sincronizado'}</Badge> : undefined}
          />
          {!settingsReady ? <SettingsSkeleton rows={5} /> : isAdmin ? (
            <CompanySettingsEditor
              company={settings.company}
              onSave={onCompanySave}
              onDirtyChange={setCompanyDirty}
              onToast={onToast}
            />
          ) : (
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-3 p-5 text-sm sm:grid-cols-[140px_1fr]">
              <dt className="text-muted">Nome comercial</dt><dd className="font-semibold"><PendingValue value={settings.company.tradeName} /></dd>
              <dt className="text-muted">Razão social</dt><dd><PendingValue value={settings.company.legalName} /></dd>
              <dt className="text-muted">CNPJ</dt><dd><PendingValue value={settings.company.cnpj}>{settings.company.cnpj ? formatDocument(settings.company.cnpj) : undefined}</PendingValue></dd>
              <dt className="text-muted">Telefone</dt><dd><PendingValue value={settings.company.phone}>{settings.company.phone ? formatPhone(settings.company.phone) : undefined}</PendingValue></dd>
              <dt className="text-muted">E-mail</dt><dd><PendingValue value={settings.company.email} /></dd>
              <dt className="text-muted">Endereço</dt><dd><PendingValue value={settings.company.address} /></dd>
              <dt className="text-muted">Logo</dt>
              <dd>
                {settings.company.logoUrl && isHttpsUrl(settings.company.logoUrl)
                  ? <img src={settings.company.logoUrl} alt="Logo institucional" className="max-h-12 max-w-36 object-contain" />
                  : <PendingValue value={settings.company.logoUrl} />}
              </dd>
            </dl>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Catálogo de produtos e serviços" subtitle="Edite os dados e o preço oficial de cada item. Preço vazio significa pendente; os valores de demonstração são fictícios e somente para consulta." />
        {!settingsReady ? (
          <SettingsSkeleton rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-3">Código</th>
                  <th className="px-3 py-3">Produto / descrição</th>
                  <th className="px-3 py-3">Categoria</th>
                  <th className="px-3 py-3">Unidade</th>
                  <th className="px-3 py-3 text-right">Preço oficial</th>
                  {demoMode && <th className="px-3 py-3 text-right">Demonstração</th>}
                  <th className="px-3 py-3">Status / vigência</th>
                  {isAdmin && <th className="px-3 py-3 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={isAdmin ? (demoMode ? 8 : 7) : (demoMode ? 7 : 6)} className="px-4 py-6 text-center text-sm text-muted">Nenhum produto cadastrado no banco de dados.</td></tr>
                ) : products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    isAdmin={isAdmin}
                    demoMode={demoMode}
                    onSave={saveProduct}
                    onDirtyChange={onProductDirtyChange}
                    onToast={onToast}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Regras comerciais" subtitle="Cada regra é independente. Regras oficiais não confirmadas permanecem pendentes." />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-2">Regra</th><th className="px-4 py-2 text-right">Oficial</th><th className="px-4 py-2 text-right">Demo</th></tr>
              </thead>
              <tbody>
                {ruleRows.map(([label, official, demo, formatter]) => (
                  <tr key={label} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">{label}</td>
                    <td className="px-4 py-2 text-right">{v(official, formatter)}</td>
                    <td className="px-4 py-2 text-right text-muted">{v(demo, formatter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Formas de pagamento" subtitle="Modalidades oficiais configuradas para a Qualimix." />
            <ul className="flex flex-wrap gap-2 p-5">
              {settings.paymentMethods.map((method) => (
                <li key={method.id}>
                  <Badge tone={method.enabledOfficial ? 'ok' : 'warn'}>
                    {method.label}: {method.enabledOfficial === null ? 'a confirmar' : method.enabledOfficial ? 'aceita' : 'não aceita'}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Cadastros de apoio" />
            <div className="space-y-3 p-5 text-sm">
              <p><strong>Origens de lead:</strong> {settings.leadSources.join(', ')}</p>
              <p><strong>Regiões atendidas:</strong> {settings.regions.join(', ')}</p>
              <p><strong>Etapas do funil:</strong> {settings.funnelStages.map((stage) => stage.label).join(' → ')}</p>
              <p><strong>Numeração de orçamentos:</strong> ORC-AAAA-NNNN, sequencial e única</p>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Usuários e permissões" subtitle="Perfis previstos. As permissões são aplicadas no servidor e no banco de dados, não apenas na interface." action={<Lock className="h-5 w-5 text-brand" />} />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {permissions.map(([role, items]) => (
            <div key={role} className="rounded-md border border-line p-3">
              <p className="font-display text-lg font-bold uppercase">{role}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted">
                {items.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {blocker.status === 'blocked' && (
        <div className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title">
          <div className="w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-1 h-5 w-5 shrink-0 text-warn" />
              <div>
                <h2 id="unsaved-title" className="text-lg font-bold">Você tem alterações não salvas</h2>
                <p className="mt-2 text-sm text-muted">Sair agora descartará as alterações desta tela que ainda não foram salvas. Deseja continuar?</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => blocker.reset()}>Continuar editando</Button>
              <Button type="button" variant="danger" onClick={() => blocker.proceed()}>Sair sem salvar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
],
              ['Estadia — tolerância', draft.officialRules.stay.toleranceMin, 'min'],
              ['Estadia — por hora', draft.officialRules.stay.perHour, 'R$/h'],
              ['Área mínima de piso', draft.officialRules.floor.minArea, 'm²'],
              ['Desconto sem aprovação', draft.officialRules.maxDiscountPctWithoutApproval, '%'],
              ['Validade padrão', draft.officialRules.validityDays, 'dias'],
              ['Casas decimais', draft.officialRules.quantityDecimals, ''],
            ].map(([label, value, unit]) => <div key={String(label)} className="text-sm"><p className="text-xs text-muted">{String(label)}</p>{value === null ? <Badge tone="warn">Pendente</Badge> : <strong>{String(value)} {String(unit)}</strong>}</div>)}
            <p className="text-sm">Cobrar diferença até o volume mínimo: <strong>{draft.officialRules.minVolume.chargeDifference ? 'Sim' : 'Não'}</strong></p>
          </>}
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Formas de pagamento" subtitle="Defina cada modalidade como aceita, não aceita ou ainda a confirmar." />
          <div className="space-y-3 p-5">
            {draft.paymentMethods.map((method) => (
              <label key={method.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{method.label}</span>
                {isAdmin ? <select className={cx(inputCls(), 'max-w-48')} value={method.enabledOfficial === null ? 'pending' : method.enabledOfficial ? 'accepted' : 'rejected'} onChange={(event) => setPayment(method.id, event.target.value)}>
                  <option value="pending">A confirmar</option><option value="accepted">Aceita</option><option value="rejected">Não aceita</option>
                </select> : <Badge tone={method.enabledOfficial === true ? 'ok' : 'warn'}>{method.enabledOfficial === null ? 'A confirmar' : method.enabledOfficial ? 'Aceita' : 'Não aceita'}</Badge>}
              </label>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Etapas do funil" subtitle="Os identificadores internos são fixos; somente os rótulos podem mudar." />
          <div className="space-y-3 p-5">
            {draft.funnelStages.map((stage, index) => (
              <label key={stage.id} className="block text-sm"><span className="mb-1 block text-xs text-muted">{stage.id} (ID fixo)</span>
                {isAdmin ? <input className={inputCls()} value={stage.label} onChange={(event) => update((next) => { next.funnelStages[index].label = event.target.value })} /> : <strong>{stage.label}</strong>}
              </label>
            ))}
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title="Cadastros de apoio" subtitle="Adicione, renomeie, remova e reordene opções. A remoção pede confirmação porque pode haver registros históricos associados." />
        <div className="grid gap-6 p-5 lg:grid-cols-2">
          {lists.map(({ key, label }) => (
            <section key={key} className="min-w-0">
              <h3 className="mb-2 font-semibold">{label}</h3>
              <ol className="space-y-2">
                {draft[key].map((item, index) => (
                  <li key={key + '-' + index} className="flex items-center gap-2">
                    <input aria-label={label + ' ' + (index + 1)} className={inputCls()} value={item}
                      disabled={!isAdmin || (key === 'leadSources' && index === 0)}
                      onChange={(event) => {
                        const values = [...draft[key]]
                        values[index] = event.target.value
                        if (key === 'regions') {
                          const old = draft.regions[index]
                          update((next) => {
                            next.regions = values
                            next.officialRules.freight.regions = next.officialRules.freight.regions.map((region) => region.name === old ? { ...region, name: event.target.value } : region)
                          })
                        } else updateList(key, values)
                      }}
                      onBlur={(event) => renameItem(key, index, event.target.value)}
                    />
                    {isAdmin && <>
                      <Button size="sm" variant="secondary" disabled={index === (key === 'leadSources' ? 1 : 0)} onClick={() => moveItem(key, index, -1)}>↑</Button>
                      <Button size="sm" variant="secondary" disabled={index === draft[key].length - 1 || (key === 'leadSources' && index === 0)} onClick={() => moveItem(key, index, 1)}>↓</Button>
                      <Button size="sm" variant="danger" disabled={key === 'leadSources' && index === 0} onClick={() => removeItem(key, index)}>Remover</Button>
                    </>}
                  </li>
                ))}
              </ol>
              {listErrors[key] && <p className="mt-1 text-xs text-brand" role="alert">{listErrors[key]}</p>}
              {isAdmin && <div className="mt-3 flex gap-2">
                <input className={inputCls()} placeholder={'Nova opção de ' + label.toLowerCase()} value={newItems[key] ?? ''} onChange={(event) => setNewItems((current) => ({ ...current, [key]: event.target.value }))} />
                <Button size="sm" onClick={() => addItem(key)}>Adicionar</Button>
              </div>}
            </section>
          ))}
        </div>
      </Card>
      {isAdmin && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
        <div className="text-sm">{dirty ? <Badge tone="warn">Alterações não salvas</Badge> : 'Configurações sincronizadas.'}</div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={!dirty || saving} onClick={discard}>Descartar</Button>
          <Button variant="primary" disabled={!dirty || saving || Object.values(invalidFields).some(Boolean) || Object.values(listErrors).some(Boolean)} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar regras e cadastros'}</Button>
        </div>
      </div>}
    </div>
  )
}

function SettingsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-5" aria-label="Carregando configurações">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="grid grid-cols-3 gap-3">
          <div className="h-4 rounded bg-surface-2" />
          <div className="col-span-2 h-4 rounded bg-surface-2" />
        </div>
      ))}
    </div>
  )
}

function Configuracoes() {
  const {
    settings,
    settingsReady,
    currentRole,
    demoMode,
    saveSettings,
    saveProduct,
    toast,
  } = useStore()
  const isAdmin = currentRole === 'admin' || currentRole === 'administrador'
  const pend = pendingSettings(settings)
  const [companyDirty, setCompanyDirty] = useState(false)
  const [dirtyProducts, setDirtyProducts] = useState<Set<string>>(() => new Set())
  const hasUnsavedChanges = companyDirty || dirtyProducts.size > 0

  const onProductDirtyChange = useCallback((id: string, dirty: boolean) => {
    setDirtyProducts((current) => {
      const next = new Set(current)
      if (dirty) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const onToast = useCallback((title: string, body: string) => {
    toast({ tone: 'erro', title, body })
  }, [toast])

  const onCompanySave = async (company: CompanySettings) => {
    await saveSettings({ ...settings, company } satisfies AppSettings)
  }

  const blocker = useBlocker({
    shouldBlockFn: () => hasUnsavedChanges,
    enableBeforeUnload: hasUnsavedChanges,
    withResolver: true,
  })

  const ruleRows: [string, number | null, number | null, ((n: number) => string)?][] = [
    ['Frete — valor fixo', settings.officialRules.freight.fixed, settings.demoRules.freight.fixed],
    ['Frete — por km', settings.officialRules.freight.perKm, settings.demoRules.freight.perKm],
    ...settings.officialRules.freight.regions.map((region): [string, number | null, number | null] => [
      'Frete — ' + region.name,
      region.price,
      settings.demoRules.freight.regions.find((demo) => demo.id === region.id)?.price ?? null,
    ]),
    ['Bombeamento — fixo', settings.officialRules.pumping.fixed, settings.demoRules.pumping.fixed],
    ['Bombeamento — por m³', settings.officialRules.pumping.perM3, settings.demoRules.pumping.perM3],
    ['Bombeamento — por hora', settings.officialRules.pumping.perHour, settings.demoRules.pumping.perHour],
    ['Bombeamento — mínimo', settings.officialRules.pumping.minimum, settings.demoRules.pumping.minimum],
    ['Volume mínimo (m³)', settings.officialRules.minVolume.m3, settings.demoRules.minVolume.m3, (n) => num(n, 1) + ' m³'],
    ['Estadia — tolerância', settings.officialRules.stay.toleranceMin, settings.demoRules.stay.toleranceMin, (n) => n + ' min'],
    ['Estadia — por hora', settings.officialRules.stay.perHour, settings.demoRules.stay.perHour],
    ['Piso — área mínima', settings.officialRules.floor.minArea, settings.demoRules.floor.minArea, (n) => num(n, 0) + ' m²'],
    ['Desconto sem aprovação', settings.officialRules.maxDiscountPctWithoutApproval, settings.demoRules.maxDiscountPctWithoutApproval, (n) => n + '%'],
    ['Validade padrão', settings.officialRules.validityDays, settings.demoRules.validityDays, (n) => n + ' dias'],
  ]

  const products = settings.catalog

  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" description="Dados institucionais, catálogo e regras comerciais da Qualimix. Valores ausentes permanecem pendentes até confirmação." />

      {hasUnsavedChanges && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-warn/40 bg-warn-soft p-3 text-sm">
          <TriangleAlert className="h-4 w-4 shrink-0 text-warn" />
          <p className="flex-1"><strong>Há alterações não salvas.</strong> Salve ou descarte antes de sair desta página.</p>
          <Badge tone="warn">{(companyDirty ? 1 : 0) + dirtyProducts.size} item(ns) alterado(s)</Badge>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Pendências para operação" subtitle="Obrigatórias para propostas definitivas com valores oficiais." />
          <ul className="space-y-2 p-5 text-sm">
            {pend.map((item) => (
              <li key={item} className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-warn" /> {item}</li>
            ))}
            {!pend.length && <li className="flex items-center gap-2 text-ok"><CircleCheck className="h-4 w-4" /> Tudo configurado</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Dados institucionais"
            subtitle="Usados no cabeçalho das propostas em PDF."
            action={isAdmin && settingsReady ? <Badge tone={companyDirty ? 'warn' : 'ok'}>{companyDirty ? 'Alterações pendentes' : 'Sincronizado'}</Badge> : undefined}
          />
          {!settingsReady ? <SettingsSkeleton rows={5} /> : isAdmin ? (
            <CompanySettingsEditor
              company={settings.company}
              onSave={onCompanySave}
              onDirtyChange={setCompanyDirty}
              onToast={onToast}
            />
          ) : (
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-3 p-5 text-sm sm:grid-cols-[140px_1fr]">
              <dt className="text-muted">Nome comercial</dt><dd className="font-semibold"><PendingValue value={settings.company.tradeName} /></dd>
              <dt className="text-muted">Razão social</dt><dd><PendingValue value={settings.company.legalName} /></dd>
              <dt className="text-muted">CNPJ</dt><dd><PendingValue value={settings.company.cnpj}>{settings.company.cnpj ? formatDocument(settings.company.cnpj) : undefined}</PendingValue></dd>
              <dt className="text-muted">Telefone</dt><dd><PendingValue value={settings.company.phone}>{settings.company.phone ? formatPhone(settings.company.phone) : undefined}</PendingValue></dd>
              <dt className="text-muted">E-mail</dt><dd><PendingValue value={settings.company.email} /></dd>
              <dt className="text-muted">Endereço</dt><dd><PendingValue value={settings.company.address} /></dd>
              <dt className="text-muted">Logo</dt>
              <dd>
                {settings.company.logoUrl && isHttpsUrl(settings.company.logoUrl)
                  ? <img src={settings.company.logoUrl} alt="Logo institucional" className="max-h-12 max-w-36 object-contain" />
                  : <PendingValue value={settings.company.logoUrl} />}
              </dd>
            </dl>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Catálogo de produtos e serviços" subtitle="Edite os dados e o preço oficial de cada item. Preço vazio significa pendente; os valores de demonstração são fictícios e somente para consulta." />
        {!settingsReady ? (
          <SettingsSkeleton rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-3">Código</th>
                  <th className="px-3 py-3">Produto / descrição</th>
                  <th className="px-3 py-3">Categoria</th>
                  <th className="px-3 py-3">Unidade</th>
                  <th className="px-3 py-3 text-right">Preço oficial</th>
                  {demoMode && <th className="px-3 py-3 text-right">Demonstração</th>}
                  <th className="px-3 py-3">Status / vigência</th>
                  {isAdmin && <th className="px-3 py-3 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={isAdmin ? (demoMode ? 8 : 7) : (demoMode ? 7 : 6)} className="px-4 py-6 text-center text-sm text-muted">Nenhum produto cadastrado no banco de dados.</td></tr>
                ) : products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    isAdmin={isAdmin}
                    demoMode={demoMode}
                    onSave={saveProduct}
                    onDirtyChange={onProductDirtyChange}
                    onToast={onToast}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Regras comerciais" subtitle="Cada regra é independente. Regras oficiais não confirmadas permanecem pendentes." />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-2">Regra</th><th className="px-4 py-2 text-right">Oficial</th><th className="px-4 py-2 text-right">Demo</th></tr>
              </thead>
              <tbody>
                {ruleRows.map(([label, official, demo, formatter]) => (
                  <tr key={label} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">{label}</td>
                    <td className="px-4 py-2 text-right">{v(official, formatter)}</td>
                    <td className="px-4 py-2 text-right text-muted">{v(demo, formatter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Formas de pagamento" subtitle="Modalidades oficiais configuradas para a Qualimix." />
            <ul className="flex flex-wrap gap-2 p-5">
              {settings.paymentMethods.map((method) => (
                <li key={method.id}>
                  <Badge tone={method.enabledOfficial ? 'ok' : 'warn'}>
                    {method.label}: {method.enabledOfficial === null ? 'a confirmar' : method.enabledOfficial ? 'aceita' : 'não aceita'}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Cadastros de apoio" />
            <div className="space-y-3 p-5 text-sm">
              <p><strong>Origens de lead:</strong> {settings.leadSources.join(', ')}</p>
              <p><strong>Regiões atendidas:</strong> {settings.regions.join(', ')}</p>
              <p><strong>Etapas do funil:</strong> {settings.funnelStages.map((stage) => stage.label).join(' → ')}</p>
              <p><strong>Numeração de orçamentos:</strong> ORC-AAAA-NNNN, sequencial e única</p>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Usuários e permissões" subtitle="Perfis previstos. As permissões são aplicadas no servidor e no banco de dados, não apenas na interface." action={<Lock className="h-5 w-5 text-brand" />} />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {permissions.map(([role, items]) => (
            <div key={role} className="rounded-md border border-line p-3">
              <p className="font-display text-lg font-bold uppercase">{role}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted">
                {items.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {blocker.status === 'blocked' && (
        <div className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title">
          <div className="w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-1 h-5 w-5 shrink-0 text-warn" />
              <div>
                <h2 id="unsaved-title" className="text-lg font-bold">Você tem alterações não salvas</h2>
                <p className="mt-2 text-sm text-muted">Sair agora descartará as alterações desta tela que ainda não foram salvas. Deseja continuar?</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => blocker.reset()}>Continuar editando</Button>
              <Button type="button" variant="danger" onClick={() => blocker.proceed()}>Sair sem salvar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
