import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cx } from './ui'

export type SortDir = 'asc' | 'desc'

export function useSortPage<T>(rows: T[], getters: Record<string, (r: T) => string | number>, initial: { key: string; dir: SortDir }, pageSize = 8) {
  const [sort, setSort] = useState(initial)
  const [page, setPage] = useState(1)
  const sorted = useMemo(() => {
    const g = getters[sort.key]
    if (!g) return rows
    return [...rows].sort((a, b) => {
      const x = g(a)
      const y = g(b)
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')
      return sort.dir === 'asc' ? c : -c
    })
  }, [rows, sort]) // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages)
  const pageRows = sorted.slice((current - 1) * pageSize, current * pageSize)
  const toggle = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  return { pageRows, sort, toggle, page: current, pages, setPage, total: sorted.length, pageSize }
}

export function SortTh({ label, k, sort, toggle, right }: { label: string; k: string; sort: { key: string; dir: SortDir }; toggle: (k: string) => void; right?: boolean }) {
  const active = sort.key === k
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cx('px-4 py-3 font-bold', right && 'text-right')}>
      <button onClick={() => toggle(k)} className={cx('inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink', active && 'text-ink')}>
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </th>
  )
}

export function Pagination({ page, pages, setPage, total, pageSize }: { page: number; pages: number; setPage: (n: number) => void; total: number; pageSize: number }) {
  if (!total) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button className="grid h-8 w-8 place-items-center rounded border border-line disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 tabular">
          {page} / {pages}
        </span>
        <button className="grid h-8 w-8 place-items-center rounded border border-line disabled:opacity-40" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Próxima página">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
