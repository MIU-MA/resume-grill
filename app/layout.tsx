import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

// Next.js requires route metadata to be exported from the layout module.
// oxlint-disable-next-line react/only-export-components
export const metadata: Metadata = {
  title: '简历拷打机',
  description: '把简历里的项目和成果提前问一遍，看看哪些地方还讲不清。',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
