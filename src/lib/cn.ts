import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// 合并 className，后者覆盖前者；twMerge 处理 Tailwind 冲突（如 px-2 px-4）。
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
