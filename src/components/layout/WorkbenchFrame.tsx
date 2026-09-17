import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function WorkbenchFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="resume-workbench workbench-stage">
      <div className={cn('workbench-window', className)}>{children}</div>
    </div>
  )
}
