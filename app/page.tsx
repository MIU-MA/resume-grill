import { Suspense } from 'react'
import App from '@/App'

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <App />
    </Suspense>
  )
}
