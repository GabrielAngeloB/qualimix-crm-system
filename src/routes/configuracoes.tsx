import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CircleCheck, Lock, Plus, RotateCcw, Save } from 'lucide-react'
import type { AppSettings, PaymentMethod } from '../data/settings'
import type { CatalogItem, CommercialRules, Unit } from '../lib/quote'
import { categoryLabel, pendingSettings, validateSettings } from '../data/settings'
import { Badge, Button, Card, CardHeader, PageHeader, inputCls } from '../components/ui'
import { useStore } from '../data/store'

export const Route = createFileRoute('/configuracoes')({
  head: () => ({
    meta: [
      { title: 'Configurações — Qualimix CRM' },
      { name: 'description', content: 'Identidade da empresa, catálogo, preços, regras comerciais e cadastros de apoio.' },
      { property: 'og:title', content: 'Configurações — Qualimix CRM' },
      { property: 'og:description', content: 'Configure os dados e parâmetros utilizados pelo CRM e pelos orçamentos.' },
    ],
  }),
  component: Configuracoes,
})

type NumberValue = number | null
type RuleTarget = 'officialRules' | 'demoRules'

function TextInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string | null | undefined
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block min-w-0 text-sm">
      <span className="mb-1 block font-medium text-ink-2">{label}</span>
      <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={inputCls()} />
    </label>
  )
}

function NumberInput({ label, value, onChange, step = '0.01', suffix }: {
  label: string
  value: NumberValue
  onChange: (value: NumberValue) => void
  step?: string
  suffix?: string
}) {
  return (
    <label className="block min-w-0 text-sm">
      <span className="mb-1 block font-medium text-ink-2">{label}{suffix ? ' (' + suffix + ')' : ''}</span>
      <input
        type="number"
        min="0"
        step={step}
        inputMode="decimal"
        value={value ?? ''}
        placeholder="Não definido"
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        className={inputCls()}
      />
    </label>
  )
}

function TextList({ title, description, values, onChange }: {
  title: string
  description?: string
  values: string[]
  onChange: (values: string[]) => void
}) {
  return (
    <label className="block text-sm">
      <span className="block font-semibold">{title}</span>
      {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      <textarea
        rows={Math.min(8, Math.max(3, values.length))}
        value={values.join('\n')}
        onChange={(event) => onChange(event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))}
        className={inputCls() + ' mt-2 h-auto min-h-24 py-2'}
      />
      <span className="mt-1 block text-xs text-muted">Um item por linha.</span>
    </label>
  )
}

