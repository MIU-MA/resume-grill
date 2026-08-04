import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'normal' | 'large'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  children?: ReactNode
}

const BASE = 'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed'

const VARIANTS: Record<Variant, string> = {
  primary: 'text-white bg-brand hover:bg-brand-hover rounded-lg',
  secondary: 'text-text-secondary bg-white border border-line hover:bg-surface-hover rounded-lg',
  ghost: 'text-text-secondary hover:bg-surface-hover rounded-lg',
  danger: 'text-danger bg-danger-soft hover:brightness-95 rounded-lg',
}

const SIZES: Record<Size, string> = {
  normal: 'h-9 px-4 text-[13px]',
  large: 'h-10 px-5 text-[14px]',
}

export function Button({ variant = 'primary', size = 'normal', loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button type="button" className={cn(BASE, VARIANTS[variant], SIZES[size], className)} disabled={disabled || loading} {...props}>
      {loading ? <Spinner /> : children}
    </button>
  )
}

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
