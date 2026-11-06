import type { MeasureSummary, QuoteLine, QuoteResult } from '../lib/quote'
import { brlCents, dateBR, num } from '../lib/format'
import { formatDocument, formatPhone } from '../lib/documents'
import { company } from '../data/settings'
import type { Client, Site } from '../data/fixtures'
import { cx } from './ui'

export interface ProposalData {
  number: string
  version: number
  issueDate: string
  validUntil: string | null
  client: Client | undefined
  site: Site | undefined
  ownerName: string
  lines: QuoteLine[]
  result: QuoteResult
  volume: MeasureSummary
  area: MeasureSummary
  payments: string[]
  paymentTerms: string
  executionDeadline: string
  notes: string
  /** Prévia: exibe marca d'água (há pendências ou aprovação) */
  preview: boolean
  demo: boolean
}

const Pending = ({ children }: { children: string }) => (
  <span className="rounded bg-[#fff4e0] px-1 text-[#a15c00]">[{children}]</span>
)

/** Documento A4 da proposta. Impressão via navegador → “Salvar como PDF”. */
export function ProposalDocument({ d }: { d: ProposalData }) {
  const r = d.result
  return (
    <article className="print-area relative mx-auto w-full max-w-[820px] overflow-hidden bg-white text-[13px] leading-relaxed text-[#111] shadow-sm ring-1 ring-black/10">
      {d.preview && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="font-display -rotate-[24deg] select-none whitespace-nowrap text-[64px] font-extrabold uppercase text-[#e10f1f]/12 sm:text-[96px]">
            Prévia — não válida
          </span>
        </div>
      )}
      <div className="h-2 bg-[#e10f1f]" />
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 px-8 py-6">
        <div className="flex items-center gap-4">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt="Qualimix" className="h-14 w-auto" />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded border-2 border-dashed border-black/20 text-[9px] font-bold uppercase text-black/40">Logo</div>
          )}
          <div>
            <div className="font-display text-3xl font-extrabold uppercase leading-none">{company.tradeName}</div>
            <div className="mt-1 text-[11px] text-black/60">
              {company.legalName ?? <Pending>razão social</Pending>} · CNPJ {company.cnpj ?? <Pending>CNPJ</Pending>}
            </div>
            <div className="text-[11px] text-black/60">
              {company.address ?? <Pending>endereço</Pending>} · {company.phone ?? <Pending>telefone</Pending>} · {company.email ?? <Pending>e-mail</Pending>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-xs font-bold uppercase tracking-[0.2em] text-[#e10f1f]">Proposta comercial</div>
          <div className="font-display text-2xl font-extrabold tabular">{d.number}</div>
          <div className="text-[11px] text-black/60">Versão {d.version}</div>
          <div className="mt-1 text-[11px]">
            Emissão: <strong>{dateBR(d.issueDate)}</strong> · Validade: <strong>{d.validUntil ? dateBR(d.validUntil) : '—'}</strong>
          </div>
        </div>
      </header>

      <section className="grid gap-4 px-8 py-5 sm:grid-cols-2">
        <div>
          <h3 className="font-display mb-1 text-xs font-bold uppercase tracking-[0.18em] text-black/50">Cliente</h3>
          <p className="font-semibold">{d.client?.name ?? '—'}</p>
          {d.client?.document && <p>{formatDocument(d.client.document)}</p>}
          {d.client?.phone && <p>{formatPhone(d.client.phone)}</p>}
          {d.client?.email && <p>{d.client.email}</p>}
        </div>
        <div>
          <h3 className="font-display mb-1 text-xs font-bold uppercase tracking-[0.18em] text-black/50">Obra</h3>
          <p className="font-semibold">{d.site?.name ?? '—'}</p>
          {d.site && <p>{d.site.address} — {d.site.city}</p>}
          {d.site?.contactName && <p>Contato: {d.site.contactName} {d.site.contactPhone && `· ${formatPhone(d.site.contactPhone)}`}</p>}
        </div>
      </section>

      {(d.volume.estimated > 0 || d.area.estimated > 0) && (
        <section className="mx-8 mb-4 grid gap-2 rounded bg-black/[0.035] px-4 py-3 text-[12px] sm:grid-cols-2">
          {d.volume.estimated > 0 && (
            <p>
              <strong>Volume estimado:</strong> {num(d.volume.base, 3)} m³ calculados
              {d.volume.marginPct > 0 && ` + ${num(d.volume.marginPct, 1)}% de margem`} = <strong>{num(d.volume.estimated, 3)} m³</strong>
            </p>
          )}
          {d.area.estimated > 0 && (
            <p>
              <strong>Área estimada:</strong> {num(d.area.base, 2)} m²
              {d.area.marginPct > 0 && ` + ${num(d.area.marginPct, 1)}%`} = <strong>{num(d.area.estimated, 2)} m²</strong>
            </p>
          )}
        </section>
      )}

      <section className="px-8">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-[#111] text-left text-white">
              <th className="px-2 py-2 font-semibold">Descrição</th>
              <th className="px-2 py-2 text-right font-semibold">Qtd.</th>
              <th className="px-2 py-2 font-semibold">Un.</th>
              <th className="px-2 py-2 text-right font-semibold">Preço unit.</th>
              <th className="px-2 py-2 text-right font-semibold">Desc.</th>
              <th className="px-2 py-2 text-right font-semibold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l, i) => {
              const c = r.lines[i]
              return (
                <tr key={l.id} className="border-b border-black/10">
                  <td className="px-2 py-2">{l.description}</td>
                  <td className="px-2 py-2 text-right tabular">{c?.quantity !== null && c ? num(c.quantity, 2) : '—'}</td>
                  <td className="px-2 py-2">{l.unit}</td>
                  <td className={cx('px-2 py-2 text-right tabular', c?.unitPrice === null && 'text-[#a15c00]')}>{c?.unitPrice !== null && c ? brlCents(Math.round(c.unitPrice * 100)) : 'Pendente'}</td>
                  <td className="px-2 py-2 text-right tabular">{c && c.discountPct > 0 ? `${num(c.discountPct, 1)}%` : '—'}</td>
                  <td className="px-2 py-2 text-right font-semibold tabular">{brlCents(c?.netCents ?? null)}</td>
                </tr>
              )
            })}
            {r.additionals.map((a) => (
              <tr key={a.key} className="border-b border-black/10">
                <td className="px-2 py-2">
                  {a.label}
                  {a.detail && <span className="block text-[11px] text-black/55">{a.detail}</span>}
                </td>
                <td className="px-2 py-2 text-right tabular">{a.quantity !== null ? num(a.quantity, 2) : '—'}</td>
                <td className="px-2 py-2">{a.unit}</td>
                <td className="px-2 py-2 text-right tabular">{a.unitPrice !== null ? brlCents(Math.round(a.unitPrice * 100)) : 'Pendente'}</td>
                <td className="px-2 py-2 text-right">—</td>
                <td className="px-2 py-2 text-right font-semibold tabular">{brlCents(a.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-3 w-full max-w-xs text-[12px]">
          <Row k="Subtotal dos itens" v={brlCents(r.itemsGrossCents)} />
          {r.lineDiscountCents > 0 && <Row k="Descontos nos itens" v={`− ${brlCents(r.lineDiscountCents)}`} />}
          {r.additionals.length > 0 && <Row k="Adicionais" v={brlCents(r.additionalsCents)} />}
          {r.globalDiscountCents > 0 && <Row k="Desconto geral" v={`− ${brlCents(r.globalDiscountCents)}`} />}
          <div className="mt-1 flex items-baseline justify-between border-t-2 border-[#111] pt-2">
            <span className="font-display text-sm font-bold uppercase">Total geral</span>
            <span className="font-display text-2xl font-extrabold tabular">{r.totalCents === null ? 'Pendente' : brlCents(r.totalCents)}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 px-8 py-5 sm:grid-cols-2">
        <div>
          <h3 className="font-display mb-1 text-xs font-bold uppercase tracking-[0.18em] text-black/50">Condições de pagamento</h3>
          <p>{d.payments.length ? d.payments.join(', ') : '—'}</p>
          {d.paymentTerms && <p>{d.paymentTerms}</p>}
          {d.executionDeadline && <p className="mt-1"><strong>Prazo de execução:</strong> {d.executionDeadline}</p>}
        </div>
        <div>
          <h3 className="font-display mb-1 text-xs font-bold uppercase tracking-[0.18em] text-black/50">Observações</h3>
          <p className="whitespace-pre-line">{d.notes || '—'}</p>
          <p className="mt-2 text-[11px] text-black/55">Volumes e áreas são estimativas geométricas comerciais e não substituem o projeto ou a especificação técnica de engenharia.</p>
        </div>
      </section>

      <section className="grid gap-8 px-8 pb-8 pt-4 sm:grid-cols-2">
        <div className="border-t border-black/40 pt-1 text-center text-[11px]">{d.ownerName} — {company.tradeName}</div>
        <div className="border-t border-black/40 pt-1 text-center text-[11px]">Aceite do cliente · Data ____/____/______</div>
      </section>
      {d.demo && <p className="bg-black/[0.04] px-8 py-2 text-center text-[10px] text-black/55">Documento gerado em ambiente de demonstração com dados e valores fictícios.</p>}
    </article>
  )
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between py-0.5">
    <span className="text-black/60">{k}</span>
    <span className="tabular">{v}</span>
  </div>
)
