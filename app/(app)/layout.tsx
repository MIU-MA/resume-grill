import { Suspense, type ReactNode } from 'react'
import App from '@/App'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <App />
      {children}
    </Suspense>
  )
}
