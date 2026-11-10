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