function Configuracoes() {
  const { settings, settingsReady, saveSettings, toast } = useStore()
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settingsReady) setDraft(settings)
  }, [settings, settingsReady])

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)
  const pend = pendingSettings(draft)

  const patchCompany = (key: keyof AppSettings['company'], value: string) => {
    setDraft((current) => ({ ...current, company: { ...current.company, [key]: value.trim() || null, ...(key === 'tradeName' ? { tradeName: value } : {}) } }))
  }
  const patchCatalog = (id: string, patch: Partial<CatalogItem>) => {
    setDraft((current) => ({ ...current, catalog: current.catalog.map((item) => item.id === id ? { ...item, ...patch } : item) }))
  }
  const patchPayment = (id: string, patch: Partial<PaymentMethod>) => {
    setDraft((current) => ({ ...current, paymentMethods: current.paymentMethods.map((method) => method.id === id ? { ...method, ...patch } : method) }))
  }
  const patchRule = (target: RuleTarget, patch: Partial<CommercialRules>) => {
    setDraft((current) => ({ ...current, [target]: { ...current[target], ...patch } }))
  }
  const patchRuleGroup = (target: RuleTarget, group: 'freight' | 'pumping' | 'minVolume' | 'stay' | 'floor', patch: Record<string, unknown>) => {
    setDraft((current) => ({
      ...current,
      [target]: {
        ...current[target],
        [group]: { ...current[target][group], ...patch },
      },
    }))
  }
  const updateRegionNames = (nextRegions: string[]) => {
    setDraft((current) => {
      const align = (existing: CommercialRules['freight']['regions']) => nextRegions.map((name, index) => ({
        ...(existing[index] ?? { id: 'regiao-' + (index + 1), price: null }),
        name,
      }))
      return {
        ...current,
        regions: nextRegions,
        officialRules: { ...current.officialRules, freight: { ...current.officialRules.freight, regions: align(current.officialRules.freight.regions) } },
        demoRules: { ...current.demoRules, freight: { ...current.demoRules.freight, regions: align(current.demoRules.freight.regions) } },
      }
    })
  }
  const addCatalogItem = () => {
    const id = 'custom-' + crypto.randomUUID()
    setDraft((current) => ({ ...current, catalog: [...current.catalog, { id, code: 'NOVO-' + (current.catalog.length + 1), name: 'Novo produto ou serviço', category: 'servico', unit: 'un', description: '', basePrice: null, demoPrice: null, active: true, validFrom: null }] }))
  }
  const addPaymentMethod = () => {
    const id = 'custom-' + crypto.randomUUID()
    setDraft((current) => ({ ...current, paymentMethods: [...current.paymentMethods, { id, label: 'Nova forma de pagamento', enabledOfficial: null, enabledDemo: false }] }))
  }
  const updateStageLabels = (labels: string[]) => {
    setDraft((current) => ({
      ...current,
      funnelStages: current.funnelStages.map((stage, index) => ({ ...stage, label: labels[index] ?? stage.label })),
    }))
  }

  const confirm = () => {
    setSaving(true)
    try {
      const next = validateSettings(draft)
      saveSettings(next)
      setDraft(next)
      toast({ tone: 'ok', title: 'Configurações salvas', body: 'Os novos valores já estão disponíveis no CRM neste navegador.' })
    } catch (error) {
      toast({ tone: 'erro', title: 'Não foi possível salvar', body: error instanceof Error ? error.message : 'Revise os campos e tente novamente.' })
    } finally {
      setSaving(false)
    }
  }

  const discard = () => setDraft(settings)

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Configurações"
        description="Edite os dados da empresa, os preços, as regras comerciais e as listas utilizadas pelo CRM. As alterações só entram em vigor depois de confirmar."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={discard} disabled={!dirty}><RotateCcw className="h-4 w-4" /> Descartar</Button>
            <Button variant="primary" onClick={confirm} disabled={!dirty || saving || !settingsReady}><Save className="h-4 w-4" /> Confirmar alterações</Button>
          </div>
        }
      />

      {!settingsReady && <Card><div className="p-5 text-sm text-muted">Carregando configurações salvas…</div></Card>}

      {settingsReady && (
        <>
          <Card className="mb-6">
            <CardHeader title="Resumo da configuração" subtitle="Pendências e dados que ainda precisam de confirmação administrativa." />
            <div className="flex flex-wrap items-center gap-2 p-5">
              <Badge tone={pend.length ? 'warn' : 'ok'}>{pend.length ? pend.length + ' pendências' : 'Tudo configurado'}</Badge>
              {pend.length ? <span className="text-sm text-muted">{pend.join(' · ')}</span> : <span className="text-sm text-ok"><CircleCheck className="mr-1 inline h-4 w-4" /> Pronto para utilizar os valores confirmados.</span>}
            </div>
          </Card>

          <Card className="mb-6">
            <CardHeader title="Identidade e dados da empresa" subtitle="Estas informações aparecem no cabeçalho das propostas comerciais e nos documentos." />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextInput label="Nome comercial" value={draft.company.tradeName} onChange={(value) => setDraft((current) => ({ ...current, company: { ...current.company, tradeName: value } }))} />
              <TextInput label="Razão social" value={draft.company.legalName} onChange={(value) => patchCompany('legalName', value)} />
              <TextInput label="CNPJ" value={draft.company.cnpj} onChange={(value) => patchCompany('cnpj', value)} />
              <TextInput label="Telefone" value={draft.company.phone} onChange={(value) => patchCompany('phone', value)} />
              <TextInput label="E-mail" value={draft.company.email} onChange={(value) => patchCompany('email', value)} type="email" />
              <TextInput label="Endereço completo" value={draft.company.address} onChange={(value) => patchCompany('address', value)} />
              <div className="sm:col-span-2">
                <TextInput label="URL pública do logotipo (opcional)" value={draft.company.logoUrl} onChange={(value) => patchCompany('logoUrl', value)} placeholder="https://…" />
                {draft.company.logoUrl && <img src={draft.company.logoUrl} alt="Prévia do logotipo da empresa" className="mt-3 max-h-16 max-w-48 object-contain" />}
              </div>
            </div>
          </Card>

          <Card className="mb-6">
            <CardHeader title="Catálogo de produtos e serviços" subtitle="Altere nome, código, descrição, preço oficial e preço de demonstração. Preço oficial vazio continua pendente e bloqueia a emissão definitiva." />
            <div className="flex justify-end border-b border-line p-3"><Button size="sm" onClick={addCatalogItem}><Plus className="h-4 w-4" /> Adicionar item</Button></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-3">Código</th>
                    <th className="px-3 py-3">Produto ou serviço</th>
                    <th className="px-3 py-3">Categoria / unidade</th>
                    <th className="px-3 py-3 text-right">Preço oficial (R$)</th>
                    <th className="px-3 py-3 text-right">Preço demo (R$)</th>
                    <th className="px-3 py-3">Ativo</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.catalog.map((item) => (
                    <tr key={item.id} className="border-b border-line align-top last:border-0">
                      <td className="w-32 px-3 py-3"><input aria-label={'Código ' + item.name} value={item.code} onChange={(event) => patchCatalog(item.id, { code: event.target.value })} className={inputCls()} /></td>
                      <td className="min-w-64 px-3 py-3">
                        <input aria-label={'Nome ' + item.code} value={item.name} onChange={(event) => patchCatalog(item.id, { name: event.target.value })} className={inputCls()} />
                        <input aria-label={'Descrição ' + item.code} value={item.description} onChange={(event) => patchCatalog(item.id, { description: event.target.value })} className={inputCls() + ' mt-2 text-xs'} />
                        {item.fck !== undefined && <div className="mt-2"><NumberInput label="FCK (MPa)" value={item.fck ?? null} step="1" onChange={(value) => patchCatalog(item.id, { fck: value ?? undefined })} /></div>}
                      </td>
                      <td className="w-44 px-3 py-3">
                        <select aria-label={'Categoria ' + item.code} value={item.category} onChange={(event) => patchCatalog(item.id, { category: event.target.value as CatalogItem['category'] })} className={inputCls()}>
                          {Object.entries(categoryLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                        <select aria-label={'Unidade ' + item.code} value={item.unit} onChange={(event) => patchCatalog(item.id, { unit: event.target.value as Unit })} className={inputCls() + ' mt-2'}>{(['m³', 'm²', 'un', 'h', 'km', 'viagem', 'diária'] as Unit[]).map((unit) => <option key={unit}>{unit}</option>)}</select>
                      </td>
                      <td className="w-40 px-3 py-3"><NumberInput label={'Oficial ' + item.code} value={item.basePrice} onChange={(value) => patchCatalog(item.id, { basePrice: value })} /></td>
                      <td className="w-40 px-3 py-3"><NumberInput label={'Demo ' + item.code} value={item.demoPrice} onChange={(value) => patchCatalog(item.id, { demoPrice: value })} /></td>
                      <td className="px-3 py-3"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={item.active} onChange={(event) => patchCatalog(item.id, { active: event.target.checked })} className="accent-[var(--brand)]" /> Ativo</label></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mb-6 grid gap-6 xl:grid-cols-2">
            <RulesEditor title="Regras oficiais da empresa" subtitle="Valores que serão usados nos orçamentos reais." target="officialRules" settings={draft} patchRule={patchRule} patchRuleGroup={patchRuleGroup} />
            <RulesEditor title="Regras de demonstração" subtitle="Valores fictícios usados apenas quando a demonstração estiver ativa." target="demoRules" settings={draft} patchRule={patchRule} patchRuleGroup={patchRuleGroup} />
          </div>

          <Card className="mb-6">
            <CardHeader title="Formas de pagamento" subtitle="Defina o nome e se cada modalidade é aceita oficialmente. A opção de demonstração é separada." />
            <div className="flex justify-end border-b border-line p-3"><Button size="sm" onClick={addPaymentMethod}><Plus className="h-4 w-4" /> Adicionar modalidade</Button></div>
            <div className="divide-y divide-line">
              {draft.paymentMethods.map((method) => (
                <div key={method.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_180px_160px] sm:items-end">
                  <TextInput label="Nome da modalidade" value={method.label} onChange={(value) => patchPayment(method.id, { label: value })} />
                  <label className="block text-sm"><span className="mb-1 block font-medium text-ink-2">Aceita oficialmente?</span><select className={inputCls()} value={method.enabledOfficial === null ? 'pending' : method.enabledOfficial ? 'yes' : 'no'} onChange={(event) => patchPayment(method.id, { enabledOfficial: event.target.value === 'pending' ? null : event.target.value === 'yes' })}><option value="pending">A confirmar</option><option value="yes">Sim</option><option value="no">Não</option></select></label>
                  <label className="inline-flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={method.enabledDemo} onChange={(event) => patchPayment(method.id, { enabledDemo: event.target.checked })} className="accent-[var(--brand)]" /> Habilitada na demo</label>
                </div>
              ))}
            </div>
          </Card>

          <Card className="mb-6">
            <CardHeader title="Cadastros de apoio" subtitle="As listas alteradas aqui passam a aparecer nos formulários e nos filtros do CRM." />
            <div className="grid gap-6 p-5 md:grid-cols-2">
              <TextList title="Origens de lead" values={draft.leadSources} onChange={(values) => setDraft((current) => ({ ...current, leadSources: values }))} />
              <TextList title="Regiões atendidas" values={draft.regions} onChange={updateRegionNames} />
              <TextList title="Etapas do funil" description="Edite os nomes mantendo a ordem e os identificadores internos do fluxo." values={draft.funnelStages.map((stage) => stage.label)} onChange={updateStageLabels} />
              <TextList title="Motivos de perda" values={draft.lossReasons} onChange={(values) => setDraft((current) => ({ ...current, lossReasons: values }))} />
              <TextList title="Tipos de cliente" values={draft.clientTypes} onChange={(values) => setDraft((current) => ({ ...current, clientTypes: values }))} />
              <TextList title="Tipos de elemento para cálculo" values={draft.elementTypes} onChange={(values) => setDraft((current) => ({ ...current, elementTypes: values }))} />
            </div>
          </Card>

          <Card className="mb-6">
            <CardHeader title="Perfis de acesso" subtitle="Os nomes dos perfis são informativos até a autenticação e as permissões do servidor serem ativadas." action={<Lock className="h-5 w-5 text-muted" />} />
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ['Administrador', 'Configurações, usuários e todos os módulos'],
                ['Comercial', 'Clientes, funil e orçamentos'],
                ['Operação', 'Pedidos e agenda'],
                ['Financeiro', 'Contas e pagamentos'],
                ['Consulta', 'Somente leitura'],
              ].map(([role, detail]) => <div key={role} className="rounded-md border border-line p-3"><p className="font-display text-lg font-bold uppercase">{role}</p><p className="mt-1 text-xs text-muted">{detail}</p></div>)}
            </div>
            <p className="px-5 pb-5 text-xs text-muted">Os perfis não podem ser alterados nem aplicados enquanto não existir autenticação ativa. A edição aqui poderia dar uma falsa impressão de controle de acesso.</p>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
            <div className="text-sm text-muted">As configurações são gravadas neste navegador e reaparecem quando o CRM for aberto aqui. Sincronização entre usuários e dispositivos depende da integração com o banco de dados.</div>
            <div className="flex gap-2">
              <Button onClick={discard} disabled={!dirty}><RotateCcw className="h-4 w-4" /> Descartar</Button>
              <Button variant="primary" onClick={confirm} disabled={!dirty || saving}><Save className="h-4 w-4" /> Confirmar e salvar</Button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function RulesEditor({ title, subtitle, target, settings, patchRule, patchRuleGroup }: {
  title: string
  subtitle: string
  target: RuleTarget
  settings: AppSettings
  patchRule: (target: RuleTarget, patch: Partial<CommercialRules>) => void
  patchRuleGroup: (target: RuleTarget, group: 'freight' | 'pumping' | 'minVolume' | 'stay' | 'floor', patch: Record<string, unknown>) => void
}) {
  const rules = settings[target]
  const freight = rules.freight
  const pumping = rules.pumping
  const minVolume = rules.minVolume
  const stay = rules.stay
  const floor = rules.floor
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="space-y-5 p-5">
        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">Frete</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput label="Valor fixo (R$)" value={freight.fixed} onChange={(value) => patchRuleGroup(target, 'freight', { fixed: value })} />
            <NumberInput label="Preço por km (R$)" value={freight.perKm} onChange={(value) => patchRuleGroup(target, 'freight', { perKm: value })} />
          </div>
          <div className="mt-3 space-y-2">
            {freight.regions.map((region, index) => (
              <div key={region.id} className="grid grid-cols-[1fr_145px] items-center gap-2">
                <span className="text-sm">{region.name}</span>
                <NumberInput label={'Frete ' + region.name} value={region.price} onChange={(value) => patchRuleGroup(target, 'freight', { regions: freight.regions.map((item, itemIndex) => itemIndex === index ? { ...item, price: value } : item) })} />
              </div>
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">Bombeamento</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput label="Valor fixo (R$)" value={pumping.fixed} onChange={(value) => patchRuleGroup(target, 'pumping', { fixed: value })} />
            <NumberInput label="Por m³ (R$)" value={pumping.perM3} onChange={(value) => patchRuleGroup(target, 'pumping', { perM3: value })} />
            <NumberInput label="Por hora (R$)" value={pumping.perHour} onChange={(value) => patchRuleGroup(target, 'pumping', { perHour: value })} />
            <NumberInput label="Valor mínimo (R$)" value={pumping.minimum} onChange={(value) => patchRuleGroup(target, 'pumping', { minimum: value })} />
          </div>
        </section>
        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">Volume mínimo</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput label="Volume mínimo" suffix="m³" value={minVolume.m3} onChange={(value) => patchRuleGroup(target, 'minVolume', { m3: value })} />
            <NumberInput label="Valor mínimo do pedido" suffix="R$" value={minVolume.minOrderValue} onChange={(value) => patchRuleGroup(target, 'minVolume', { minOrderValue: value })} />
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={minVolume.chargeDifference} onChange={(event) => patchRuleGroup(target, 'minVolume', { chargeDifference: event.target.checked })} className="accent-[var(--brand)]" /> Cobrar a diferença até o volume mínimo</label>
        </section>
        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">Estadia e pisos</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput label="Tolerância de estadia" suffix="min" value={stay.toleranceMin} step="1" onChange={(value) => patchRuleGroup(target, 'stay', { toleranceMin: value })} />
            <NumberInput label="Preço por hora de estadia" suffix="R$" value={stay.perHour} onChange={(value) => patchRuleGroup(target, 'stay', { perHour: value })} />
            <NumberInput label="Área mínima de piso" suffix="m²" value={floor.minArea} onChange={(value) => patchRuleGroup(target, 'floor', { minArea: value })} />
            <NumberInput label="Desconto sem aprovação" suffix="%" value={rules.maxDiscountPctWithoutApproval} onChange={(value) => patchRule(target, { maxDiscountPctWithoutApproval: value })} />
            <NumberInput label="Validade padrão da proposta" suffix="dias" step="1" value={rules.validityDays} onChange={(value) => patchRule(target, { validityDays: value })} />
            <NumberInput label="Casas decimais de quantidades" step="1" value={rules.quantityDecimals} onChange={(value) => patchRule(target, { quantityDecimals: value ?? 2 })} />
          </div>
        </section>
      </div>
    </Card>
  )
}
