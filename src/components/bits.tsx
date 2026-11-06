import type { QuoteStatus } from '../data/settings'
import { cx } from './ui'

export const statusTone = (s: QuoteStatus) =>
  s === 'Aceito' ? 'ok' : s === 'Recusado' || s === 'Cancelado' ? 'red' : s === 'Aguardando aprovação' || s === 'Aguardando informações' || s === 'Em negociação' ? 'warn' : s === 'Enviado ao cliente' || s === 'Aprovado internamente' ? 'info' : 'neutral'

export function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' | 'red' }) {
  return (
    <div className={cx('rounded-lg border bg-surface p-4', tone === 'warn' ? 'border-warn/40' : tone === 'red' ? 'border-brand/40' : 'border-line')}>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={cx('font-display text-3xl font-extrabold tabular', tone === 'warn' && 'text-warn', tone === 'red' && 'text-brand')}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  )
}
