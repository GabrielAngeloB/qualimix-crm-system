import { useEffect, useId, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useStore } from '../data/store'

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ')
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark'
export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant
  size?: 'sm' | 'md'
}) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-[15px]',
        variant === 'primary' && 'bg-brand text-white hover:bg-brand-strong shadow-sm shadow-brand/20',
        variant === 'secondary' && 'border border-line bg-surface text-ink hover:bg-surface-2',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2',
        variant === 'danger' && 'border border-brand/40 text-brand hover:bg-brand-soft',
        variant === 'dark' && 'bg-ink text-bg hover:opacity-90',
        className,
      )}
    >
      {children}
    </button>
  )
}

type Tone = 'neutral' | 'red' | 'ok' | 'warn' | 'info' | 'dark'
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        tone === 'neutral' && 'bg-surface-2 text-ink-2 border border-line',
        tone === 'red' && 'bg-brand-soft text-brand',
        tone === 'ok' && 'bg-ok-soft text-ok',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'info' && 'bg-info-soft text-info',
        tone === 'dark' && 'bg-ink text-bg',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Card({ children, className, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section {...rest} className={cx('rounded-lg border border-line bg-surface', className)}>
      {children}
    </section>
  )
}

export function CardHeader({ title, subtitle, action, step }: { title: string; subtitle?: ReactNode; action?: ReactNode; step?: number }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="flex items-start gap-3 min-w-0">
        {step !== undefined && (
          <span className="font-display mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded bg-ink text-sm font-bold text-bg">
            {step}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-xl font-bold uppercase leading-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  )
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">
            <span className="h-[3px] w-6 bg-brand" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-4xl font-extrabold uppercase leading-none md:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string
  hint?: ReactNode
  error?: string | null
  required?: boolean
  children: (id: string) => ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <div className={cx('min-w-0', className)}>
      <label htmlFor={id} className="mb-1 block text-[13px] font-semibold text-ink-2">
        {label}
        {required && <span className="text-brand"> *</span>}
      </label>
      {children(id)}
      {error ? (
        <p className="mt-1 text-xs font-medium text-brand" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export const inputCls = (invalid?: boolean) =>
  cx(
    'h-10 w-full rounded-md border bg-surface px-3 text-[15px] text-ink placeholder:text-muted/70 outline-none transition focus:border-ink focus:ring-2 focus:ring-brand/20',
    invalid ? 'border-brand' : 'border-line',
  )

export function Drawer({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 no-print" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cx('anim-slide absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-2xl', wide ? 'max-w-2xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-2xl font-bold uppercase">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'md' | 'xl' }) {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={title}>
      <div className="no-print fixed inset-0 bg-black/60" onClick={onClose} />
      <div className={cx('anim-fade relative w-full rounded-lg bg-surface shadow-2xl', size === 'xl' ? 'max-w-5xl' : 'max-w-lg')}>
        <div className="no-print flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-2xl font-bold uppercase">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="no-print flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-line text-muted">{icon}</div>
      <h3 className="text-2xl font-bold uppercase">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Toaster() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="no-print pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="anim-fade pointer-events-auto flex gap-3 rounded-lg border border-line bg-surface p-4 shadow-xl">
          {t.tone === 'ok' ? <CircleCheck className="h-5 w-5 shrink-0 text-ok" /> : t.tone === 'erro' ? <CircleAlert className="h-5 w-5 shrink-0 text-brand" /> : <Info className="h-5 w-5 shrink-0 text-info" />}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t.title}</p>
            {t.body && <p className="text-sm text-muted">{t.body}</p>}
          </div>
          <button onClick={() => dismissToast(t.id)} aria-label="Fechar aviso" className="text-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function SegTabs<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-md border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded px-3 py-1.5 text-sm font-semibold transition-colors',
            value === o.value ? 'bg-ink text-bg' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Logo: espaço reservado até o administrador enviar o logotipo oficial. */
export function LogoSlot({ compact, onDark }: { compact?: boolean; onDark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        title="Espaço para o logo oficial da Qualimix (Configurações › Identidade visual)"
        className={cx(
          'grid shrink-0 place-items-center rounded border-2 border-dashed text-[9px] font-bold uppercase tracking-wider',
          compact ? 'h-9 w-9' : 'h-11 w-11',
          onDark ? 'border-white/30 text-white/50' : 'border-line text-muted',
        )}
      >
        Logo
      </div>
      <div className="leading-none">
        <div className={cx('font-display text-2xl font-extrabold uppercase tracking-wide', onDark ? 'text-white' : 'text-ink')}>
          Quali<span className="text-brand">mix</span>
        </div>
        {!compact && <div className={cx('mt-1 text-[10px] font-semibold uppercase tracking-[0.2em]', onDark ? 'text-white/50' : 'text-muted')}>CRM & Gestão</div>}
      </div>
    </div>
  )
}
