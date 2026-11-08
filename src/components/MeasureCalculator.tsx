import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { computeElement, type MeasureElement, type MeasureKind, type MeasureSummary } from '../lib/quote'
import { num, parseDecimal } from '../lib/format'
import { elementTypes as defaultElementTypes } from '../data/settings'
import { Button, cx, inputCls } from './ui'

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2)

export const blankElement = (kind: MeasureKind): MeasureElement => ({
  id: newId(),
  label: '',
  elementType: kind === 'volume' ? 'Laje H8' : 'Piso',
  mode: 'dimensoes',
  length: '',
  width: '',
  thicknessCm: '',
  depth: '',
  diameter: '',
  factor: '',
  count: '1',
  informed: '',
  notes: '',
})

const normalizeType = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

function optionsFor(kind: MeasureKind, current: string, elementTypes: string[]) {
  const available =
    kind === 'area'
      ? elementTypes.filter((type) => ['piso', 'calçada', 'outro'].includes(normalizeType(type)))
      : elementTypes.filter((type) => !['piso', 'calçada'].includes(normalizeType(type)))
  return available.includes(current) ? available : [current, ...available]
}

function depthValue(element: MeasureElement) {
  if ((element.depth ?? '').trim()) return element.depth ?? ''
  const legacy = parseDecimal(element.thicknessCm ?? '')
  return legacy.ok && legacy.value !== null ? String(legacy.value / 100) : ''
}

function formulaFor(element: MeasureElement, kind: MeasureKind) {
  if (element.mode === 'informado') {
    return kind === 'volume' ? 'Volume total informado diretamente pelo cliente.' : 'Área total informada diretamente pelo cliente.'
  }

  const type = normalizeType(element.elementType)
  const length = (element.length || '—') + ' m'
  const width = (element.width || '—') + ' m'
  const count = (element.count || '1') + ' unidade(s)'

  if (kind === 'area') return length + ' × ' + width + ' × ' + count

  if (type === 'estaca' || type === 'estacas' || type === 'tubulao') {
    return 'π × (' + (element.diameter || '—') + ' m ÷ 2)² × ' + (element.depth || '—') + ' m × ' + count
  }

  if (type === 'escada') {
    return (element.length || '—') + ' m linear × ' + (element.factor || '—') + ' m³/m × ' + count
  }

  if (type.startsWith('laje h')) {
    const height = type.match(/^laje h\s*(\d+(?:[.,]\d+)?)/)?.[1] ?? '—'
    return length + ' × ' + width + ' × ' + height + ' cm ÷ 100 × ' + count
  }

  if (type === 'laje') {
    return length + ' × ' + width + ' × ' + (element.thicknessCm || '—') + ' cm ÷ 100 × ' + count
  }

  if (type === 'pilar') {
    return (element.length || '—') + ' m de altura × ' + width + ' × ' + depthValue(element) + ' m de espessura × ' + count
  }

  return length + ' × ' + width + ' × ' + depthValue(element) + ' m de profundidade × ' + count
}

