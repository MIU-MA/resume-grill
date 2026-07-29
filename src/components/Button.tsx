import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

// 统一按钮：替代旧 .button/.icon-button。变体 primary | secondary；尺寸 normal | large | icon。
type Variant = 'primary' | 'secondary'
type Size = 'normal' | 'large' | 'icon'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  children?: ReactNode
}

const BASE =
  'inline-flex items-center justify-center gap-[7px] rounded-[5px] cursor-pointer transition-[background,border-color,color,transform] duration-[160ms] disabled:cursor-not-allowed disabled:opacity-42'

const VARIANT: Record<Variant, string> = {
  primary: 'h-8 px-3 text-[12px] font-650 text-white bg-brand hover:bg-[#194ebc]',
  secondary: 'h-8 px-3 text-[12px] font-650 text-[#3e474d] bg-white border border-line-strong hover:bg-[#f0f3f5]',
}

const SIZE: Record<Size, string> = {
  normal: '',
  large: 'h-[38px] px-[18px]',
  icon: 'w-8 h-8 px-0 text-muted bg-white border border-line-strong hover:bg-[#f0f3f5]',
}

export function Button({ variant = 'primary', size = 'normal', className, children, ...props }: ButtonProps) {
  // icon 尺寸不套 variant 的 h-8/px，用 icon 自己的尺寸类（已在 SIZE.icon）
  const sizeCls = SIZE[size]
  const variantCls = size === 'icon' ? '' : VARIANT[variant]
  return (
    <button type="button" className={cn(BASE, variantCls, sizeCls, className)} {...props}>
      {children}
    </button>
  )
}
