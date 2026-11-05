import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

/** Flex/grid panes must own their overflow, rather than growing with the document. */
export function ScrollArea({ className, children, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain', className)}>{children}</div>
}