/** Calculadora visual que apresenta somente as medidas necessárias ao elemento selecionado. */
export function MeasureCalculator({
  kind,
  elements,
  margin,
  summary,
  onChange,
  onMargin,
  elementTypes = defaultElementTypes,
}: {
  kind: MeasureKind
  elements: MeasureElement[]
  margin: string
  summary: MeasureSummary
  onChange: (els: MeasureElement[]) => void
  onMargin: (v: string) => void
  elementTypes?: string[]
}) {
  const unit = kind === 'volume' ? 'm³' : 'm²'
  const results = useMemo(() => elements.map((element) => computeElement(element, kind)), [elements, kind])
  const patch = (id: string, value: Partial<MeasureElement>) =>
    onChange(elements.map((element) => (element.id === id ? { ...element, ...value } : element)))

  return (
    <div>
      <div className="space-y-3">
        {elements.map((element, index) => {
          const result = results[index]
          const type = normalizeType(element.elementType)
          const isSlab = type.startsWith('laje')
          const isLegacySlab = type === 'laje'
          const isPile = type === 'estaca' || type === 'estacas' || type === 'tubulao'
          const isStair = type === 'escada'
          const isPillar = type === 'pilar'
          const factorListId = 'stair-factor-' + element.id.replace(/[^a-zA-Z0-9_-]/g, '')
          const typeOptions = optionsFor(kind, element.elementType, elementTypes)

          return (
            <div
              key={element.id}
              className={cx(
                'rounded-md border p-3',
                result.error ? 'border-brand/60 bg-brand-soft/40' : 'border-line bg-surface-2',
              )}
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(170px,auto)]">
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-semibold text-muted">Tipo do elemento</label>
                  <select
                    aria-label={'Tipo do elemento ' + (index + 1)}
                    className={inputCls()}
                    value={element.elementType}
                    onChange={(event) => patch(element.id, { elementType: event.target.value })}
                  >
                    {typeOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  {kind === 'volume' && isSlab && !isLegacySlab && (
                    <p className="mt-1 text-[11px] text-muted">A altura nominal do modelo H é aplicada automaticamente em centímetros.</p>
                  )}
                  {kind === 'volume' && isLegacySlab && (
                    <p className="mt-1 text-[11px] text-muted">Para novos cálculos, prefira selecionar Laje H8, H10, H12, H15 ou H20.</p>
                  )}
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-semibold text-muted">Entrada</label>
                  <select
                    aria-label={'Forma de entrada do elemento ' + (index + 1)}
                    className={inputCls()}
                    value={element.mode}
                    onChange={(event) => patch(element.id, { mode: event.target.value as MeasureElement['mode'] })}
                  >
                    <option value="dimensoes">Calcular pelas dimensões</option>
                    <option value="informado">{kind === 'volume' ? 'Informar volume total' : 'Informar área total'}</option>
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-muted">Identificação (opcional)</label>
                <input
                  aria-label={'Identificação do elemento ' + (index + 1)}
                  className={cx(inputCls(), 'h-9 text-sm')}
                  placeholder="Ex.: laje da garagem, pilar P1, trecho dos fundos…"
                  value={element.label}
                  onChange={(event) => patch(element.id, { label: event.target.value })}
                />
              </div>

              {element.mode === 'informado' ? (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumIn
                    label={kind === 'volume' ? 'Volume total (m³)' : 'Área total (m²)'}
                    value={element.informed}
                    onChange={(value) => patch(element.id, { informed: value })}
                  />
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {kind === 'area' ? (
                    <>
                      <NumIn label="Comprimento (m)" value={element.length} onChange={(value) => patch(element.id, { length: value })} />
                      <NumIn label="Largura (m)" value={element.width} onChange={(value) => patch(element.id, { width: value })} />
                    </>
                  ) : isPile ? (
                    <>
                      <NumIn label="Diâmetro (m)" value={element.diameter ?? ''} onChange={(value) => patch(element.id, { diameter: value })} />
                      <NumIn label="Profundidade (m)" value={element.depth ?? ''} onChange={(value) => patch(element.id, { depth: value, thicknessCm: '' })} />
                    </>
                  ) : isStair ? (
                    <>
                      <NumIn label="Metro linear (m)" value={element.length} onChange={(value) => patch(element.id, { length: value })} />
                      <NumIn
                        label="Índice de cálculo (m³ por metro)"
                        value={element.factor ?? ''}
                        onChange={(value) => patch(element.id, { factor: value })}
                        listId={factorListId}
                        placeholder="1,5 / 2 / 3"
                      />
                      <datalist id={factorListId}>
                        <option value="1,5" />
                        <option value="2" />
                        <option value="3" />
                      </datalist>
                    </>
                  ) : isSlab && !isLegacySlab ? (
                    <>
                      <NumIn label="Comprimento (m)" value={element.length} onChange={(value) => patch(element.id, { length: value })} />
                      <NumIn label="Largura (m)" value={element.width} onChange={(value) => patch(element.id, { width: value })} />
                    </>
                  ) : isLegacySlab ? (
                    <>
                      <NumIn label="Comprimento (m)" value={element.length} onChange={(value) => patch(element.id, { length: value })} />
                      <NumIn label="Largura (m)" value={element.width} onChange={(value) => patch(element.id, { width: value })} />
                      <NumIn label="Espessura legada (cm)" value={element.thicknessCm} onChange={(value) => patch(element.id, { thicknessCm: value })} />
                    </>
                  ) : isPillar ? (
                    <>
                      <NumIn label="Altura (m)" value={element.length} onChange={(value) => patch(element.id, { length: value })} />
                      <NumIn label="Largura (m)" value={element.width} onChange={(value) => patch(element.id, { width: value })} />
                      <NumIn label="Espessura (m)" value={depthValue(element)} onChange={(value) => patch(element.id, { depth: value, thicknessCm: '' })} />
                    </>
                  ) : (
                    <>
                      <NumIn label="Comprimento (m)" value={element.length} onChange={(value) => patch(element.id, { length: value })} />
                      <NumIn label="Largura (m)" value={element.width} onChange={(value) => patch(element.id, { width: value })} />
                      <NumIn
                        label="Profundidade (m)"
                        value={depthValue(element)}
                        onChange={(value) => patch(element.id, { depth: value, thicknessCm: '' })}
                      />
                    </>
                  )}
                  <NumIn
                    label="Quantidade de elementos"
                    value={element.count}
                    onChange={(value) => patch(element.id, { count: value })}
                    narrow
                  />
                </div>
              )}

              <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Fórmula aplicada</p>
                  <p className="text-sm text-ink-2">{formulaFor(element, kind)}</p>
                  {result.error && <p role="alert" className="mt-1 text-xs font-semibold text-brand">{result.error}</p>}
                  {result.incomplete && <p className="mt-1 text-xs text-muted">Preencha as medidas para calcular o resultado.</p>}
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2">
                  <div className="text-right">
                    <div className="text-xs font-semibold text-muted">Resultado</div>
                    <div className="font-display text-xl font-bold tabular">
                      {result.value !== null ? num(result.value, 3) + ' ' + unit : '—'}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={'Remover elemento ' + (index + 1)}
                    onClick={() => onChange(elements.filter((item) => item.id !== element.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <input
                aria-label={'Observações do elemento ' + (index + 1)}
                placeholder="Observações (opcional): etapa, pavimento, trecho…"
                className={cx(inputCls(), 'mt-2 h-9 text-sm')}
                value={element.notes}
                onChange={(event) => patch(element.id, { notes: event.target.value })}
              />
            </div>
          )
        })}
      </div>

      <Button size="sm" className="mt-3" onClick={() => onChange([...elements, blankElement(kind)])}>
        <Plus className="h-4 w-4" /> Adicionar elemento ou etapa
      </Button>

      <div className="mt-4 grid gap-3 rounded-md border border-line p-4 sm:grid-cols-[180px_1fr]">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">Margem de segurança (%)</label>
          <input
            aria-label="Margem de segurança (%)"
            inputMode="decimal"
            className={inputCls(!!summary.marginError)}
            value={margin}
            placeholder="Opcional"
            onChange={(event) => onMargin(event.target.value)}
          />
          {summary.marginError && <p className="mt-1 text-xs font-semibold text-brand">{summary.marginError}</p>}
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat label={kind === 'volume' ? 'Volume calculado' : 'Área calculada'} value={num(summary.base, 3) + ' ' + unit} />
          <Stat label={'Margem (' + num(summary.marginPct, 1) + '%)'} value={num(summary.marginValue, 3) + ' ' + unit} />
          <Stat strong label="Estimado p/ orçamento" value={num(summary.estimated, 3) + ' ' + unit} />
        </dl>
      </div>
      <p className="mt-2 text-xs text-muted">
        {kind === 'volume'
          ? 'As medidas lineares são informadas em metros. Lajes usam a altura nominal H8/H10/H12 etc.; estacas e tubulões usam π × raio² × profundidade; escadas usam metro linear × índice editável.'
          : 'Piso e calçada são calculados por comprimento × largura × quantidade, com resultado em m².'}{' '}
        Os cálculos internos mantêm precisão total; a quantidade cobrada é arredondada conforme as regras comerciais. Estimativa geométrica comercial — não substitui o dimensionamento ou a especificação técnica de engenharia.
      </p>
    </div>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cx('rounded px-2 py-2', strong ? 'bg-ink text-bg' : 'bg-surface-2')}>
      <dt className={cx('text-[11px] font-semibold uppercase tracking-wide', strong ? 'text-bg/70' : 'text-muted')}>{label}</dt>
      <dd className="font-display text-lg font-bold tabular sm:text-xl">{value}</dd>
    </div>
  )
}

function NumIn({
  label,
  value,
  onChange,
  narrow,
  listId,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  narrow?: boolean
  listId?: string
  placeholder?: string
}) {
  return (
    <div className={cx('min-w-0', narrow ? 'max-w-44' : '')}>
      <label className="mb-1 block text-xs font-semibold text-muted">{label}</label>
      <input
        aria-label={label}
        inputMode="decimal"
        list={listId}
        className={inputCls()}
        value={value}
        placeholder={placeholder ?? '0,00'}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
