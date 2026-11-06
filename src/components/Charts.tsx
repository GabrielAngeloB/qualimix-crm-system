import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { useEffect, useState, type ReactNode } from 'react'
import { cx } from './ui'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const RED = '#e10f1f'
const GREY = '#8c8c8c'

function useMounted() {
  const [m, setM] = useState(false)
  useEffect(() => setM(true), [])
  return m
}

export interface Series {
  label: string
  data: number[]
  color?: 'red' | 'grey'
}

export function BarChart({
  labels,
  series,
  horizontal,
  format,
  ariaLabel,
}: {
  labels: string[]
  series: Series[]
  horizontal?: boolean
  format: (n: number) => string
  ariaLabel: string
}) {
  const mounted = useMounted()
  if (!mounted) return <div className="h-full w-full animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
  return (
    <Bar
      role="img"
      aria-label={ariaLabel}
      data={{
        labels,
        datasets: series.map((s) => ({
          label: s.label,
          data: s.data,
          backgroundColor: s.color === 'grey' ? GREY : RED,
          borderRadius: 3,
          maxBarThickness: 34,
        })),
      }}
      options={{
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: series.length > 1, position: 'bottom', labels: { color: GREY, boxWidth: 12, font: { family: 'Barlow' } } },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${format(Number(c.raw))}` } },
        },
        scales: {
          x: { grid: { display: !!horizontal, color: 'rgba(140,140,140,.18)' }, ticks: { color: GREY, font: { family: 'Barlow' }, callback: horizontal ? (v) => format(Number(v)) : undefined }, beginAtZero: true },
          y: { grid: { display: !horizontal, color: 'rgba(140,140,140,.18)' }, ticks: { color: GREY, font: { family: 'Barlow' }, callback: horizontal ? undefined : (v) => format(Number(v)) }, beginAtZero: true },
        },
      }}
    />
  )
}

export function ChartCard({ title, definition, children, rows, columns, className }: { title: string; definition: string; children: ReactNode; rows: (string | number)[][]; columns: string[]; className?: string }) {
  return (
    <section aria-label={title} className={cx('min-w-0 rounded-lg border border-line bg-surface p-5', className)}>
      <h2 className="text-xl font-bold uppercase">{title}</h2>
      <p className="mb-4 text-xs text-muted">{definition}</p>
      <div className="relative h-64 w-full">{children}</div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-muted underline">Ver dados em tabela</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={c} className={cx('py-1', i > 0 && 'text-right')}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r[0])} className="border-t border-line">
                {r.map((v, i) => (
                  <td key={i} className={cx('py-1 tabular', i > 0 && 'text-right')}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
