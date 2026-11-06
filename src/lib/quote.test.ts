import { describe, expect, it } from 'vitest'
import {
  computeElement,
  computeQuote,
  defaultExtras,
  summarizeMeasures,
  type MeasureElement,
  type QuoteExtras,
  type QuoteLine,
} from './quote'
import { quoteContext } from '../data/derived'

const el = (p: Partial<MeasureElement>): MeasureElement => ({
  id: Math.random().toString(36),
  label: '',
  elementType: 'Laje',
  mode: 'dimensoes',
  length: '',
  width: '',
  thicknessCm: '',
  count: '1',
  informed: '',
  notes: '',
  ...p,
})

const line = (catalogId: string | null, p: Partial<QuoteLine> = {}): QuoteLine => ({
  id: Math.random().toString(36),
  catalogId,
  description: catalogId ?? 'Item livre',
  unit: 'm³',
  category: 'concreto',
  quantityMode: 'manual',
  quantity: '',
  unitPriceInput: '',
  discountPct: '',
  ...p,
})

const demo = quoteContext(true)
const official = quoteContext(false)
const noMeasures = summarizeMeasures([], '', 'volume')
const noArea = summarizeMeasures([], '', 'area')

function quote(lines: QuoteLine[], opts: { volume?: ReturnType<typeof summarizeMeasures>; area?: ReturnType<typeof summarizeMeasures>; extras?: Partial<QuoteExtras>; pay?: string[] } = {}, ctx = demo) {
  return computeQuote(
    {
      clientId: 'cl-1',
      siteId: 'ob-1',
      lines,
      volume: opts.volume ?? noMeasures,
      area: opts.area ?? noArea,
      extras: { ...defaultExtras(), ...opts.extras },
      paymentMethodIds: opts.pay ?? ['pix'],
    },
    ctx,
  )
}

describe('calculadora de volume', () => {
  it('converte espessura de cm para m: 12 × 8 × 12 cm = 11,52 m³', () => {
    const r = computeElement(el({ length: '12', width: '8', thicknessCm: '12' }), 'volume')
    expect(r.error).toBeNull()
    expect(r.value).toBeCloseTo(11.52, 10)
  })

  it('multiplica pela quantidade de elementos iguais e aceita vírgula decimal', () => {
    const r = computeElement(el({ length: '30', width: '0,15', thicknessCm: '40', count: '4' }), 'volume')
    expect(r.value).toBeCloseTo(7.2, 10)
  })

  it('soma múltiplos elementos e exibe margem separadamente sem arredondar', () => {
    const s = summarizeMeasures(
      [el({ length: '12', width: '8', thicknessCm: '12' }), el({ length: '30', width: '0,15', thicknessCm: '40', count: '4' })],
      '5',
      'volume',
    )
    expect(s.base).toBeCloseTo(18.72, 10)
    expect(s.marginValue).toBeCloseTo(0.936, 10)
    expect(s.estimated).toBeCloseTo(19.656, 10)
  })

  it('aceita volume informado diretamente pelo cliente', () => {
    expect(computeElement(el({ mode: 'informado', informed: '7,5' }), 'volume').value).toBe(7.5)
  })

  it('rejeita medidas negativas, zero, texto e quantidade fracionada', () => {
    expect(computeElement(el({ length: '-2', width: '3', thicknessCm: '10' }), 'volume').error).toMatch(/maior que zero/)
    expect(computeElement(el({ length: '0', width: '3', thicknessCm: '10' }), 'volume').error).toMatch(/maior que zero/)
    expect(computeElement(el({ length: 'abc', width: '3', thicknessCm: '10' }), 'volume').error).toMatch(/inválido/)
    expect(computeElement(el({ length: '2', width: '3', thicknessCm: '10', count: '1,5' }), 'volume').error).toMatch(/inteiro/)
  })

  it('elemento incompleto não gera erro nem volume', () => {
    const r = computeElement(el({ length: '2' }), 'volume')
    expect(r).toEqual({ value: null, error: null, incomplete: true })
  })

  it('margem fora de 0–100% é inválida', () => {
    expect(summarizeMeasures([], '120', 'volume').marginError).toBeTruthy()
  })

  it('área de piso = comprimento × largura × quantidade', () => {
    expect(computeElement(el({ length: '40', width: '25' }), 'area').value).toBe(1000)
  })
})

