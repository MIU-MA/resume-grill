import { Suspense, type ReactNode } from 'react'
import App from '@/application/App'
import { WorkspaceLoading } from '@/features/workspace/WorkspaceLoading'
import { ThemePreference } from '@/components/ui/ThemePreference'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <ThemePreference /><App>{children}</App>
    </Suspense>
  )
}
