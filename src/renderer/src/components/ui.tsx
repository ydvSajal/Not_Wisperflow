import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

function cx(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'ghost' | 'danger'

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }): React.JSX.Element {
  const styles: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-white hover:bg-accent-strong disabled:bg-surface-3 disabled:text-ink-dim',
    ghost: 'border border-line bg-surface text-ink hover:bg-surface-2 disabled:opacity-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
  }
  return (
    <button
      className={cx(
        'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        'active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
        styles[variant],
        className
      )}
      {...props}
    />
  )
}

export function Card({
  title,
  subtitle,
  children,
  className
}: {
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section className={cx('rounded-2xl border border-line bg-surface p-5', className)}>
      {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
      {subtitle && <p className="mt-0.5 text-xs text-ink-dim">{subtitle}</p>}
      <div className={title ? 'mt-4' : ''}>{children}</div>
    </section>
  )
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return (
    <input
      className={cx(
        'w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink',
        'placeholder:text-ink-dim focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none',
        className
      )}
      {...props}
    />
  )
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): React.JSX.Element {
  return (
    <select
      className={cx(
        'rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink',
        'focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none',
        className
      )}
      {...props}
    />
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5">
      {/* min-w-0 lets the text column shrink; without it a long label keeps its
          full width and pushes the switch past the edge of the card. */}
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-dim">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          'focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none',
          // An inset ring rather than a border: a border on one state only would
          // inset that state's content box by 1px, so the knob and the track
          // edges stopped lining up between on and off.
          checked ? 'bg-accent' : 'bg-surface-3 ring-1 ring-line ring-inset'
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            // Track 36px - knob 16px - 2px inset each side = 16px of travel.
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
    </label>
  )
}

export function Field({
  label,
  children
}: {
  label: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-dim">{label}</span>
      {children}
    </label>
  )
}