describe('orçamento', () => {
  const volume = summarizeMeasures(
    [el({ length: '12', width: '8', thicknessCm: '12' }), el({ length: '30', width: '0,15', thicknessCm: '40', count: '4' })],
    '5',
    'volume',
  )

  it('preço ausente nunca vira R$ 0,00 e bloqueia a emissão', () => {
    const r = quote([line('c-fck25', { quantityMode: 'volume' })], { volume }, official)
    expect(r.lines[0].priceSource).toBe('pendente')
    expect(r.lines[0].netCents).toBeNull()
    expect(r.totalCents).toBeNull()
    expect(r.canIssue).toBe(false)
    expect(r.issues.some((i) => i.level === 'bloqueio' && /Preço pendente/.test(i.message))).toBe(true)
  })

  it('concreto FCK 25 com bombeamento por m³ (mínimo aplicado) e frete por região', () => {
    const r = quote([line('c-fck25', { quantityMode: 'volume' })], {
      volume,
      extras: { pumping: { mode: 'm3', hours: '', partner: false }, freight: { mode: 'regiao', km: '', regionId: 'r-centro' } },
    })
    // 19,656 m³ → cobrado 19,66 m³ × R$ 420 (demo) = R$ 8.257,20
    expect(r.lines[0].quantity).toBe(19.66)
    expect(r.lines[0].netCents).toBe(825_720)
    // 19,66 × R$ 28 = R$ 550,48 < mínimo R$ 700
    const pump = r.additionals.find((a) => a.key === 'bombeamento')!
    expect(pump.cents).toBe(70_000)
    expect(pump.detail).toMatch(/mínimo/)
    expect(r.additionals.find((a) => a.key === 'frete')!.cents).toBe(15_000)
    expect(r.totalCents).toBe(825_720 + 70_000 + 15_000)
    expect(r.canIssue).toBe(true)
    expect(r.needsApproval).toBe(false)
  })

  it('piso polido por m²', () => {
    const area = summarizeMeasures([el({ length: '40', width: '25' })], '', 'area')
    const r = quote([line('p-polido', { quantityMode: 'area', unit: 'm²', category: 'piso' })], { area })
    expect(r.floorArea).toBe(1000)
    expect(r.totalCents).toBe(6_800_000)
  })

  it('não cobra o mesmo serviço duas vezes', () => {
    const r = quote([line('c-fck25', { quantity: '10' }), line('s-frete', { quantity: '1', unit: 'viagem', category: 'frete' })], {
      extras: { freight: { mode: 'fixo', km: '', regionId: '' } },
    })
    expect(r.issues.some((i) => i.level === 'bloqueio' && /duas vezes/.test(i.message))).toBe(true)
    expect(r.canIssue).toBe(false)
  })

  it('cobra a diferença do volume mínimo pelo preço do concreto', () => {
    const r = quote([line('c-fck25', { quantity: '2' })])
    const add = r.additionals.find((a) => a.key === 'volume-minimo')!
    expect(add.quantity).toBe(1)
    expect(add.cents).toBe(42_000)
    expect(r.totalCents).toBe(84_000 + 42_000)
  })

  it('desconto acima do limite exige aprovação interna', () => {
    const r = quote([line('c-fck25', { quantity: '10', discountPct: '8' })])
    expect(r.lines[0].grossCents).toBe(420_000)
    expect(r.lines[0].discountCents).toBe(33_600)
    expect(r.needsApproval).toBe(true)
    expect(r.totalCents).toBe(420_000 - 33_600)
  })

  it('preço manual é registrado como exceção que exige aprovação', () => {
    const r = quote([line('c-fck25', { quantity: '10', unitPriceInput: '399,90' })], {}, official)
    expect(r.lines[0].priceSource).toBe('manual')
    expect(r.lines[0].netCents).toBe(399_900)
    expect(r.issues.some((i) => i.level === 'aprovacao')).toBe(true)
  })

  it('soma decimais sem erro de ponto flutuante', () => {
    const r = quote([line(null, { quantity: '3', unitPriceInput: '0,1', unit: 'un', category: 'servico' }), line(null, { quantity: '1', unitPriceInput: '0,2', unit: 'un', category: 'servico' })])
    expect(r.itemsGrossCents).toBe(50)
  })

  it('rejeita quantidade inválida e desconto geral maior que o valor', () => {
    expect(quote([line('c-fck25', { quantity: '-1' })]).canIssue).toBe(false)
    expect(quote([line('c-fck25', { quantity: '10' })], { extras: { globalDiscount: '999999' } }).canIssue).toBe(false)
  })

  it('bloqueia forma de pagamento não habilitada', () => {
    const r = quote([line('c-fck25', { quantity: '10' })], { pay: ['pix'] }, official)
    expect(r.issues.some((i) => /não está habilitada/.test(i.message))).toBe(true)
  })

  it('exige cliente e obra', () => {
    const r = computeQuote({ clientId: null, siteId: null, lines: [], volume: noMeasures, area: noArea, extras: defaultExtras(), paymentMethodIds: [] }, demo)
    expect(r.issues.filter((i) => i.level === 'bloqueio').map((i) => i.message)).toEqual(expect.arrayContaining(['Selecione o cliente', 'Selecione a obra']))
  })
})
