import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { summarizeMeasures, type MeasureElement } from '../lib/quote'
import { MeasureCalculator } from './MeasureCalculator'

const element = (patch: Partial<MeasureElement>): MeasureElement => ({
  id: 'element-1',
  label: '',
  elementType: 'Laje H8',
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
  ...patch,
})

function renderCalculator(kind: 'volume' | 'area', item: MeasureElement) {
  const elements = [item]
  return render(
    <MeasureCalculator
      kind={kind}
      elements={elements}
      margin=""
      summary={summarizeMeasures(elements, '', kind)}
      onChange={vi.fn()}
      onMargin={vi.fn()}
    />,
  )
}

describe('calculadora visual de medidas', () => {
  it('exibe diâmetro e profundidade para estacas, sem campos de prisma', () => {
    renderCalculator('volume', element({ elementType: 'Estaca' }))

    expect(screen.getByLabelText('Diâmetro (m)')).toBeInTheDocument()
    expect(screen.getByLabelText('Profundidade (m)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Comprimento (m)')).not.toBeInTheDocument()
    expect(screen.getByText(/π × \(/)).toBeInTheDocument()
  })

  it('exibe metro linear e índice editável com sugestões para escadas', () => {
    renderCalculator('volume', element({ elementType: 'Escada' }))

    const factorInput = screen.getByLabelText('Índice de cálculo (m³ por metro)')
    expect(screen.getByLabelText('Metro linear (m)')).toBeInTheDocument()
    expect(factorInput).toHaveAttribute('list', 'stair-factor-element-1')
    expect(document.querySelector('#stair-factor-element-1 option[value="1,5"]')).not.toBeNull()
    expect(document.querySelector('#stair-factor-element-1 option[value="2"]')).not.toBeNull()
    expect(document.querySelector('#stair-factor-element-1 option[value="3"]')).not.toBeNull()
  })

  it('exibe altura, largura e espessura para pilares', () => {
    renderCalculator('volume', element({ elementType: 'Pilar' }))

    expect(screen.getByLabelText('Altura (m)')).toBeInTheDocument()
    expect(screen.getByLabelText('Largura (m)')).toBeInTheDocument()
    expect(screen.getByLabelText('Espessura (m)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Comprimento (m)')).not.toBeInTheDocument()
  })

  it('usa o tipo H da laje e não pede espessura manual', () => {
    renderCalculator('volume', element({ elementType: 'Laje H12', length: '10', width: '5' }))

    expect(screen.getByLabelText('Tipo do elemento 1')).toHaveValue('Laje H12')
    expect(screen.getByText(/altura nominal do modelo H/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Profundidade (m)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Espessura legada (cm)')).not.toBeInTheDocument()
  })

  it('limita a calculadora de área a piso, calçada e outro', () => {
    renderCalculator('area', element({ elementType: 'Calçada' }))

    expect(screen.getByLabelText('Comprimento (m)')).toBeInTheDocument()
    expect(screen.getByLabelText('Largura (m)')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Piso' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Calçada' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Viga' })).not.toBeInTheDocument()
  })

  it('atualiza o tipo de elemento quando o usuário escolhe outra opção', () => {
    const onChange = vi.fn()
    const item = element({ elementType: 'Sapata' })
    render(
      <MeasureCalculator
        kind="volume"
        elements={[item]}
        margin=""
        summary={summarizeMeasures([item], '', 'volume')}
        onChange={onChange}
        onMargin={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Tipo do elemento 1'), { target: { value: 'Viga' } })

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'element-1', elementType: 'Viga' })])
  })
})
